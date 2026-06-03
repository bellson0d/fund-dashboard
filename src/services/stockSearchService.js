// 股票模糊搜索服务 - 浏览器端直调 stock-sdk
// 支持中文名称 / 拼音 / 代码搜索，覆盖 A股 / 港股 / 美股
import { StockSDK } from 'stock-sdk'

const sdk = new StockSDK({ timeout: 15000 })

export async function searchStocks(keyword) {
  if (!keyword || keyword.trim().length === 0) {
    return []
  }

  try {
    const results = await sdk.search(keyword.trim())

    return results
      .filter(r => r.category === 'stock')
      .map(stock => {
        const { code, name, market } = stock

        // stock-sdk 格式 -> 项目内部格式
        // sh600519 → 1.600519, sz000858 → 0.000858
        // hk00700 → 116.00700, usAAPL → 105.AAPL
        let internalCode = ''
        let marketType = 'a'
        let rawCode = ''

        if (market === 'sh') {
          rawCode = code.replace(/^sh/, '')
          internalCode = `1.${rawCode}`
          marketType = rawCode.startsWith('68') ? 'a-kcb' : 'a-sh'
        } else if (market === 'sz') {
          rawCode = code.replace(/^sz/, '')
          internalCode = `0.${rawCode}`
          marketType = rawCode.startsWith('30') ? 'a-chinext' : 'a-sz'
        } else if (market === 'bj') {
          rawCode = code.replace(/^bj/, '')
          internalCode = `1.${rawCode}`
          marketType = 'a-bj'
        } else if (market === 'hk') {
          rawCode = code.replace(/^hk/, '')
          internalCode = `116.${rawCode}`
          marketType = 'hk'
        } else if (market === 'us') {
          rawCode = code.replace(/^us/, '')
          internalCode = `105.${rawCode}`
          marketType = 'us'
        } else {
          rawCode = code
          internalCode = code
        }

        return {
          code: internalCode,
          name: name || '',
          rawCode,
          symbol: code,
          market: marketType,
          secid: internalCode
        }
      })
  } catch (error) {
    console.error('Failed to search stocks:', error)
    return []
  }
}
