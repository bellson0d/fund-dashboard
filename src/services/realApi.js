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

export async function batchFetchStockData(secids) {
  if (!secids || secids.length === 0) return {}

  const results = {}
  const batchSize = 20
  const batches = []

  for (let i = 0; i < secids.length; i += batchSize) {
    batches.push(secids.slice(i, i + batchSize))
  }

  for (const batch of batches) {
    const secidsStr = batch.join(',')
    const timestamp = Date.now()
    const url = `/api/batchstock?fltt=2&invt=2&fields=f2,f3,f12,f14&secids=${secidsStr}&_=${timestamp}`
    
    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.error(`Batch request failed with status ${response.status}`)
        continue
      }
      const data = await response.json()
      
      if (data && data.data && data.data.diff) {
        data.data.diff.forEach(item => {
          const code = item.f12
          results[item.f14] = {
            code,
            name: item.f14,
            price: parseFloat(item.f2) || 0,
            changePercent: parseFloat(item.f3) || 0
          }
        })
      }
    } catch (error) {
      console.error('Failed to fetch batch stock data:', error)
    }
  }

  return results
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
