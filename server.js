import express from 'express';
import pkg from 'stock-api';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createProxyMiddleware } from 'http-proxy-middleware';

const { stocks } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = isProduction ? 3000 : 3001;

app.use(cors());
app.use(express.json());

// API代理配置
app.use('/api/fundgz', createProxyMiddleware({
  target: 'http://fundgz.1234567.com.cn',
  changeOrigin: true,
  pathRewrite: (path) => '/js' + path
}));

app.use('/api/pingzhong', createProxyMiddleware({
  target: 'https://fund.eastmoney.com',
  changeOrigin: true,
  pathRewrite: (path) => '/pingzhongdata' + path
}));

app.use('/api/stock', createProxyMiddleware({
  target: 'http://push2.eastmoney.com',
  changeOrigin: true,
  pathRewrite: (path) => '/api/qt/stock/get' + path
}));

app.use('/api/fundlist', createProxyMiddleware({
  target: 'http://fund.eastmoney.com',
  changeOrigin: true,
  pathRewrite: (path) => '/js/fundcode_search.js'
}));

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

app.post('/api/search-stocks', async (req, res) => {
  const { query } = req.body;

  if (!query || query.trim() === '') {
    return res.json([]);
  }

  try {
    const results = await stocks.sina.searchStocks(query.trim());
    
    const formattedResults = results.map(stock => {
      const code = stock.code || '';
      let marketPrefix = '0.';
      let marketType = 'a';
      
      if (code.includes('SZ')) {
        marketPrefix = '0.';
        marketType = 'a-sz';
      } else if (code.includes('SH')) {
        marketPrefix = '1.';
        marketType = 'a-sh';
      } else if (code.includes('HK')) {
        marketPrefix = '116.';
        marketType = 'hk';
      } else if (code.includes('US')) {
        marketPrefix = '105.';
        marketType = 'us';
      }
      
      const rawCode = code.replace(/^(SZ|SH|HK|US)/, '');
      
      return {
        code: `${marketPrefix}${rawCode}`,
        name: stock.name || '',
        rawCode: rawCode,
        symbol: code,
        market: marketType,
        secid: `${marketPrefix}${rawCode}`
      };
    });
    
    res.json(formattedResults);
  } catch (error) {
    console.error('Stock search failed:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

if (isProduction) {
  app.get('/{*splat}', (req, res, next) => {
    if (req.path.startsWith('/assets/') || req.path.match(/\.(js|css|ico|png|jpg|svg)$/)) {
      return next();
    }
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
});
