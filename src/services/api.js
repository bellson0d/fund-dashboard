// 模拟数据服务 - 当真实API不可用时的降级方案
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
