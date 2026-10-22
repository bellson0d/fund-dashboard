// 生产环境 Express 服务
// - 托管前端构建产物（根路径 /）
// - 基金行情代理（绕过跨域限制）
// - 登录注册 + SQLite 持久化 API
import express from 'express'
import cors from 'cors'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { db } from './src/server/db.js'
import { attachSession, createAuthRouter } from './src/server/auth.js'
import { createDataRouter } from './src/server/data.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const isProduction = process.env.NODE_ENV === 'production'
const PORT = Number(process.env.PORT) || (isProduction ? 3000 : 3001)

// 平台通常经反向代理转发请求：信任一层代理，获取真实 IP 与 https 协议
app.set('trust proxy', 1)
// 后端不再对外提供跨域 Cookie 接口，仅行情代理保留宽松 CORS
app.use(cors())
app.use(express.json({ limit: '10mb' }))

// ---------- 行情代理 ----------

// 天天基金实时估值 API
app.use('/api/fundgz', createProxyMiddleware({
  target: 'http://fundgz.1234567.com.cn',
  changeOrigin: true,
  pathRewrite: (path) => '/js' + path
}))

// 东方财富基金持仓品种数据 API
app.use('/api/pingzhong', createProxyMiddleware({
  target: 'https://fund.eastmoney.com',
  changeOrigin: true,
  pathRewrite: (path) => '/pingzhongdata' + path
}))

// 东方财富基金代码列表 API
// 注意：上游会把 http 重定向到 https，必须直连 https 并跟随重定向，
// 否则 301 会被转发给浏览器，跨域跟随跳转会被 CORS 拦截导致 fetch 失败
app.use('/api/fundlist', createProxyMiddleware({
  target: 'https://fund.eastmoney.com',
  changeOrigin: true,
  followRedirects: true,
  pathRewrite: (path) => '/js/fundcode_search.js'
}))

// ---------- 健康检查（免认证，供平台探针使用） ----------

app.get('/api/healthz', (req, res) => {
  try {
    db.prepare('SELECT 1').get()
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message || 'db_error' })
  }
})

// ---------- 业务 API ----------

app.use('/api/auth', attachSession, createAuthRouter())
app.use('/api', attachSession, createDataRouter())

// 未匹配的 API 请求返回 JSON，避免落到 SPA 的 HTML
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'not_found' })
  }
  next()
})

// ---------- 静态资源 ----------

// 旧版路径 /fund-dashboard/* 永久重定向到根路径，保证旧书签可用
app.use((req, res, next) => {
  if (req.path === '/fund-dashboard' || req.path.startsWith('/fund-dashboard/')) {
    const target = req.originalUrl.replace(/^\/fund-dashboard/, '') || '/'
    return res.redirect(301, target)
  }
  next()
})

const distDir = path.join(__dirname, 'dist')

if (isProduction) {
  app.use(express.static(distDir, {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath)
      if (ext === '.js' || ext === '.css') {
        // Vite 构建产物带 content hash，可永久缓存
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
      } else if (ext === '.html') {
        // HTML 可能更新，每次验证
        res.setHeader('Cache-Control', 'no-cache')
      } else if (ext === '.svg' || ext === '.png' || ext === '.ico' || ext === '.woff2') {
        res.setHeader('Cache-Control', 'public, max-age=604800')
      }
    }
  }))

  // HashRouter 下所有前端路由都在 # 之后，兜底统一返回 index.html
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next()
    if (req.path.startsWith('/api/')) return next()
    const indexFile = path.join(distDir, 'index.html')
    if (!fs.existsSync(indexFile)) return next()
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(indexFile)
  })
}

// 统一错误响应：避免把堆栈直接暴露给前端
app.use((error, req, res, next) => {
  console.error('[server error]', error)
  if (res.headersSent) return next(error)
  res.status(500).json({ error: 'internal_error' })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`Environment: ${isProduction ? 'production' : 'development'}`)
})
