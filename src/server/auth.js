// 认证模块 - 注册 / 登录 / 登出 / 会话校验
// 方案：开放注册（用户名唯一 + 密码强度校验），scrypt 哈希，httpOnly Cookie 保存会话 token
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import express from 'express'
import { db } from './db.js'

const scrypt = promisify(crypto.scrypt)

const COOKIE_NAME = 'sid'
export const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) || 30
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 }

// 登录失败限流（按 IP + 用户名）
const RATE_LIMIT_MAX = Number(process.env.LOGIN_RATE_LIMIT) || 5
const RATE_WINDOW_MS = (Number(process.env.LOGIN_RATE_WINDOW_MIN) || 15) * 60 * 1000
const loginAttempts = new Map()

function nowIso() {
  return new Date().toISOString()
}

// ---------- 密码 ----------

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16)
  const { N, r, p, keylen } = SCRYPT_PARAMS
  const hash = await scrypt(password, salt, keylen, { N, r, p })
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, n, r, p, saltB64, hashB64] = String(stored).split('$')
    if (scheme !== 'scrypt') return false
    const salt = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(hashB64, 'base64')
    const actual = await scrypt(password, salt, expected.length, {
      N: Number(n), r: Number(r), p: Number(p)
    })
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function validateUsername(username) {
  if (typeof username !== 'string') return '用户名格式不正确'
  if (!USERNAME_RE.test(username)) return '用户名需为 3–20 位字母、数字或下划线'
  return null
}

export function validatePassword(password) {
  if (typeof password !== 'string') return '密码格式不正确'
  if (password.length < 8 || password.length > 72) return '密码长度需为 8–72 位'
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return '密码需同时包含字母和数字'
  return null
}

// ---------- 会话 ----------

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function parseCookies(header) {
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

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url')
  const createdAt = nowIso()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString()
  db.prepare(
    'INSERT INTO sessions (id_hash, user_id, created_at, expires_at, last_seen) VALUES (?, ?, ?, ?, ?)'
  ).run(sha256(token), userId, createdAt, expiresAt, createdAt)
  return token
}

function findSession(token) {
  if (!token) return null
  const row = db.prepare(`
    SELECT s.id_hash AS idHash, s.expires_at AS expiresAt, s.last_seen AS lastSeen,
           u.id AS userId, u.username AS username
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.id_hash = ?
  `).get(sha256(token))

  if (!row) return null
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(row.idHash)
    return null
  }

  // 滑动续期：每天最多写一次，减少磁盘写入
  if (Date.now() - new Date(row.lastSeen).getTime() > 24 * 60 * 60 * 1000) {
    db.prepare('UPDATE sessions SET last_seen = ?, expires_at = ? WHERE id_hash = ?')
      .run(nowIso(), new Date(Date.now() + SESSION_TTL_MS).toISOString(), row.idHash)
  }

  return { userId: row.userId, username: row.username }
}

function destroySession(token) {
  if (!token) return
  db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(sha256(token))
}

function cleanupExpiredSessions() {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso())
}

export function setSessionCookie(req, res, token) {
  const secure = (process.env.APP_ORIGIN || '').startsWith('https://') || req.secure
  const parts = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
  ]
  if (secure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`)
}

// 会话中间件：解析 Cookie 并挂载 req.user（未登录时为 null）
export function attachSession(req, res, next) {
  const cookies = parseCookies(req.headers.cookie)
  req.sessionToken = cookies[COOKIE_NAME] || null
  req.user = findSession(req.sessionToken)
  next()
}

// 需要登录的接口
export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' })
  next()
}

// 写接口来源校验：配置 APP_ORIGIN 后拒绝跨站写请求（本地开发不配置则跳过）
export function requireSameOrigin(req, res, next) {
  const allowed = process.env.APP_ORIGIN
  if (!allowed) return next()
  const origin = req.headers.origin
  if (origin && origin !== allowed) {
    return res.status(403).json({ error: 'forbidden_origin' })
  }
  next()
}

// ---------- 限流 ----------

function rateKey(req, username) {
  return `${req.ip || req.socket.remoteAddress || 'unknown'}|${String(username).toLowerCase()}`
}

function isRateLimited(key) {
  const now = Date.now()
  const list = (loginAttempts.get(key) || []).filter(t => now - t < RATE_WINDOW_MS)
  loginAttempts.set(key, list)
  return list.length >= RATE_LIMIT_MAX
}

function markFailure(key) {
  const now = Date.now()
  const list = (loginAttempts.get(key) || []).filter(t => now - t < RATE_WINDOW_MS)
  list.push(now)
  loginAttempts.set(key, list)
}

// ---------- 路由 ----------

export function createAuthRouter() {
  const router = express.Router()

  router.post('/register', requireSameOrigin, async (req, res) => {
    const username = String(req.body?.username ?? '').trim()
    const password = String(req.body?.password ?? '')

    const usernameError = validateUsername(username)
    if (usernameError) return res.status(400).json({ error: 'invalid_username', message: usernameError })

    const passwordError = validatePassword(password)
    if (passwordError) return res.status(400).json({ error: 'invalid_password', message: passwordError })

    const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (exists) return res.status(409).json({ error: 'username_taken', message: '该用户名已被注册' })

    const passwordHash = await hashPassword(password)
    let userId
    try {
      const info = db.prepare(
        'INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)'
      ).run(username, passwordHash, nowIso())
      userId = Number(info.lastInsertRowid)
    } catch (error) {
      // 并发注册同名用户时唯一索引兜底
      if (String(error?.message || '').includes('UNIQUE')) {
        return res.status(409).json({ error: 'username_taken', message: '该用户名已被注册' })
      }
      throw error
    }

    cleanupExpiredSessions()
    setSessionCookie(req, res, createSession(userId))
    res.status(201).json({ user: { id: userId, username } })
  })

  router.post('/login', requireSameOrigin, async (req, res) => {
    const username = String(req.body?.username ?? '').trim()
    const password = String(req.body?.password ?? '')
    if (!username || !password) {
      return res.status(400).json({ error: 'invalid_input', message: '请输入用户名和密码' })
    }

    const key = rateKey(req, username)
    if (isRateLimited(key)) {
      return res.status(429).json({ error: 'too_many_attempts', message: '登录尝试过于频繁，请稍后再试' })
    }

    const user = db.prepare('SELECT id, username, password_hash AS passwordHash FROM users WHERE username = ?')
      .get(username)
    const ok = user ? await verifyPassword(password, user.passwordHash) : false
    if (!ok) {
      markFailure(key)
      return res.status(401).json({ error: 'invalid_credentials', message: '用户名或密码错误' })
    }

    loginAttempts.delete(key)
    cleanupExpiredSessions()
    setSessionCookie(req, res, createSession(user.id))
    res.json({ user: { id: user.id, username: user.username } })
  })

  router.post('/logout', (req, res) => {
    destroySession(req.sessionToken)
    clearSessionCookie(res)
    res.json({ ok: true })
  })

  router.get('/me', (req, res) => {
    res.json({ user: req.user ? { id: req.user.userId, username: req.user.username } : null })
  })

  return router
}
