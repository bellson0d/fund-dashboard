// 基金列表服务
// - 从东方财富获取全量基金列表
// - localStorage 缓存 24 小时，减少 API 请求
const CACHE_KEY = 'fund_list_cache'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24小时

export async function getFundList(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedFundList()
    if (cached) return cached
  }

  try {
    const response = await fetch('/api/fundlist')
    const text = await response.text()

    const match = text.match(/var r = (\[.*\])/)
    if (match) {
      const data = JSON.parse(match[1])
      const fundList = data.map(item => ({
        code: item[0],
        name: item[2],
        type: item[3]
      }))

      saveToCache(fundList)
      return fundList
    }
  } catch (error) {
    console.error('Failed to fetch fund list:', error)
  }

  return getCachedFundList() || []
}

function getCachedFundList() {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const data = JSON.parse(cached)
      if (Date.now() - data.timestamp < CACHE_TTL) {
        return data.funds
      }
    }
  } catch (error) {
    console.error('Failed to get cached fund list:', error)
  }
  return null
}

function saveToCache(funds) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      funds,
      timestamp: Date.now()
    }))
  } catch (error) {
    console.error('Failed to save fund list to cache:', error)
  }
}

// 在已加载的基金列表中本地模糊搜索
export function searchFunds(query, fundList) {
  if (!query.trim()) return []

  const lowerQuery = query.toLowerCase()
  return fundList.filter(fund =>
    fund.code.toLowerCase().includes(lowerQuery) ||
    fund.name.toLowerCase().includes(lowerQuery)
  ).slice(0, 20)
}

// 缓存状态查询（显示在 Admin 页面）
export function getCacheStatus() {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      const data = JSON.parse(cached)
      const age = Date.now() - data.timestamp
      const hours = Math.floor(age / (1000 * 60 * 60))
      return {
        exists: true,
        count: data.funds.length,
        age,
        hours,
        isValid: age < CACHE_TTL
      }
    }
  } catch (error) {
    console.error('Failed to get cache status:', error)
  }
  return { exists: false, count: 0, age: 0, hours: 0, isValid: false }
}

export function clearFundListCache() {
  localStorage.removeItem(CACHE_KEY)
}
