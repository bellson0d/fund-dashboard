// 基金列表服务
// - 从东方财富获取全量基金列表
// - localStorage 缓存 24 小时，减少 API 请求
const CACHE_KEY = 'fund_list_cache'
const CACHE_TTL = 24 * 60 * 60 * 1000 // 24小时
// 缓存结构版本：结构或字段含义变化时递增，旧缓存自动失效
const CACHE_VERSION = 2

export async function getFundList(forceRefresh = false) {
  if (!forceRefresh) {
    const cached = getCachedFundList()
    if (cached) return cached
  }

  try {
    // no-store：避免浏览器复用旧缓存（此前代理曾返回 301，Chrome 会长期缓存重定向，
    // 导致请求直接跳到跨域的上游并失败）；列表本身已在 localStorage 缓存 24 小时
    const response = await fetch('/api/fundlist', { cache: 'no-store' })
    const text = await response.text()

    const match = text.match(/var r = (\[.*\])/)
    if (match) {
      const data = JSON.parse(match[1])
      // 仅保留含中文名称的有效条目：上游格式异常时避免缓存缺名称的脏数据
      const fundList = data
        .map(item => ({ code: item[0], name: item[2], type: item[3] }))
        .filter(fund => fund.code && fund.name)

      if (fundList.length > 0) {
        saveToCache(fundList)
        return fundList
      }
    }
  } catch (error) {
    console.error('Failed to fetch fund list:', error)
  }

  return getCachedFundList() || []
}

function getCachedFundList() {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const data = JSON.parse(cached)
    // 版本或结构不合法（如历史脏缓存缺少名称）时视为无效，触发重新拉取
    if (data.version !== CACHE_VERSION) return null
    if (!Array.isArray(data.funds) || data.funds.length === 0) return null
    if (!data.funds[0]?.code || !data.funds[0]?.name) return null
    if (Date.now() - data.timestamp >= CACHE_TTL) return null

    return data.funds
  } catch (error) {
    console.error('Failed to get cached fund list:', error)
  }
  return null
}

function saveToCache(funds) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      version: CACHE_VERSION,
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
      const timestamp = typeof data.timestamp === 'number' ? data.timestamp : 0
      const age = Date.now() - timestamp
      const hours = Math.floor(age / (1000 * 60 * 60))
      // 版本/结构合法且含名称，才认为是有效缓存
      const valid = data.version === CACHE_VERSION &&
        Array.isArray(data.funds) &&
        data.funds.length > 0 &&
        !!data.funds[0]?.name
      return {
        exists: valid,
        count: valid ? data.funds.length : 0,
        age,
        hours,
        isValid: valid && age < CACHE_TTL
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
