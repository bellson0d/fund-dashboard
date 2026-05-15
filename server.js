import express from 'express';
import pkg from 'stock-api';
import cors from 'cors';

const { stocks } = pkg;

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

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

app.listen(PORT, () => {
  console.log(`Stock search API server running on http://localhost:${PORT}`);
});
