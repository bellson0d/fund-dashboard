// 业务数据 API - 持仓列表 / 名称缓存 / 添加信息 / 快照 / 变更记录 / 导入导出
// 所有查询强制带 user_id，数据按用户隔离
import express from 'express'
import crypto from 'node:crypto'
import { db, withTransaction, LIMITS } from './db.js'
import { requireAuth, requireSameOrigin } from './auth.js'
import { defaultFundCodes } from '../data/mockData.js'
import { defaultStockCodes } from '../data/stockData.js'
import {
  DEFAULT_FUND_ADDED_AT, DEFAULT_STOCK_ADDED_AT, FALLBACK_MONTHS, monthsAgo
} from '../shared/addedDefaults.js'

const TYPES = ['fund', 'stock']
const DEFAULT_CODES = { fund: defaultFundCodes, stock: defaultStockCodes }
const DEFAULT_ADDED_AT = { fund: DEFAULT_FUND_ADDED_AT, stock: DEFAULT_STOCK_ADDED_AT }

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function isValidType(type) {
  return TYPES.includes(type)
}

function readHoldings(userId, type) {
  return db.prepare(
    'SELECT code, added_at AS addedAt, base_price AS basePrice, base_price_failed_at AS basePriceFailedAt ' +
    'FROM holdings WHERE user_id = ? AND type = ? ORDER BY position ASC'
  ).all(userId, type)
}

function readInfo(userId, type) {
  const rows = db.prepare('SELECT code, name FROM instrument_info WHERE user_id = ? AND type = ?').all(userId, type)
  const result = {}
  rows.forEach(row => { result[row.code] = row.name })
  return result
}

function readAddedMeta(userId, type) {
  const result = {}
  readHoldings(userId, type).forEach(row => {
    result[row.code] = {
      addedAt: row.addedAt || null,
      basePrice: row.basePrice ?? null,
      basePriceFailedAt: row.basePriceFailedAt ?? null
    }
  })
  return result
}

// 为缺失添加时间的持仓补种默认值（默认列表用 git 日期，其余回退 3 个月前）
function seedAddedAt(userId, type) {
  const fallback = monthsAgo(FALLBACK_MONTHS)
  const defaults = new Set(DEFAULT_CODES[type] || [])
  const rows = readHoldings(userId, type)
  const update = db.prepare('UPDATE holdings SET added_at = ? WHERE user_id = ? AND type = ? AND code = ?')
  rows.forEach(row => {
    if (row.addedAt) return
    update.run(defaults.has(row.code) ? DEFAULT_ADDED_AT[type] : fallback, userId, type, row.code)
  })
}

function readSnapshots(userId) {
  return db.prepare(
    'SELECT id, saved_at AS savedAt, note, funds_json AS fundsJson, stocks_json AS stocksJson ' +
    'FROM snapshots WHERE user_id = ? ORDER BY saved_at DESC LIMIT ?'
  ).all(userId, LIMITS.snapshots).map(row => ({
    id: row.id,
    savedAt: row.savedAt,
    note: row.note || '',
    funds: JSON.parse(row.fundsJson || '[]'),
    stocks: JSON.parse(row.stocksJson || '[]')
  }))
}

function readChanges(userId) {
  return db.prepare(
    'SELECT id, at, type, action, code, name, from_pos AS "from", to_pos AS "to" ' +
    'FROM change_log WHERE user_id = ? ORDER BY at DESC LIMIT ?'
  ).all(userId, LIMITS.changes).map(row => {
    const item = { id: row.id, at: row.at, type: row.type, action: row.action }
    if (row.code != null) item.code = row.code
    if (row.name != null) item.name = row.name
    if (row.from != null) item.from = row.from
    if (row.to != null) item.to = row.to
    return item
  })
}

function trimSnapshots(userId) {
  db.prepare(`
    DELETE FROM snapshots WHERE user_id = ? AND id NOT IN (
      SELECT id FROM snapshots WHERE user_id = ? ORDER BY saved_at DESC LIMIT ?
    )
  `).run(userId, userId, LIMITS.snapshots)
}

function trimChanges(userId) {
  db.prepare(`
    DELETE FROM change_log WHERE user_id = ? AND id NOT IN (
      SELECT id FROM change_log WHERE user_id = ? ORDER BY at DESC LIMIT ?
    )
  `).run(userId, userId, LIMITS.changes)
}

function cleanString(value, maxLength = 64) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function normalizeCodes(input) {
  if (!Array.isArray(input)) return null
  const seen = new Set()
  const codes = []
  for (const item of input) {
    const code = cleanString(item, 32)
    if (!code || seen.has(code)) continue
    seen.add(code)
    codes.push(code)
  }
  return codes.slice(0, LIMITS.codes)
}

function normalizeInfo(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return []
  return Object.entries(input)
    .map(([code, name]) => [cleanString(code, 32), cleanString(name, 100)])
    .filter(([code, name]) => code && name)
    .slice(0, LIMITS.codes)
}

function normalizeAddedMeta(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return []
  const entries = []
  Object.entries(input).forEach(([code, meta]) => {
    const cleanCode = cleanString(code, 32)
    if (!cleanCode || !meta || typeof meta !== 'object') return
    const addedAt = typeof meta.addedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(meta.addedAt)
      ? meta.addedAt
      : null
    const basePrice = Number.isFinite(meta.basePrice) ? Number(meta.basePrice) : null
    const basePriceFailedAt = Number.isFinite(meta.basePriceFailedAt) ? Math.trunc(meta.basePriceFailedAt) : null
    entries.push([cleanCode, { addedAt, basePrice, basePriceFailedAt }])
  })
  return entries.slice(0, LIMITS.codes)
}

function writeTypeSlice(userId, type, codes, infoEntries, metaEntries) {
  const metaMap = new Map(metaEntries)
  db.prepare('DELETE FROM holdings WHERE user_id = ? AND type = ?').run(userId, type)
  db.prepare('DELETE FROM instrument_info WHERE user_id = ? AND type = ?').run(userId, type)

  const insertHolding = db.prepare(
    'INSERT INTO holdings (user_id, type, code, position, added_at, base_price, base_price_failed_at) ' +
    'VALUES (?, ?, ?, ?, ?, ?, ?)'
  )
  codes.forEach((code, index) => {
    const meta = metaMap.get(code) || {}
    insertHolding.run(
      userId, type, code, index,
      meta.addedAt || null, meta.basePrice ?? null, meta.basePriceFailedAt ?? null
    )
  })

  const insertInfo = db.prepare(
    'INSERT OR REPLACE INTO instrument_info (user_id, type, code, name) VALUES (?, ?, ?, ?)'
  )
  infoEntries.forEach(([code, name]) => insertInfo.run(userId, type, code, name))
}

export function createDataRouter() {
  const router = express.Router()
  router.use(requireAuth)

  // 完整组合数据（登录后首屏一次性拉取）
  router.get('/portfolio', (req, res) => {
    const userId = req.user.userId
    withTransaction(() => {
      seedAddedAt(userId, 'fund')
      seedAddedAt(userId, 'stock')
    })
    res.json({
      lists: {
        fund: readHoldings(userId, 'fund').map(row => row.code),
        stock: readHoldings(userId, 'stock').map(row => row.code)
      },
      info: { fund: readInfo(userId, 'fund'), stock: readInfo(userId, 'stock') },
      addedMeta: { fund: readAddedMeta(userId, 'fund'), stock: readAddedMeta(userId, 'stock') }
    })
  })

  // 全量覆盖某一类型的持仓（顺序 + 名称缓存 + 添加信息），客户端防抖后整体提交
  router.put('/portfolio/:type', requireSameOrigin, (req, res) => {
    const { type } = req.params
    if (!isValidType(type)) return res.status(400).json({ error: 'invalid_type' })

    const codes = normalizeCodes(req.body?.codes)
    if (!codes) return res.status(400).json({ error: 'invalid_codes', message: 'codes 必须为数组' })

    const infoEntries = normalizeInfo(req.body?.info)
    const metaEntries = normalizeAddedMeta(req.body?.addedMeta)

    withTransaction(() => writeTypeSlice(req.user.userId, type, codes, infoEntries, metaEntries))
    res.json({ ok: true, count: codes.length })
  })

  // ---------- 快照 ----------

  router.get('/snapshots', (req, res) => {
    res.json({ snapshots: readSnapshots(req.user.userId) })
  })

  router.post('/snapshots', requireSameOrigin, (req, res) => {
    const userId = req.user.userId
    const note = cleanString(req.body?.note, 200)
    const funds = Array.isArray(req.body?.funds) ? req.body.funds : []
    const stocks = Array.isArray(req.body?.stocks) ? req.body.stocks : []
    const snapshot = {
      id: makeId('snap'),
      savedAt: new Date().toISOString(),
      note,
      funds,
      stocks
    }
    withTransaction(() => {
      db.prepare(
        'INSERT INTO snapshots (user_id, id, saved_at, note, funds_json, stocks_json) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        userId, snapshot.id, snapshot.savedAt, note,
        JSON.stringify(funds), JSON.stringify(stocks)
      )
      trimSnapshots(userId)
    })
    res.status(201).json({ snapshot })
  })

  router.patch('/snapshots/:id', requireSameOrigin, (req, res) => {
    const note = cleanString(req.body?.note, 200)
    const result = db.prepare('UPDATE snapshots SET note = ? WHERE user_id = ? AND id = ?')
      .run(note, req.user.userId, String(req.params.id))
    if (result.changes === 0) return res.status(404).json({ error: 'not_found' })
    res.json({ ok: true })
  })

  router.delete('/snapshots/:id', requireSameOrigin, (req, res) => {
    db.prepare('DELETE FROM snapshots WHERE user_id = ? AND id = ?')
      .run(req.user.userId, String(req.params.id))
    res.json({ ok: true })
  })

  router.delete('/snapshots', requireSameOrigin, (req, res) => {
    db.prepare('DELETE FROM snapshots WHERE user_id = ?').run(req.user.userId)
    res.json({ ok: true })
  })

  // ---------- 变更记录 ----------

  router.get('/changes', (req, res) => {
    res.json({ changes: readChanges(req.user.userId) })
  })

  router.post('/changes', requireSameOrigin, (req, res) => {
    const userId = req.user.userId
    const type = req.body?.type
    const action = cleanString(req.body?.action, 20)
    if (!isValidType(type) || !action) return res.status(400).json({ error: 'invalid_change' })

    const record = {
      id: makeId('chg'),
      at: new Date().toISOString(),
      type,
      action,
      code: cleanString(req.body?.code, 32) || null,
      name: cleanString(req.body?.name, 100) || null,
      from: Number.isInteger(req.body?.from) ? req.body.from : null,
      to: Number.isInteger(req.body?.to) ? req.body.to : null
    }
    withTransaction(() => {
      db.prepare(
        'INSERT INTO change_log (user_id, id, at, type, action, code, name, from_pos, to_pos) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, record.id, record.at, type, action, record.code, record.name, record.from, record.to)
      trimChanges(userId)
    })
    res.status(201).json({ change: record })
  })

  router.delete('/changes', requireSameOrigin, (req, res) => {
    db.prepare('DELETE FROM change_log WHERE user_id = ?').run(req.user.userId)
    res.json({ ok: true })
  })

  // ---------- 导出 / 导入 ----------

  router.get('/export', (req, res) => {
    const userId = req.user.userId
    res.json({
      version: 2,
      exportedAt: new Date().toISOString(),
      lists: {
        fund: readHoldings(userId, 'fund').map(row => row.code),
        stock: readHoldings(userId, 'stock').map(row => row.code)
      },
      info: { fund: readInfo(userId, 'fund'), stock: readInfo(userId, 'stock') },
      addedMeta: { fund: readAddedMeta(userId, 'fund'), stock: readAddedMeta(userId, 'stock') },
      snapshots: readSnapshots(userId),
      changes: readChanges(userId)
    })
  })

  router.post('/import', requireSameOrigin, (req, res) => {
    const mode = req.body?.mode === 'replace' ? 'replace' : 'merge'
    const data = req.body?.data
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'invalid_data', message: '缺少导入数据' })
    }

    const userId = req.user.userId
    const counts = { fund: 0, stock: 0, info: { fund: 0, stock: 0 }, snapshots: 0, changes: 0 }

    withTransaction(() => {
      if (mode === 'replace') {
        db.prepare('DELETE FROM holdings WHERE user_id = ?').run(userId)
        db.prepare('DELETE FROM instrument_info WHERE user_id = ?').run(userId)
        db.prepare('DELETE FROM snapshots WHERE user_id = ?').run(userId)
        db.prepare('DELETE FROM change_log WHERE user_id = ?').run(userId)
      }

      TYPES.forEach(type => {
        const codes = normalizeCodes(data?.lists?.[type]) || []
        const metaEntries = normalizeAddedMeta(data?.addedMeta?.[type])
        const metaMap = new Map(metaEntries)
        const existing = new Set(readHoldings(userId, type).map(row => row.code))

        if (mode === 'replace') {
          const infoEntries = normalizeInfo(data?.info?.[type])
          writeTypeSlice(userId, type, codes, infoEntries, metaEntries)
          counts[type] = codes.length
          counts.info[type] = infoEntries.length
          return
        }

        // merge：只补缺，不覆盖已有顺序与添加时间
        const startPosition = existing.size
        const insertHolding = db.prepare(
          'INSERT INTO holdings (user_id, type, code, position, added_at, base_price, base_price_failed_at) ' +
          'VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        let appended = 0
        codes.forEach(code => {
          if (existing.has(code)) return
          const meta = metaMap.get(code) || {}
          insertHolding.run(
            userId, type, code, startPosition + appended,
            meta.addedAt || null, meta.basePrice ?? null, meta.basePriceFailedAt ?? null
          )
          existing.add(code)
          appended += 1
        })
        counts[type] = appended

        const insertInfo = db.prepare(
          'INSERT OR IGNORE INTO instrument_info (user_id, type, code, name) VALUES (?, ?, ?, ?)'
        )
        let infoAdded = 0
        normalizeInfo(data?.info?.[type]).forEach(([code, name]) => {
          const result = insertInfo.run(userId, type, code, name)
          infoAdded += result.changes
        })
        counts.info[type] = infoAdded

        // 已有持仓补充缺失的添加时间/基准价
        const patchHolding = db.prepare(
          'UPDATE holdings SET added_at = COALESCE(?, added_at), base_price = COALESCE(?, base_price), ' +
          'base_price_failed_at = COALESCE(?, base_price_failed_at) WHERE user_id = ? AND type = ? AND code = ?'
        )
        metaEntries.forEach(([code, meta]) => {
          patchHolding.run(meta.addedAt, meta.basePrice, meta.basePriceFailedAt, userId, type, code)
        })
      })

      const insertSnapshot = db.prepare(
        'INSERT OR IGNORE INTO snapshots (user_id, id, saved_at, note, funds_json, stocks_json) ' +
        'VALUES (?, ?, ?, ?, ?, ?)'
      )
      const snapshots = Array.isArray(data?.snapshots) ? data.snapshots.slice(0, LIMITS.snapshots) : []
      snapshots.forEach(item => {
        const id = cleanString(item?.id, 64)
        if (!id) return
        const result = insertSnapshot.run(
          userId, id,
          cleanString(item?.savedAt, 40) || new Date().toISOString(),
          cleanString(item?.note, 200),
          JSON.stringify(Array.isArray(item?.funds) ? item.funds : []),
          JSON.stringify(Array.isArray(item?.stocks) ? item.stocks : [])
        )
        counts.snapshots += result.changes
      })

      const insertChange = db.prepare(
        'INSERT OR IGNORE INTO change_log (user_id, id, at, type, action, code, name, from_pos, to_pos) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      const changes = Array.isArray(data?.changes) ? data.changes.slice(0, LIMITS.changes) : []
      changes.forEach(item => {
        const id = cleanString(item?.id, 64)
        if (!id || !isValidType(item?.type) || !cleanString(item?.action, 20)) return
        const result = insertChange.run(
          userId, id,
          cleanString(item?.at, 40) || new Date().toISOString(),
          item.type, cleanString(item.action, 20),
          cleanString(item?.code, 32) || null,
          cleanString(item?.name, 100) || null,
          Number.isInteger(item?.from) ? item.from : null,
          Number.isInteger(item?.to) ? item.to : null
        )
        counts.changes += result.changes
      })

      trimSnapshots(userId)
      trimChanges(userId)
    })

    res.json({ ok: true, mode, counts })
  })

  return router
}
