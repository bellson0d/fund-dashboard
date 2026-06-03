// 真实数据服务
// - 基金：通过服务端代理获取天天基金/东方财富数据
// - 股票：浏览器端直调 stock-sdk 获取 A股/港股/美股行情
import { StockSDK } from 'stock-sdk'

const stockSDK = new StockSDK({ timeout: 15000 })

export async function fetchFundRealData(fundCode) {
  try {
    const timestamp = Date.now()
    
    const [gzData, pingzhongData] = await Promise.all([
      fetchFundGzData(fundCode, timestamp),
      fetchPingzhongData(fundCode, timestamp)
    ])
    
    if (!gzData) return null
    
    return {
      code: fundCode,
      name: gzData.name || '未知基金',
      netValue: parseFloat(gzData.dwjz) || 1.0,
      change: parseFloat(gzData.gszzl) || 0,
      holdings: pingzhongData || []
    }
  } catch (error) {
    console.error('Failed to fetch real fund data:', error)
    return null
  }
}

async function fetchFundGzData(fundCode, timestamp) {
  try {
    const url = `/api/fundgz/${fundCode}.js?rt=${timestamp}`
    const response = await fetch(url)
    const text = await response.text()
    
    const match = text.match(/jsonpgz\((.*)\)/)
    if (match) {
      return JSON.parse(match[1])
    }
  } catch (error) {
    console.error('Failed to fetch fund gz data:', error)
  }
  return null
}

async function fetchPingzhongData(fundCode, timestamp) {
  try {
    const url = `/api/pingzhong/${fundCode}.js?v=${timestamp}`
    const response = await fetch(url)
    const text = await response.text()
    
    const holdings = []
    
    const stockCodesMatch = text.match(/stockCodes\s*=\s*\[([^\]]+)\]/)
    const stockCodesNewMatch = text.match(/stockCodesNew\s*=\s*\[([^\]]+)\]/)
    const zqCodesMatch = text.match(/zqCodes\s*=\s*["']([^"']+)["']/)
    const zqCodesNewMatch = text.match(/zqCodesNew\s*=\s*["']([^"']+)["']/)
    const stockNamesMatch = text.match(/stockNames\s*=\s*["']([^"']+)["']/)
    const stockRatiosMatch = text.match(/stockRatios\s*=\s*["']([^"']+)["']/)
    const zqNamesMatch = text.match(/zqNames\s*=\s*["']([^"']+)["']/)
    const zqRatiosMatch = text.match(/zqRatios\s*=\s*["']([^"']+)["']/)

    const stockNames = stockNamesMatch ? stockNamesMatch[1].split(',') : []
    const stockRatios = stockRatiosMatch ? stockRatiosMatch[1].split(',').map(r => parseFloat(r)) : []
    const zqNames = zqNamesMatch ? zqNamesMatch[1].split(',') : []
    const zqRatios = zqRatiosMatch ? zqRatiosMatch[1].split(',').map(r => parseFloat(r)) : []

    if (stockCodesNewMatch) {
      const codes = stockCodesNewMatch[1]
        .replace(/["'\s]/g, '')
        .split(',')
        .filter(Boolean)
      
      codes.slice(0, 10).forEach((code, index) => {
        holdings.push({
          code: code,
          name: stockNames[index] || `股票${index + 1}`,
          ratio: stockRatios[index] || 0,
          change: 0,
          type: 'stock'
        })
      })
    } else if (stockCodesMatch) {
      const codes = stockCodesMatch[1]
        .replace(/["'\s]/g, '')
        .split(',')
        .filter(Boolean)
      
      codes.slice(0, 10).forEach((code, index) => {
        const cleanCode = code.replace(/[01]$/, '')
        holdings.push({
          code: getMarketPrefix(cleanCode) + cleanCode,
          name: stockNames[index] || `股票${index + 1}`,
          ratio: stockRatios[index] || 0,
          change: 0,
          type: 'stock'
        })
      })
    }

    if (zqCodesNewMatch && holdings.length < 10) {
      const zqCodes = zqCodesNewMatch[1]
        .replace(/["'\s]/g, '')
        .split(',')
        .filter(Boolean)
      
      zqCodes.slice(0, Math.min(10 - holdings.length, zqCodes.length)).forEach((code, index) => {
        holdings.push({
          code: code,
          name: zqNames[index] || `债券${index + 1}`,
          ratio: zqRatios[index] || 0,
          change: 0,
          type: 'bond'
        })
      })
    } else if (zqCodesMatch && holdings.length < 10) {
      const zqCodes = zqCodesMatch[1]
        .replace(/["'\s]/g, '')
        .split(',')
        .filter(Boolean)
      
      zqCodes.slice(0, Math.min(10 - holdings.length, zqCodes.length)).forEach((code, index) => {
        holdings.push({
          code: getMarketPrefix(code) + code,
          name: zqNames[index] || `债券${index + 1}`,
          ratio: zqRatios[index] || 0,
          change: 0,
          type: 'bond'
        })
      })
    }

    return holdings
  } catch (error) {
    console.error('Failed to fetch pingzhong data:', error)
  }
  return []
}

function getMarketPrefix(code) {
  if (!code || typeof code !== 'string') return '0.'
  
  const cleanCode = code.replace(/^[01]\./, '')
  
  if (cleanCode.startsWith('6')) return '1.'
  if (cleanCode.startsWith('0') || cleanCode.startsWith('2')) return '0.'
  if (cleanCode.startsWith('3')) return '0.'
  if (cleanCode.startsWith('68')) return '1.'
  if (cleanCode.startsWith('11')) return '1.'
  if (cleanCode.startsWith('12')) return '0.'
  if (cleanCode.startsWith('BJ') || cleanCode.startsWith('bj')) return '1.'
  return '0.'
}

// 通过 stock-sdk 批量获取股票行情（A股 / 港股 / 美股）
export async function batchFetchStockData(codes) {
  if (!codes || codes.length === 0) return {}

  const result = {}

  // 按市场分组，转换内部格式 -> stock-sdk 格式
  const aShareSdkCodes = []   // ['sz000858', 'sh600519']
  const aShareOrigCodes = []  // ['0.000858', '1.600519']
  const hkCodes = []          // ['00700']
  const hkOrigCodes = []      // ['116.00700']
  const usCodes = []          // ['AAPL']
  const usOrigCodes = []      // ['105.AAPL']

  codes.forEach(code => {
    if (code.startsWith('116.')) {
      hkCodes.push(code.replace('116.', ''))
      hkOrigCodes.push(code)
    } else if (code.startsWith('105.')) {
      usCodes.push(code.replace('105.', ''))
      usOrigCodes.push(code)
    } else {
      const clean = code.replace(/^[01]\./, '')
      let sdkCode
      if (clean.startsWith('6')) {
        sdkCode = `sh${clean}`
      } else {
        sdkCode = `sz${clean}`
      }
      aShareSdkCodes.push(sdkCode)
      aShareOrigCodes.push(code)
    }
  })

  // A股批量行情
  if (aShareSdkCodes.length > 0) {
    try {
      const quotes = await stockSDK.getSimpleQuotes(aShareSdkCodes)
      quotes.forEach((q, i) => {
        if (q && q.code) {
          result[aShareOrigCodes[i]] = {
            code: aShareOrigCodes[i],
            name: q.name || aShareOrigCodes[i],
            price: q.price || 0,
            changePercent: q.changePercent || 0
          }
        }
      })
    } catch (e) {
      console.error('A-share batch failed:', e.message)
    }
  }

  // 港股批量行情
  if (hkCodes.length > 0) {
    try {
      const quotes = await stockSDK.getHKQuotes(hkCodes)
      quotes.forEach((q, i) => {
        if (q && q.code) {
          result[hkOrigCodes[i]] = {
            code: hkOrigCodes[i],
            name: q.name || hkOrigCodes[i],
            price: q.price || 0,
            changePercent: q.changePercent || 0
          }
        }
      })
    } catch (e) {
      console.error('HK batch failed:', e.message)
    }
  }

  // 美股批量行情
  if (usCodes.length > 0) {
    try {
      const quotes = await stockSDK.getUSQuotes(usCodes)
      quotes.forEach((q, i) => {
        if (q && q.code) {
          result[usOrigCodes[i]] = {
            code: usOrigCodes[i],
            name: q.name || usOrigCodes[i],
            price: q.price || 0,
            changePercent: q.changePercent || 0
          }
        }
      })
    } catch (e) {
      console.error('US batch failed:', e.message)
    }
  }

  return result
}
