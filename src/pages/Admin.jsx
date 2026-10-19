// 数据管理页 - 添加/删除/排序基金和股票
import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X, ChevronUp, ChevronDown, Save, RefreshCw, Loader2 } from 'lucide-react'
import { StockSDK } from 'stock-sdk'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { defaultFundCodes } from '../data/mockData'
import { defaultStockCodes } from '../data/stockData'
import { getFundList, searchFunds, getCacheStatus as getFundCacheStatus, clearFundListCache } from '../services/fundListService'
import { searchStocks as searchStocksAPI } from '../services/stockSearchService'
import { recordAddition } from '../services/addedInfo'

const stockSDK = new StockSDK({ timeout: 15000 })

// 补全缺失的股票名称 - 切换到股票 tab 时自动调用
// 将内部格式 (0.xxx / 1.xxx / 116.xxx / 105.xxx) 转为 stock-sdk 格式批量查询
async function fetchMissingStockNames(codes) {
  const aShareSdk = []
  const aShareOrig = []
  const hkCodes = []
  const hkOrig = []
  const usCodes = []
  const usOrig = []

  codes.forEach(code => {
    if (code.startsWith('116.')) {
      hkCodes.push(code.replace('116.', ''))
      hkOrig.push(code)
    } else if (code.startsWith('105.')) {
      usCodes.push(code.replace('105.', ''))
      usOrig.push(code)
    } else {
      const clean = code.replace(/^[01]\./, '')
      aShareSdk.push((clean.startsWith('6') ? 'sh' : 'sz') + clean)
      aShareOrig.push(code)
    }
  })

  const result = {}

  if (aShareSdk.length > 0) {
    try {
      const quotes = await stockSDK.quotes.cnSimple(aShareSdk)
      quotes.forEach((q, i) => {
        if (q) {
          result[aShareOrig[i]] = {
            code: aShareOrig[i],
            name: q.name || aShareOrig[i],
            market: aShareOrig[i].startsWith('1.') ? 'a-sh' : 'a-sz'
          }
        }
      })
    } catch (e) { console.error('fetch names A-share:', e.message) }
  }
  if (hkCodes.length > 0) {
    try {
      const quotes = await stockSDK.quotes.hk(hkCodes)
      quotes.forEach((q, i) => {
        if (q) result[hkOrig[i]] = { code: hkOrig[i], name: q.name || hkOrig[i], market: 'hk' }
      })
    } catch (e) { console.error('fetch names HK:', e.message) }
  }
  if (usCodes.length > 0) {
    try {
      const quotes = await stockSDK.quotes.us(usCodes)
      quotes.forEach((q, i) => {
        if (q) result[usOrig[i]] = { code: usOrig[i], name: q.name || usOrig[i], market: 'us' }
      })
    } catch (e) { console.error('fetch names US:', e.message) }
  }

  return result
}

// 补全缺失的基金名称 - 全量基金列表不可用/缺失时，用 stock-sdk 批量取名称
async function fetchMissingFundNames(codes) {
  const result = {}
  try {
    const funds = await stockSDK.quotes.fund(codes)
    funds.forEach((f, i) => {
      if (f && f.name) result[codes[i]] = f.name
    })
  } catch (e) {
    console.error('fetch fund names:', e.message)
  }
  return result
}

function Admin() {
  const [adminTab, setAdminTab] = useState('fund')
  
  const [fundCodes, setFundCodes] = useLocalStorage('fundCodes', defaultFundCodes)
  const [stockCodes, setStockCodes] = useLocalStorage('stockCodes', defaultStockCodes)
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [saved, setSaved] = useState(false)
  
  const [fundList, setFundList] = useState([])
  const [stockSearchResults, setStockSearchResults] = useState([])
  const [stockInfoCache, setStockInfoCache] = useLocalStorage('stockInfoCache', {})
  const [fundInfoCache, setFundInfoCache] = useLocalStorage('fundInfoCache', {})
  const [isLoading, setIsLoading] = useState(false)
  const [fundCacheStatus, setFundCacheStatus] = useState(null)
  
  const searchTimeoutRef = useRef(null)

  useEffect(() => {
    loadFundList()
  }, [])

  // 切换到股票 tab 时，补全缺失的股票名称
  useEffect(() => {
    if (adminTab !== 'stock') return
    const missing = stockCodes.filter(code => !stockInfoCache[code])
    if (missing.length === 0) return

    let cancelled = false
    fetchMissingStockNames(missing).then(newInfo => {
      if (cancelled) return
      setStockInfoCache(prev => ({ ...prev, ...newInfo }))
    })
    return () => { cancelled = true }
  }, [adminTab, stockCodes])

  // 全量基金列表不可用时，用 stock-sdk 补全缺失的基金名称，保证已添加列表始终显示中文名
  useEffect(() => {
    if (adminTab !== 'fund') return
    const missing = fundCodes.filter(code => {
      const inList = fundList.find(f => f.code === code)
      return !inList?.name && !fundInfoCache[code]
    })
    if (missing.length === 0) return

    let cancelled = false
    fetchMissingFundNames(missing).then(names => {
      if (cancelled || Object.keys(names).length === 0) return
      setFundInfoCache(prev => ({ ...prev, ...names }))
    })
    return () => { cancelled = true }
  }, [adminTab, fundCodes, fundList])

  useEffect(() => {
    setFundCacheStatus(getFundCacheStatus())
  }, [fundList])

  const loadFundList = async (forceRefresh = false) => {
    setIsLoading(true)
    const funds = await getFundList(forceRefresh)
    setFundList(funds)
    setIsLoading(false)
    setFundCacheStatus(getFundCacheStatus())
  }

  const searchStocksWithDebounce = useCallback((keyword) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (!keyword || keyword.trim().length === 0) {
      setStockSearchResults([])
      return
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoading(true)
      const results = await searchStocksAPI(keyword)
      const filtered = results.filter(item => !stockCodes.includes(item.code))
      setStockSearchResults(filtered)
      setIsLoading(false)
    }, 500)
  }, [stockCodes])

  useEffect(() => {
    if (adminTab === 'stock' && searchKeyword) {
      searchStocksWithDebounce(searchKeyword)
    }
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchKeyword, adminTab, searchStocksWithDebounce])

  const currentCodes = adminTab === 'fund' ? fundCodes : stockCodes
  const setCurrentCodes = adminTab === 'fund' ? setFundCodes : setStockCodes
  const defaultCodes = adminTab === 'fund' ? defaultFundCodes : defaultStockCodes
  const currentList = adminTab === 'fund' ? fundList : []
  const currentCacheStatus = adminTab === 'fund' ? fundCacheStatus : null

  const availableItems = adminTab === 'fund' 
    ? currentList.filter(f => !currentCodes.includes(f.code))
    : []
  
  const filteredItems = adminTab === 'fund'
    ? (searchKeyword ? searchFunds(searchKeyword, availableItems) : availableItems.slice(0, 20))
    : stockSearchResults

  const addItem = (code) => {
    setCurrentCodes([...currentCodes, code])
    setSaved(false)
    // 记录实际添加时间，供"添加后涨幅"使用
    recordAddition(adminTab, code)
    
    if (adminTab === 'stock') {
      const stockInfo = filteredItems.find(item => item.code === code)
      if (stockInfo) {
        setStockInfoCache(prev => ({
          ...prev,
          [code]: stockInfo
        }))
      }
    }
  }

  const removeItem = (code) => {
    setCurrentCodes(currentCodes.filter(c => c !== code))
    setSaved(false)
  }

  const moveUp = (index) => {
    if (index === 0) return
    const newCodes = [...currentCodes]
    ;[newCodes[index], newCodes[index - 1]] = [newCodes[index - 1], newCodes[index]]
    setCurrentCodes(newCodes)
    setSaved(false)
  }

  const moveDown = (index) => {
    if (index === currentCodes.length - 1) return
    const newCodes = [...currentCodes]
    ;[newCodes[index], newCodes[index + 1]] = [newCodes[index + 1], newCodes[index]]
    setCurrentCodes(newCodes)
    setSaved(false)
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setCurrentCodes(defaultCodes)
    setSaved(false)
  }

  const handleRefreshCache = () => {
    if (adminTab === 'fund') {
      clearFundListCache()
      loadFundList(true)
    }
  }

  const getItemInfo = (code) => {
    if (adminTab === 'fund') {
      const found = currentList.find(f => f.code === code)
      if (found?.name) return found
      // 全量列表缺失时，回退到 stock-sdk 补全的名称缓存
      if (fundInfoCache[code]) return { code, name: fundInfoCache[code], type: found?.type }
      return found || null
    } else {
      return stockInfoCache[code] || null
    }
  }

  const handleAddStock = () => {
    setSearchKeyword('')
    setStockSearchResults([])
    setShowAddModal(true)
  }

  const handleAddFund = () => {
    loadFundList()
    setShowAddModal(true)
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 flex-shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">数据管理</h1>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setAdminTab('fund')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                adminTab === 'fund' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              基金
            </button>
            <button
              onClick={() => setAdminTab('stock')}
              className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                adminTab === 'stock' 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              股票
            </button>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleReset}
            className="flex-1 sm:flex-none px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            重置默认
          </button>
          <button
            onClick={handleSave}
            className={`flex-1 sm:flex-none px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center justify-center gap-1 ${
              saved 
                ? 'bg-green-500 text-white' 
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            <Save size={12} />
            {saved ? '已保存' : '保存'}
          </button>
          <button
            onClick={adminTab === 'fund' ? handleAddFund : handleAddStock}
            className="flex-1 sm:flex-none px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-1"
          >
            <Plus size={12} />
            {adminTab === 'fund' ? '添加基金' : '添加股票'}
          </button>
        </div>
      </div>

      {adminTab === 'fund' && currentCacheStatus && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="text-xs sm:text-sm text-blue-800">
              {currentCacheStatus.exists ? (
                <>
                  已缓存 {currentCacheStatus.count.toLocaleString()} 只基金，
                  缓存时间：{currentCacheStatus.hours} 小时前
                  {!currentCacheStatus.isValid && <span className="text-orange-600 ml-2">(缓存已过期)</span>}
                </>
              ) : (
                '暂无缓存，首次加载可能较慢'
              )}
            </div>
            <button
              onClick={handleRefreshCache}
              disabled={isLoading}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              刷新缓存
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm p-4 flex-1 flex flex-col min-h-0">
        <h2 className="text-sm font-medium text-gray-600 mb-3 flex-shrink-0">
          已添加的{adminTab === 'fund' ? '基金' : '股票'} ({currentCodes.length})
        </h2>
        {currentCodes.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center flex-shrink-0">
            暂无{adminTab === 'fund' ? '基金' : '股票'}，请添加
          </p>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {currentCodes.map((code, index) => {
              const item = getItemInfo(code)
              return (
                <div key={code} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === currentCodes.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">
                      {item?.name || code}
                    </p>
                    <p className="text-xs text-gray-500">
                      {code} {adminTab === 'fund' && item?.type && `· ${item.type}`}
                      {adminTab === 'stock' && item?.market && `· ${item.market}`}
                    </p>
                  </div>
                  <button
                    onClick={() => removeItem(code)}
                    className="p-1 text-red-400 hover:text-red-600"
                  >
                    <X size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md mx-4 p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">
                {adminTab === 'fund' ? '添加基金' : '添加股票'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder={adminTab === 'fund' ? '搜索基金名称或代码...' : '搜索股票名称或代码...'}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <div className="mt-3 max-h-60 overflow-y-auto space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-gray-500" />
                  <span className="ml-2 text-sm text-gray-500">
                    {adminTab === 'fund' ? '获取基金列表中...' : '搜索股票中...'}
                  </span>
                </div>
              ) : filteredItems.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  {adminTab === 'stock' 
                    ? (searchKeyword 
                        ? '未找到匹配的股票' 
                        : '输入股票名称(如"比亚迪")、拼音(如"byd")或代码(如"002594")进行搜索')
                    : (searchKeyword && availableItems.length === 0 
                        ? '所有基金已添加' 
                        : searchKeyword 
                        ? '未找到匹配的基金'
                        : '输入基金名称或代码进行搜索')}
                </p>
              ) : (
                filteredItems.map(item => (
                  <div
                    key={item.code}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-800 truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item.code} 
                        {adminTab === 'fund' && item.type && ` · ${item.type}`}
                        {adminTab === 'stock' && item.market && ` · ${item.market}`}
                      </p>
                    </div>
                    <button
                      onClick={() => addItem(item.code)}
                      className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors ml-2"
                    >
                      添加
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
