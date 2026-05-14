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
      name: gzData.name,
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
    
    const codeMatch = text.match(/stockCodes\s*=\s*"([^"]+)"/)
    const nameMatch = text.match(/stockNames\s*=\s*"([^"]+)"/)
    const ratioMatch = text.match(/stockRatios\s*=\s*"([^"]+)"/)
    
    if (codeMatch && nameMatch) {
      const codes = codeMatch[1].split(',')
      const names = nameMatch[1].split(',')
      const ratios = ratioMatch ? ratioMatch[1].split(',').map(r => parseFloat(r)) : []
      
      return codes.slice(0, 10).map((code, index) => ({
        code,
        name: names[index] || code,
        ratio: ratios[index] || 0,
        change: (Math.random() - 0.5) * 5
      }))
    }
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
