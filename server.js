// 生产环境 Express 服务
// - 托管前端构建产物 (dist/)
// - 代理基金数据 API（绕过跨域限制）
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = isProduction ? 3000 : 3001;

app.use(cors());

// 天天基金实时估值 API
app.use('/api/fundgz', createProxyMiddleware({
  target: 'http://fundgz.1234567.com.cn',
  changeOrigin: true,
  pathRewrite: (path) => '/js' + path
}));

// 东方财富基金持仓品种数据 API
app.use('/api/pingzhong', createProxyMiddleware({
  target: 'https://fund.eastmoney.com',
  changeOrigin: true,
  pathRewrite: (path) => '/pingzhongdata' + path
}));

// 东方财富基金代码列表 API
// 注意：上游会把 http 重定向到 https，必须直连 https 并跟随重定向，
// 否则 301 会被转发给浏览器，跨域跟随跳转会被 CORS 拦截导致 fetch 失败
app.use('/api/fundlist', createProxyMiddleware({
  target: 'https://fund.eastmoney.com',
  changeOrigin: true,
  followRedirects: true,
  pathRewrite: (path) => '/js/fundcode_search.js'
}));

// 托管前端静态资源（带强缓存策略：hash 文件永久缓存，HTML 每次验证）
if (isProduction) {
  app.use('/fund-dashboard', express.static(path.join(__dirname, 'dist'), {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath);
      if (ext === '.js' || ext === '.css') {
        // Vite 构建产物带 content hash，可永久缓存
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (ext === '.html') {
        // HTML 可能更新，每次验证
        res.setHeader('Cache-Control', 'no-cache');
      } else if (ext === '.svg' || ext === '.png' || ext === '.ico' || ext === '.woff2') {
        // 图片/字体 - 缓存一周
        res.setHeader('Cache-Control', 'public, max-age=604800');
      }
    }
  }));
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
});
