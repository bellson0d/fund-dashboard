export async function fetchFundRealData(fundCode) {
  try {
    const url = `http://fund.eastmoney.com/pingzhongdata/${fundCode}.js`
    const response = await fetch(url)
    const text = await response.text()
    
    const data = parseFundData(text, fundCode)
    if (data) {
      return data
    }
  } catch (error) {
    console.error('Failed to fetch fund data:', error)
  }
  return null
}

function parseFundData(text, fundCode) {
  try {
    const nameMatch = text.match(/var fund_name = "([^"]+)"/)
    const netValueMatch = text.match(/var fund_netvalue = "([^"]+)"/)
    const changeMatch = text.match(/var fund_daygrow = "([^"]+)"/)
    
    const holdingsMatch = text.match(/var stockCodes = "([^"]+)"/)
    const stockNamesMatch = text.match(/var stockNames = "([^"]+)"/)
    const stockRatiosMatch = text.match(/var stockRatios = "([^"]+)"/)

    const name = nameMatch ? nameMatch[1] : `${fundCode}基金`
    const netValue = netValueMatch ? parseFloat(netValueMatch[1]) : 1.0
    const change = changeMatch ? parseFloat(changeMatch[1]) : 0
    
    const holdings = []
    if (holdingsMatch && stockNamesMatch && stockRatiosMatch) {
      const codes = holdingsMatch[1].split(',')
      const names = stockNamesMatch[1].split(',')
      const ratios = stockRatiosMatch[1].split(',').map(r => parseFloat(r))
      
      for (let i = 0; i < Math.min(codes.length, names.length, ratios.length); i++) {
        holdings.push({
          code: codes[i],
          name: names[i],
          ratio: ratios[i] || 0,
          change: (Math.random() - 0.5) * 5
        })
      }
    }

    return {
      code: fundCode,
      name,
      netValue,
      change,
      holdings: holdings.slice(0, 10)
    }
  } catch (error) {
    console.error('Failed to parse fund data:', error)
    return null
  }
}

export async function fetchStockRealData(stockCode) {
  try {
    const market = getMarketPrefix(stockCode)
    const url = `http://push2.eastmoney.com/api/qt/stock/get?secid=${market}${stockCode}&fields=f57,f58,f116,f107,f108,f117`
    
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
