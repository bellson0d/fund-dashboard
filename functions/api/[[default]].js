// EdgeOne Pages Edge Function —— /api/* 后端
// 运行在边缘函数（V8）环境：仅使用 Web API（fetch / WebCrypto / Request / Response）
// 数据持久化使用 Pages KV（绑定变量名默认为 KV），不再依赖 SQLite 文件

// 默认代码列表与添加时间规则：与 src/data/mockData.js、src/data/stockData.js、
// src/shared/addedDefaults.js 保持一致（函数独立打包，避免依赖目录外文件）
const defaultFundCodes = [
  '024239', '018147', '017731', '021842',
  '014002', '011730', '005661', '008809',
  '012922', '001407',
  '006373', '519696', '015523', '006443',
  '002811', '010365', '006809', '016246',
  '015566', '017043', '519191', '023350',
  '019484', '007950'
]

const defaultStockCodes = [
  '116.01211', '116.00175', '116.02333', '116.01810',
  '116.09868', '116.02015', '0.300499', '0.002837',
  '0.301018', '1.600875', '116.01133', '1.600584',
  '1.600667', '1.688498', '1.688048', '0.002281',
  '0.300604', '1.688627', '0.002980', '0.002916',
  '1.600176', '0.002080', '116.02382', '0.301486'
]

const DEFAULT_FUND_ADDED_AT = '2026-05-14'
const DEFAULT_STOCK_ADDED_AT = '2026-05-15'
const FALLBACK_MONTHS = 3

function monthsAgo(months, from = new Date()) {
  const date = new Date(from)
  date.setMonth(date.getMonth() - months)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const TYPES = ['fund', 'stock']
const DEFAULT_CODES = { fund: defaultFundCodes, stock: defaultStockCodes }
const DEFAULT_ADDED_AT = { fund: DEFAULT_FUND_ADDED_AT, stock: DEFAULT_STOCK_ADDED_AT }
const LIMITS = { codes: 200, snapshots: 100, changes: 500 }
const COOKIE_NAME = 'sid'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const PBKDF2_ITERATIONS = 120000
const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/
const RATE_LIMIT_MAX = 5
const RATE_WINDOW_MS = 15 * 60 * 1000

const loginAttempts = new Map() // 单个边缘实例内的尽力限流

// ---------- KV 访问 ----------

// 绑定命名空间时设置的变量名会成为运行时全局变量，也兼容注入到 env 的情况
function getKV(env) {
  // 平台会把绑定变量名注入为运行时全局变量（文档示例中直接使用 my_kv）
  if (typeof KV !== 'undefined' && KV && typeof KV.get === 'function') return KV
  if (typeof my_kv !== 'undefined' && my_kv && typeof my_kv.get === 'function') return my_kv
  const candidates = [globalThis.KV, globalThis.my_kv, env && env.KV, env && env.kv]
  return candidates.find(v => v && typeof v.get === 'function' && typeof v.put === 'function') || null
}

async function kvGetJSON(kv, key) {
  let value = null
  try {
    value = await kv.get(key, { type: 'json' })
  } catch {
    const raw = await kv.get(key)
    value = raw ? JSON.parse(raw) : null
  }
  if (typeof value === 'string') {
    try { return JSON.parse(value) } catch { return null }
  }
  return value ?? null
}

function kvPutJSON(kv, key, value) {
  return kv.put(key, JSON.stringify(value))
}

// ---------- 通用工具 ----------

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store',
      ...headers
    }
  })
}

function nowIso() {
  return new Date().toISOString()
}

function cleanString(value, maxLength = 64) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function makeId(prefix) {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${prefix}_${Date.now().toString(36)}_${hex}`
}

function bytesToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(value) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToHex(new Uint8Array(digest))
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function parseCookies(header) {
  const result = {}
  if (!header) return result
  header.split(';').forEach(part => {
    const index = part.indexOf('=')
    if (index < 0) return
    const key = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    if (key) result[key] = decodeURIComponent(value)
  })
  return result
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ---------- 密码 ----------

async function pbkdf2(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256
  )
  return new Uint8Array(bits)
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(hash)}`
}

async function verifyPassword(password, stored) {
  try {
    const [scheme, iterations, saltB64, hashB64] = String(stored).split('$')
    if (scheme !== 'pbkdf2') return false
    const actual = await pbkdf2(password, base64ToBytes(saltB64), Number(iterations))
    return constantTimeEqual(bytesToBase64(actual), hashB64)
  } catch {
    return false
  }
}

function validateUsername(username) {
  if (typeof username !== 'string') return '用户名格式不正确'
  if (!USERNAME_RE.test(username)) return '用户名需为 3–20 位字母、数字或下划线'
  return null
}

function validatePassword(password) {
  if (typeof password !== 'string') return '密码格式不正确'
  if (password.length < 8 || password.length > 72) return '密码长度需为 8–72 位'
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return '密码需同时包含字母和数字'
  return null
}

// ---------- 会话 ----------

const userKey = username => `user_${username.toLowerCase()}`
const uidKey = userId => `uid_${userId}`
const sessionKey = tokenHash => `sess_${tokenHash}`
const portfolioKey = (userId, type) => `pf_${userId}_${type}`

async function createSession(kv, user) {
  const token = randomToken()
  const createdAt = nowIso()
  await kvPutJSON(kv, sessionKey(await sha256Hex(token)), {
    userId: user.id,
    username: user.username,
    createdAt,
    lastSeen: createdAt,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
  })
  return token
}

async function findSession(kv, token) {
  if (!token) return null
  const key = sessionKey(await sha256Hex(token))
  const session = await kvGetJSON(kv, key)
  if (!session) return null
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await kv.delete(key)
    return null
  }
  if (Date.now() - new Date(session.lastSeen).getTime() > 24 * 60 * 60 * 1000) {
    await kvPutJSON(kv, key, {
      ...session,
      lastSeen: nowIso(),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString()
    })
  }
  return { userId: session.userId, username: session.username }
}

function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
}

function clearSessionCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`
}

// 写接口来源校验：只接受同源请求（预览域名与自定义域名均适用）
function isSameOrigin(request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === new URL(request.url).host
  } catch {
    return false
  }
}

// ---------- 数据规范化 ----------

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
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const result = {}
  Object.entries(input).slice(0, LIMITS.codes).forEach(([code, name]) => {
    const cleanCode = cleanString(code, 32)
    const cleanName = cleanString(name, 100)
    if (cleanCode && cleanName) result[cleanCode] = cleanName
  })
  return result
}

function normalizeAddedMeta(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const result = {}
  Object.entries(input).slice(0, LIMITS.codes).forEach(([code, meta]) => {
    const cleanCode = cleanString(code, 32)
    if (!cleanCode || !meta || typeof meta !== 'object') return
    result[cleanCode] = {
      addedAt: typeof meta.addedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(meta.addedAt)
        ? meta.addedAt
        : null,
      basePrice: Number.isFinite(Number(meta.basePrice)) && meta.basePrice != null
        ? Number(meta.basePrice)
        : null,
      basePriceFailedAt: Number.isFinite(Number(meta.basePriceFailedAt)) && meta.basePriceFailedAt != null
        ? Math.trunc(Number(meta.basePriceFailedAt))
        : null
    }
  })
  return result
}

function emptySlice() {
  return { codes: [], info: {}, addedMeta: {} }
}

async function readSlice(kv, userId, type) {
  const value = await kvGetJSON(kv, portfolioKey(userId, type))
  if (!value) return emptySlice()
  return {
    codes: Array.isArray(value.codes) ? value.codes : [],
    info: normalizeInfo(value.info),
    addedMeta: normalizeAddedMeta(value.addedMeta)
  }
}

function seedAddedAt(slice, type) {
  const fallback = monthsAgo(FALLBACK_MONTHS)
  const defaults = new Set(DEFAULT_CODES[type] || [])
  let changed = false
  slice.codes.forEach(code => {
    const meta = slice.addedMeta[code] || {}
    if (meta.addedAt) return
    slice.addedMeta[code] = {
      addedAt: defaults.has(code) ? DEFAULT_ADDED_AT[type] : fallback,
      basePrice: meta.basePrice ?? null,
      basePriceFailedAt: meta.basePriceFailedAt ?? null
    }
    changed = true
  })
  return changed
}

async function readAllSlices(kv, userId, { seed = false } = {}) {
  const slices = {}
  for (const type of TYPES) {
    const slice = await readSlice(kv, userId, type)
    if (seed && seedAddedAt(slice, type)) {
      await kvPutJSON(kv, portfolioKey(userId, type), slice)
    }
    slices[type] = slice
  }
  return slices
}

// ---------- 快照 / 变更记录 ----------

const snapshotsKey = userId => `snap_${userId}`
const changesKey = userId => `chg_${userId}`

async function readSnapshots(kv, userId) {
  const list = await kvGetJSON(kv, snapshotsKey(userId))
  return Array.isArray(list) ? list.slice(0, LIMITS.snapshots) : []
}

async function readChanges(kv, userId) {
  const list = await kvGetJSON(kv, changesKey(userId))
  return Array.isArray(list) ? list.slice(0, LIMITS.changes) : []
}

// ---------- 上游行情代理 ----------

const UPSTREAM_HEADERS = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  referer: 'https://fund.eastmoney.com/'
}

async function proxy(url, contentType) {
  try {
    const response = await fetch(url, { headers: UPSTREAM_HEADERS, redirect: 'follow' })
    const body = await response.text()
    return new Response(body, {
      status: response.status,
      headers: {
        'content-type': contentType || response.headers.get('content-type') || 'text/plain; charset=UTF-8',
        'cache-control': 'no-store'
      }
    })
  } catch (error) {
    return json({ error: 'upstream_failed', message: error?.message || '上游请求失败' }, 502)
  }
}

// ---------- 路由处理 ----------

export async function onRequest(context) {
  const { request, env } = context
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '')
  const method = request.method.toUpperCase()

  // 行情代理（无需登录）
  if (method === 'GET' && path === 'healthz') return json({ ok: true })
  if (method === 'GET' && path === 'fundlist') {
    return proxy('https://fund.eastmoney.com/js/fundcode_search.js', 'application/javascript; charset=UTF-8')
  }
  if (method === 'GET' && path === 'fundgz') {
    return proxy(`http://fundgz.1234567.com.cn/js${url.search}`, 'application/javascript; charset=UTF-8')
  }
  if (method === 'GET' && path.startsWith('fundgz/')) {
    return proxy(`http://fundgz.1234567.com.cn/js/${path.slice('fundgz/'.length)}${url.search}`, 'application/javascript; charset=UTF-8')
  }
  if (method === 'GET' && path.startsWith('pingzhong/')) {
    const code = path.slice('pingzhong/'.length).replace(/\.js$/, '')
    if (!/^\d{6}$/.test(code)) return json({ error: 'invalid_code' }, 400)
    return proxy(`https://fund.eastmoney.com/pingzhongdata/${code}.js?v=${Date.now()}`, 'application/javascript; charset=UTF-8')
  }

  const kv = getKV(env)
  if (!kv) return json({ error: 'storage_unavailable', message: 'KV 未绑定' }, 500)

  // ---------- 认证 ----------

  if (path === 'auth/register' && method === 'POST') {
    if (!isSameOrigin(request)) return json({ error: 'forbidden_origin' }, 403)
    const body = await request.json().catch(() => ({}))
    const username = String(body?.username ?? '').trim()
    const password = String(body?.password ?? '')

    const usernameError = validateUsername(username)
    if (usernameError) return json({ error: 'invalid_username', message: usernameError }, 400)
    const passwordError = validatePassword(password)
    if (passwordError) return json({ error: 'invalid_password', message: passwordError }, 400)

    const existing = await kvGetJSON(kv, userKey(username))
    if (existing) return json({ error: 'username_taken', message: '该用户名已被注册' }, 409)

    const user = {
      id: makeId('u'),
      username,
      passwordHash: await hashPassword(password),
      createdAt: nowIso()
    }
    await kvPutJSON(kv, userKey(username), user)
    await kvPutJSON(kv, uidKey(user.id), { username })

    const token = await createSession(kv, user)
    return json({ user: { id: user.id, username } }, 201, {
      'set-cookie': sessionCookie(token)
    })
  }

  if (path === 'auth/login' && method === 'POST') {
    if (!isSameOrigin(request)) return json({ error: 'forbidden_origin' }, 403)
    const body = await request.json().catch(() => ({}))
    const username = String(body?.username ?? '').trim()
    const password = String(body?.password ?? '')
    if (!username || !password) return json({ error: 'invalid_input', message: '请输入用户名和密码' }, 400)

    const rateKey = `${request.headers.get('x-forwarded-for') || 'unknown'}|${username.toLowerCase()}`
    const now = Date.now()
    const recent = (loginAttempts.get(rateKey) || []).filter(t => now - t < RATE_WINDOW_MS)
    if (recent.length >= RATE_LIMIT_MAX) {
      return json({ error: 'too_many_attempts', message: '登录尝试过于频繁，请稍后再试' }, 429)
    }

    const user = await kvGetJSON(kv, userKey(username))
    const ok = user ? await verifyPassword(password, user.passwordHash) : false
    if (!ok) {
      recent.push(now)
      loginAttempts.set(rateKey, recent)
      return json({ error: 'invalid_credentials', message: '用户名或密码错误' }, 401)
    }

    loginAttempts.delete(rateKey)
    const token = await createSession(kv, user)
    return json({ user: { id: user.id, username: user.username } }, 200, {
      'set-cookie': sessionCookie(token)
    })
  }

  // 以下接口需要登录
  const cookies = parseCookies(request.headers.get('cookie'))
  const token = cookies[COOKIE_NAME] || null
  const session = await findSession(kv, token)

  if (path === 'auth/logout' && method === 'POST') {
    if (token) await kv.delete(sessionKey(await sha256Hex(token)))
    return json({ ok: true }, 200, { 'set-cookie': clearSessionCookie() })
  }

  if (path === 'auth/me' && method === 'GET') {
    return json({ user: session ? { id: session.userId, username: session.username } : null })
  }

  if (!session) return json({ error: 'unauthorized' }, 401)
  const userId = session.userId

  // ---------- 持仓 ----------

  if (path === 'portfolio' && method === 'GET') {
    const slices = await readAllSlices(kv, userId, { seed: true })
    return json({
      lists: { fund: slices.fund.codes, stock: slices.stock.codes },
      info: { fund: slices.fund.info, stock: slices.stock.info },
      addedMeta: { fund: slices.fund.addedMeta, stock: slices.stock.addedMeta }
    })
  }

  if (path.startsWith('portfolio/') && method === 'PUT') {
    if (!isSameOrigin(request)) return json({ error: 'forbidden_origin' }, 403)
    const type = path.slice('portfolio/'.length)
    if (!TYPES.includes(type)) return json({ error: 'invalid_type' }, 400)
    const body = await request.json().catch(() => ({}))
    const codes = normalizeCodes(body?.codes)
    if (!codes) return json({ error: 'invalid_codes', message: 'codes 必须为数组' }, 400)

    await kvPutJSON(kv, portfolioKey(userId, type), {
      codes,
      info: normalizeInfo(body?.info),
      addedMeta: normalizeAddedMeta(body?.addedMeta)
    })
    return json({ ok: true, count: codes.length })
  }

  // ---------- 快照 ----------

  if (path === 'snapshots' && method === 'GET') {
    return json({ snapshots: await readSnapshots(kv, userId) })
  }

  if (path === 'snapshots' && method === 'POST') {
    if (!isSameOrigin(request)) return json({ error: 'forbidden_origin' }, 403)
    const body = await request.json().catch(() => ({}))
    const snapshot = {
      id: makeId('snap'),
      savedAt: nowIso(),
      note: cleanString(body?.note, 200),
      funds: Array.isArray(body?.funds) ? body.funds : [],
      stocks: Array.isArray(body?.stocks) ? body.stocks : []
    }
    const list = await readSnapshots(kv, userId)
    list.unshift(snapshot)
    await kvPutJSON(kv, snapshotsKey(userId), list.slice(0, LIMITS.snapshots))
    return json({ snapshot }, 201)
  }

  if (path === 'snapshots' && method === 'DELETE') {
    if (!isSameOrigin(request)) return json({ error: 'forbidden_origin' }, 403)
    await kvPutJSON(kv, snapshotsKey(userId), [])
    return json({ ok: true })
  }

  if (path.startsWith('snapshots/')) {
    if (!isSameOrigin(request)) return json({ error: 'forbidden_origin' }, 403)
    const id = decodeURIComponent(path.slice('snapshots/'.length))
    const list = await readSnapshots(kv, userId)

    if (method === 'PATCH') {
      const body = await request.json().catch(() => ({}))
      const target = list.find(item => item.id === id)
      if (!target) return json({ error: 'not_found' }, 404)
      target.note = cleanString(body?.note, 200)
      await kvPutJSON(kv, snapshotsKey(userId), list)
      return json({ ok: true })
    }

    if (method === 'DELETE') {
      await kvPutJSON(kv, snapshotsKey(userId), list.filter(item => item.id !== id))
      return json({ ok: true })
    }
  }

  // ---------- 变更记录 ----------

  if (path === 'changes' && method === 'GET') {
    return json({ changes: await readChanges(kv, userId) })
  }

  if (path === 'changes' && method === 'POST') {
    if (!isSameOrigin(request)) return json({ error: 'forbidden_origin' }, 403)
    const body = await request.json().catch(() => ({}))
    const type = body?.type
    const action = cleanString(body?.action, 20)
    if (!TYPES.includes(type) || !action) return json({ error: 'invalid_change' }, 400)

    const record = {
      id: makeId('chg'),
      at: nowIso(),
      type,
      action,
      code: cleanString(body?.code, 32) || null,
      name: cleanString(body?.name, 100) || null,
      from: Number.isInteger(body?.from) ? body.from : null,
      to: Number.isInteger(body?.to) ? body.to : null
    }
    const list = await readChanges(kv, userId)
    list.unshift(record)
    await kvPutJSON(kv, changesKey(userId), list.slice(0, LIMITS.changes))
    return json({ change: record }, 201)
  }

  if (path === 'changes' && method === 'DELETE') {
    if (!isSameOrigin(request)) return json({ error: 'forbidden_origin' }, 403)
    await kvPutJSON(kv, changesKey(userId), [])
    return json({ ok: true })
  }

  // ---------- 导出 / 导入 ----------

  if (path === 'export' && method === 'GET') {
    const slices = await readAllSlices(kv, userId)
    return json({
      version: 2,
      exportedAt: nowIso(),
      lists: { fund: slices.fund.codes, stock: slices.stock.codes },
      info: { fund: slices.fund.info, stock: slices.stock.info },
      addedMeta: { fund: slices.fund.addedMeta, stock: slices.stock.addedMeta },
      snapshots: await readSnapshots(kv, userId),
      changes: await readChanges(kv, userId)
    })
  }

  if (path === 'import' && method === 'POST') {
    if (!isSameOrigin(request)) return json({ error: 'forbidden_origin' }, 403)
    const body = await request.json().catch(() => ({}))
    const mode = body?.mode === 'replace' ? 'replace' : 'merge'
    const data = body?.data
    if (!data || typeof data !== 'object') {
      return json({ error: 'invalid_data', message: '缺少导入数据' }, 400)
    }

    const counts = { fund: 0, stock: 0, info: { fund: 0, stock: 0 }, snapshots: 0, changes: 0 }
    const slices = await readAllSlices(kv, userId)

    for (const type of TYPES) {
      const incomingCodes = normalizeCodes(data?.lists?.[type]) || []
      const incomingInfo = normalizeInfo(data?.info?.[type])
      const incomingMeta = normalizeAddedMeta(data?.addedMeta?.[type])
      const current = mode === 'replace' ? emptySlice() : slices[type]
      const existing = new Set(current.codes)

      if (mode === 'replace') {
        current.codes = incomingCodes
        current.info = incomingInfo
        current.addedMeta = incomingMeta
        counts[type] = incomingCodes.length
        counts.info[type] = Object.keys(incomingInfo).length
      } else {
        incomingCodes.forEach(code => {
          if (existing.has(code)) return
          current.codes.push(code)
          existing.add(code)
          counts[type] += 1
        })
        Object.entries(incomingInfo).forEach(([code, name]) => {
          if (!current.info[code]) {
            current.info[code] = name
            counts.info[type] += 1
          }
        })
        Object.entries(incomingMeta).forEach(([code, meta]) => {
          const target = current.addedMeta[code] || { addedAt: null, basePrice: null, basePriceFailedAt: null }
          current.addedMeta[code] = {
            addedAt: target.addedAt || meta.addedAt || null,
            basePrice: target.basePrice ?? meta.basePrice ?? null,
            basePriceFailedAt: target.basePriceFailedAt ?? meta.basePriceFailedAt ?? null
          }
        })
      }

      await kvPutJSON(kv, portfolioKey(userId, type), current)
    }

    const existingSnapshots = mode === 'replace' ? [] : await readSnapshots(kv, userId)
    const snapshotIds = new Set(existingSnapshots.map(item => item.id))
    const importedSnapshots = (Array.isArray(data?.snapshots) ? data.snapshots : [])
      .slice(0, LIMITS.snapshots)
      .filter(item => {
        const id = cleanString(item?.id, 64)
        if (!id || snapshotIds.has(id)) return false
        snapshotIds.add(id)
        item.id = id
        item.savedAt = cleanString(item?.savedAt, 40) || nowIso()
        item.note = cleanString(item?.note, 200)
        item.funds = Array.isArray(item?.funds) ? item.funds : []
        item.stocks = Array.isArray(item?.stocks) ? item.stocks : []
        return true
      })
    counts.snapshots = importedSnapshots.length
    const mergedSnapshots = [...importedSnapshots, ...existingSnapshots]
      .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))
      .slice(0, LIMITS.snapshots)
    await kvPutJSON(kv, snapshotsKey(userId), mergedSnapshots)

    const existingChanges = mode === 'replace' ? [] : await readChanges(kv, userId)
    const changeIds = new Set(existingChanges.map(item => item.id))
    const importedChanges = (Array.isArray(data?.changes) ? data.changes : [])
      .slice(0, LIMITS.changes)
      .filter(item => {
        const id = cleanString(item?.id, 64)
        if (!id || changeIds.has(id) || !TYPES.includes(item?.type) || !cleanString(item?.action, 20)) return false
        changeIds.add(id)
        return true
      })
    counts.changes = importedChanges.length
    const mergedChanges = [...importedChanges, ...existingChanges]
      .sort((a, b) => String(b.at).localeCompare(String(a.at)))
      .slice(0, LIMITS.changes)
    await kvPutJSON(kv, changesKey(userId), mergedChanges)

    return json({ ok: true, mode, counts })
  }

  return json({ error: 'not_found' }, 404)
}
