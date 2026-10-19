// 添加信息 - 记录基金/股票的添加时间，并据此计算"添加后涨幅"
// - 新添加项：Admin 添加时记录实际日期，持久化到 localStorage（meta 结构：{ addedAt, basePrice }）
// - 已有项：依据 git 提交记录确定的默认列表日期（见下方常量）补种，无记录者回退为"3个月前"
// - 基准价：基金取添加日的历史净值、股票取添加日的历史日 K 收盘价（前复权）
//           首次请求后写入 meta 缓存，之后不再重复请求
import { StockSDK } from 'stock-sdk'

const stockSDK = new StockSDK({ timeout: 15000 })

// 由 git log 推导：现有默认列表的加入日期
export const DEFAULT_FUND_ADDED_AT = '2026-05-14'   // commit 6f06261 更新默认配置
export const DEFAULT_STOCK_ADDED_AT = '2026-05-15'  // commit 78bef6f 更新默认股票列表

// 无添加时间记录时的回退时长（"暂时以过去 3 个月涨幅为基础数据"）
const FALLBACK_MONTHS = 3

const META_KEY = { fund: 'fundAddedMeta', stock: 'stockAddedMeta' }

function toDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function toCompact(d) {
  return toDateStr(d).replace(/-/g, '')
}

function monthsAgo(n) {
  const d = new Date()
  d.setMonth(d.getMonth() - n)
  return toDateStr(d)
}

function shiftDate(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return toCompact(d)
}

function readMeta(type) {
  try {
    return JSON.parse(window.localStorage.getItem(META_KEY[type])) || {}
  } catch {
    return {}
  }
}

function writeMeta(type, meta) {
  try {
    window.localStorage.setItem(META_KEY[type], JSON.stringify(meta))
  } catch (error) {
    console.error('Failed to persist added meta:', error)
  }
}

// 新添加项：记录实际添加日期
export function recordAddition(type, code) {
  const meta = readMeta(type)
  meta[code] = { ...meta[code], addedAt: toDateStr(new Date()) }
  writeMeta(type, meta)
}

// 已有项：补齐缺失的添加时间（默认列表用 git 日期，其余回退 3 个月前）
export function ensureAddedAt(type, codes, defaultCodes) {
  const defaultDate = type === 'fund' ? DEFAULT_FUND_ADDED_AT : DEFAULT_STOCK_ADDED_AT
  const fallback = monthsAgo(FALLBACK_MONTHS)
  const defaults = new Set(defaultCodes || [])
  const meta = readMeta(type)
  let changed = false

  codes.forEach(code => {
    if (!meta[code]?.addedAt) {
      meta[code] = { ...meta[code], addedAt: defaults.has(code) ? defaultDate : fallback }
      changed = true
    }
  })

  if (changed) writeMeta(type, meta)
  return meta
}

// 动态时长：大于 1 年 → x.x年；小于 1 年 → x天
export function formatAddedDuration(addedAt, now = Date.now()) {
  if (!addedAt) return ''
  const start = new Date(`${addedAt}T00:00:00`).getTime()
  if (Number.isNaN(start)) return ''
  const days = Math.max(0, Math.floor((now - start) / 86400000))
  if (days >= 365) return `${(days / 365).toFixed(1)}年`
  return `${days}天`
}

// 基准价：优先用缓存，否则请求一次历史数据并缓存
export async function resolveBasePrice(type, code, addedAt) {
  const meta = readMeta(type)
  const cached = meta[code]?.basePrice
  if (cached) return cached

  let price = null
  try {
    price = type === 'fund'
      ? await fetchFundNavAt(code, addedAt)
      : await fetchStockCloseAt(code, addedAt)
  } catch (error) {
    console.error('Failed to fetch base price:', code, error.message)
  }

  if (price) {
    meta[code] = { ...meta[code], addedAt, basePrice: price }
    writeMeta(type, meta)
  }
  return price
}

// 基金：历史净值中取添加日当天或之后的首个净值
async function fetchFundNavAt(code, addedAt) {
  const res = await stockSDK.fund.navHistory(code)
  return pickNearest(res?.items || [], addedAt, item => item.nav)
}

// 股票：历史日 K 中取添加日当天或之后的首个收盘价
async function fetchStockCloseAt(code, addedAt) {
  const symbol = toKlineSymbol(code)
  if (!symbol) return null
  const startDate = shiftDate(addedAt, -10)
  const endDate = shiftDate(addedAt, 10)
  const bars = await symbol.fetch(startDate, endDate)
  return pickNearest(bars || [], addedAt, bar => bar.close)
}

// 内部代码 → stock-sdk K 线符号
// 0./1. = A股(深/沪) · 116. = 港股 · 105. = 美股
function toKlineSymbol(code) {
  if (!code || typeof code !== 'string') return null

  if (code.startsWith('116.')) {
    const sym = code.substring(4)
    return { fetch: (s, e) => stockSDK.kline.hk(sym, { startDate: s, endDate: e }) }
  }
  if (code.startsWith('105.')) {
    const sym = code.substring(4)
    return { fetch: (s, e) => stockSDK.kline.us(sym, { startDate: s, endDate: e }) }
  }

  const clean = code.replace(/^[01]\./, '')
  const prefix = code.startsWith('1.') || clean.startsWith('6') ? 'sh' : 'sz'
  const sym = prefix + clean
  return { fetch: (s, e) => stockSDK.kline.cn(sym, { startDate: s, endDate: e }) }
}

// 取添加日当天或之后的最近一条；若区间内全部早于添加日，则取最后一条
function pickNearest(list, addedAt, getter) {
  if (!list || list.length === 0) return null
  const target = new Date(`${addedAt}T00:00:00`).getTime()
  let after = null
  let before = null

  for (const item of list) {
    const value = getter(item)
    if (value == null) continue
    const t = new Date(`${item.date}T00:00:00`).getTime()
    if (Number.isNaN(t)) continue

    if (t >= target) {
      if (!after || t < new Date(`${after.date}T00:00:00`).getTime()) after = item
    } else if (!before || t > new Date(`${before.date}T00:00:00`).getTime()) {
      before = item
    }
  }

  const chosen = after || before
  return chosen ? getter(chosen) : null
}
