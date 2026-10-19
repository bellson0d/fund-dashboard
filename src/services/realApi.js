// 真实数据服务
// - 基金：浏览器端直调 stock-sdk 获取净值/持仓数据
// - 股票：浏览器端直调 stock-sdk 获取 A股/港股/美股行情
import { StockSDK } from 'stock-sdk'
import { createLimiter } from './concurrency'

const stockSDK = new StockSDK({ timeout: 15000 })

// 持仓文件请求限流：东财按基金代码分文件无法合并，用限流器控制并发
const limitHoldings = createLimiter(4)

// 批量获取基金净值/名称/涨跌 + 持仓
// - 净值/名称/涨跌：一次批量行情请求取回全部（原先每只基金一次，N -> 1）
// - 持仓：东财按基金代码分文件，逐只请求但经限流器串行化
// - 持仓股票的名称/涨跌补全交由调用方（Dashboard）的全局 batchFetchStockData 统一处理
export async function fetchFundsRealData(fundCodes) {
  if (!fundCodes || fundCodes.length === 0) return []

  // 1) 批量行情：一次取回全部基金的名称/净值/涨跌
  const quoteMap = {}
  try {
    const quotes = await stockSDK.quotes.fund(fundCodes)
    quotes.forEach((q, i) => {
      if (!q) return
      quoteMap[q.code || fundCodes[i]] = q
    })
  } catch (error) {
    console.warn('Failed to fetch fund quotes:', error?.message)
  }

  // 2) 逐只获取持仓（带并发限流）
  const holdingsList = await Promise.all(
    fundCodes.map(code => limitHoldings(() => fetchPingzhongData(code, { enrich: false })))
  )

  return fundCodes
    .map((code, i) => {
      const q = quoteMap[code]
      if (!q || !q.name) return null
      return {
        code,
        name: q.name,
        netValue: q.nav != null ? Number(q.nav) : 1.0,
        change: q.change != null ? Number(q.change) : 0,
        holdings: holdingsList[i] || []
      }
    })
    .filter(Boolean)
}

// 解析东方财富 pingzhong API 获取持仓明细
// enrich: 是否用 stock-sdk 补全持仓股票名称/涨跌（Dashboard 已有全局批量补全，可传 false 避免重复请求）
async function fetchPingzhongData(fundCode, { enrich = true } = {}) {
  try {
    const url = `/api/pingzhong/${fundCode}.js?v=${Date.now()}`
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

    // 收集所有需要查询的股票代码（用于后续 stock-sdk 补全名称/涨跌）
    const codesToLookup = []

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
          code,
          name: stockNames[index] || '',
          ratio: stockRatios[index] || 0,
          change: 0,
          type: 'stock'
        })
        codesToLookup.push(code)
      })
    } else if (stockCodesMatch) {
      const codes = stockCodesMatch[1]
        .replace(/["'\s]/g, '')
        .split(',')
        .filter(Boolean)

      codes.slice(0, 10).forEach((code, index) => {
        const cleanCode = code.replace(/[01]$/, '')
        const fullCode = getMarketPrefix(cleanCode) + cleanCode
        holdings.push({
          code: fullCode,
          name: stockNames[index] || '',
          ratio: stockRatios[index] || 0,
          change: 0,
          type: 'stock'
        })
        codesToLookup.push(fullCode)
      })
    }

    // 债券持仓
    const addBonds = (codes, names, ratios) => {
      codes.slice(0, Math.min(10 - holdings.length, codes.length)).forEach((code, index) => {
        holdings.push({
          code,
          name: names[index] || '',
          ratio: ratios[index] || 0,
          change: 0,
          type: 'bond'
        })
        codesToLookup.push(code)
      })
    }

    if (zqCodesNewMatch && holdings.length < 10) {
      addBonds(
        zqCodesNewMatch[1].replace(/["'\s]/g, '').split(',').filter(Boolean),
        zqNames, zqRatios
      )
    } else if (zqCodesMatch && holdings.length < 10) {
      const zqs = zqCodesMatch[1].replace(/["'\s]/g, '').split(',').filter(Boolean)
      addBonds(
        zqs.map(c => getMarketPrefix(c) + c),
        zqNames, zqRatios
      )
    }

    // 如果 stockNames 缺失（东方财富 API 不返回名称），通过 stock-sdk 补全
    if (enrich && stockNames.length === 0 && codesToLookup.length > 0) {
      try {
        const stockData = await batchFetchStockData(codesToLookup)
        holdings.forEach(holding => {
          const info = stockData[holding.code]
          if (info) {
            holding.name = info.name || holding.name
            holding.change = info.changePercent || 0
          }
        })
      } catch (e) {
        console.error('Failed to enrich holdings via stock-sdk:', e.message)
      }
    }

    // 兜底：stock-sdk 也没查到且没有名称的，用股票代码代替
    holdings.forEach((h, i) => {
      if (!h.name) h.name = h.code
    })

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

// 通过 stock-sdk 批量获取股票行情
// 支持：A股(0./1.前缀) / 港股(116.) / 美股(105.) / 其他国际(106.及无前缀)
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
  const searchCodes = []      // ['000660', '106.GLW'] - 韩国/台湾等无标准前缀的代码
  const searchOrigCodes = []  // ['000660', '106.GLW']

  codes.forEach(code => {
    if (!code || typeof code !== 'string') return

    if (code.startsWith('116.')) {
      hkCodes.push(code.replace('116.', ''))
      hkOrigCodes.push(code)
    } else if (code.startsWith('105.')) {
      usCodes.push(code.replace('105.', ''))
      usOrigCodes.push(code)
    } else if (code.startsWith('106.')) {
      // 106 = 国际(台湾ADR等) - 多数在美股有ADR，按美股处理
      usCodes.push(code.substring(3))
      usOrigCodes.push(code)
    } else if (code.startsWith('0.') || code.startsWith('1.')) {
      // A股内部格式
      const clean = code.substring(2)
      let sdkCode
      if (clean.startsWith('6')) {
        sdkCode = `sh${clean}`
      } else {
        sdkCode = `sz${clean}`
      }
      aShareSdkCodes.push(sdkCode)
      aShareOrigCodes.push(code)
    } else {
      // 无法通过标准前缀识别的代码（如韩国 000660、台湾 106.GLW）
      // -> 通过 stock-sdk search 获取名称
      searchCodes.push(code)
      searchOrigCodes.push(code)
    }
  })

  // A股批量行情 (v2 API)
  if (aShareSdkCodes.length > 0) {
    try {
      const quotes = await stockSDK.quotes.cnSimple(aShareSdkCodes)
      quotes.forEach((q, i) => {
        if (q) {
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

  // 港股批量行情 (v2 API)
  if (hkCodes.length > 0) {
    try {
      const quotes = await stockSDK.quotes.hk(hkCodes)
      quotes.forEach((q, i) => {
        if (q) {
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

  // 美股批量行情 (v2 API)
  if (usCodes.length > 0) {
    try {
      const quotes = await stockSDK.quotes.us(usCodes)
      quotes.forEach((q, i) => {
        if (q) {
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

  // 国际代码兜底：通过 stock-sdk search 查询名称（韩国等市场可能查不到）
  if (searchCodes.length > 0) {
    const searches = await Promise.allSettled(
      searchCodes.map(async (code) => {
        const searchKey = code.includes('.') ? code.split('.')[1] : code
        const results = await stockSDK.search(searchKey)
        // 在结果中找非A股的匹配（A股内部代码通常有 sh/sz 前缀）
        const match = results.find(r => {
          const sym = r.symbol || ''
          return sym.startsWith('us') || sym.startsWith('hk')
        }) || results.find(r => r.category === 'stock')
        return match || null
      })
    )

    searches.forEach((s, i) => {
      if (s.status === 'fulfilled' && s.value) {
        result[searchOrigCodes[i]] = {
          code: searchOrigCodes[i],
          name: s.value.name || searchOrigCodes[i],
          price: 0,
          changePercent: 0
        }
      }
    })
  }

  return result
}
