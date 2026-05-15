import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, X, ChevronUp, ChevronDown, Save, RefreshCw, Loader2 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { defaultFundCodes } from '../data/mockData'
import { defaultStockCodes } from '../data/stockData'
import { getFundList, searchFunds, getCacheStatus as getFundCacheStatus, clearFundListCache } from '../services/fundListService'
import { searchStocks as searchStocksAPI } from '../services/stockSearchService'

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
  const [isLoading, setIsLoading] = useState(false)
  const [fundCacheStatus, setFundCacheStatus] = useState(null)
  
  const searchTimeoutRef = useRef(null)

  useEffect(() => {
    loadFundList()
  }, [])

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
      return currentList.find(f => f.code === code)
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
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
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
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            重置默认
          </button>
          <button
            onClick={handleSave}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors flex items-center gap-1 ${
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
            className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
          >
            <Plus size={12} />
            {adminTab === 'fund' ? '添加基金' : '添加股票'}
          </button>
        </div>
      </div>

      {adminTab === 'fund' && currentCacheStatus && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-800">
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

      <div className="bg-white rounded-xl shadow-sm p-4">
        <h2 className="text-sm font-medium text-gray-600 mb-3">
          已添加的{adminTab === 'fund' ? '基金' : '股票'} ({currentCodes.length})
        </h2>
        {currentCodes.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">
            暂无{adminTab === 'fund' ? '基金' : '股票'}，请添加
          </p>
        ) : (
          <div className="space-y-2">
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
