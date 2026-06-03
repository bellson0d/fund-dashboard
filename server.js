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
app.use(express.json());

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
app.use('/api/fundlist', createProxyMiddleware({
  target: 'http://fund.eastmoney.com',
  changeOrigin: true,
  pathRewrite: (path) => '/js/fundcode_search.js'
}));

// 托管前端静态资源
if (isProduction) {
  app.use('/fund-dashboard', express.static(path.join(__dirname, 'dist'), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript');
      } else if (filePath.endsWith('.css')) {
        res.setHeader('Content-Type', 'text/css');
      }
    }
  }));
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
});
