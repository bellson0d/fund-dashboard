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
        const [market, stockCode] = code.split('.')
        holdings.push({
          code: stockCode || code,
          name: stockNames[index] || `股票${index + 1}`,
          ratio: stockRatios[index] || 0,
          change: (Math.random() - 0.5) * 5,
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
          code: cleanCode,
          name: stockNames[index] || `股票${index + 1}`,
          ratio: stockRatios[index] || 0,
          change: (Math.random() - 0.5) * 5,
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
        const [market, zqCode] = code.split('.')
        holdings.push({
          code: zqCode || code,
          name: zqNames[index] || `债券${index + 1}`,
          ratio: zqRatios[index] || 0,
          change: (Math.random() - 0.5) * 1,
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
          code: code,
          name: zqNames[index] || `债券${index + 1}`,
          ratio: zqRatios[index] || 0,
          change: (Math.random() - 0.5) * 1,
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

export async function fetchStockRealData(stockCode) {
  try {
    const market = getMarketPrefix(stockCode)
    const url = `/api/stock?secid=${market}${stockCode}&fields=f57,f58,f116,f107,f108,f117`
    
    const response = await fetch(url)
    const data = await response.json()
    
    if (data && data.data) {
      return {
        code: stockCode,
        name: data.data.f58 || stockCode,
        price: parseFloat(data.data.f116) || 0,
        change: parseFloat(data.data.f107) || 0,
        changePercent: parseFloat(data.data.f108) || 0
      }
    }
  } catch (error) {
    console.error('Failed to fetch stock data:', error)
  }
  return null
}

function getMarketPrefix(stockCode) {
  if (stockCode.startsWith('6')) return '1.'
  if (stockCode.startsWith('0') || stockCode.startsWith('2')) return '0.'
  if (stockCode.startsWith('3')) return '0.'
  if (stockCode.startsWith('68')) return '1.'
  if (stockCode.startsWith('BJ') || stockCode.startsWith('bj')) return '1.'
  return '0.'
}
