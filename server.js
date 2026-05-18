import express from 'express';
import pkg from 'stock-api';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const { stocks } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const PORT = isProduction ? 3000 : 3001;

app.use(cors());
app.use(express.json());

if (isProduction) {
  app.use(express.static(path.join(__dirname, 'dist')));
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
  app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
});
