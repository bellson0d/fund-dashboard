import { mockFunds } from '../data/mockData'

export async function fetchFundData(fundCode) {
  const fund = mockFunds.find(f => f.code === fundCode)
  if (fund) {
    return {
      ...fund,
      holdings: fund.holdings.map(h => ({
        ...h,
        change: h.change + (Math.random() - 0.5) * 0.5
      })),
      change: fund.change + (Math.random() - 0.5) * 0.3,
      netValue: fund.netValue + (Math.random() - 0.5) * 0.02
    }
  }
  return null
}

export async function fetchStockData(stockCode) {
  const change = (Math.random() - 0.5) * 5
  return {
    code: stockCode,
    name: getStockName(stockCode),
    price: 100 + Math.random() * 200,
    change: change,
    changePercent: change
  }
}

function getStockName(code) {
  const names = {
    '600519': '贵州茅台',
    '000858': '五粮液',
    '300750': '宁德时代',
    '000001': '平安银行',
    '601318': '中国平安',
    '000568': '泸州老窖',
    '600809': '山西汾酒',
    '002304': '洋河股份',
    '600547': '山东黄金',
    '601899': '紫金矿业',
    'AAPL': '苹果',
    'MSFT': '微软',
    'AMZN': '亚马逊',
    'GOOGL': '谷歌',
    'META': 'Meta',
    'NVDA': '英伟达',
    '002594': '比亚迪',
    '600036': '招商银行',
    '688981': '中芯国际',
    '600438': '通威股份',
    '601012': '隆基绿能',
    '300274': '阳光电源',
    '002237': '恒邦股份',
    '600489': '中金黄金',
    '000603': '盛达矿业'
  }
  return names[code] || code
}

export async function searchFunds(keyword) {
  if (!keyword) return mockFunds
  const lowerKeyword = keyword.toLowerCase()
  return mockFunds.filter(fund =>
    fund.name.toLowerCase().includes(lowerKeyword) ||
    fund.code.includes(keyword)
  )
}
