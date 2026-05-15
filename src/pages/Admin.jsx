import { useState, useEffect } from 'react'
import { Plus, X, ChevronUp, ChevronDown, Save, RefreshCw, Loader2 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { defaultFundCodes } from '../data/mockData'
import { defaultStockCodes } from '../data/stockData'
import { getFundList, searchFunds, getCacheStatus, clearFundListCache } from '../services/fundListService'

function Admin() {
  const [adminTab, setAdminTab] = useState('fund')
  
  const [fundCodes, setFundCodes] = useLocalStorage('fundCodes', defaultFundCodes)
  const [stockCodes, setStockCodes] = useLocalStorage('stockCodes', defaultStockCodes)
  
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [saved, setSaved] = useState(false)
  
  const [fundList, setFundList] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [cacheStatus, setCacheStatus] = useState(null)

  useEffect(() => {
    loadFundList()
  }, [])

  useEffect(() => {
    setCacheStatus(getCacheStatus())
  }, [fundList])

  const loadFundList = async (forceRefresh = false) => {
    setIsLoading(true)
    const funds = await getFundList(forceRefresh)
    setFundList(funds)
    setIsLoading(false)
    setCacheStatus(getCacheStatus())
  }

  const currentCodes = adminTab === 'fund' ? fundCodes : stockCodes
  const setCurrentCodes = adminTab === 'fund' ? setFundCodes : setStockCodes
  const defaultCodes = adminTab === 'fund' ? defaultFundCodes : defaultStockCodes
  const currentList = adminTab === 'fund' ? fundList : []

  const availableItems = currentList.filter(f => !currentCodes.includes(f.code))
  const filteredItems = searchKeyword 
    ? (adminTab === 'fund' 
        ? searchFunds(searchKeyword, availableItems) 
        : availableItems.filter(s => 
            s.name.toLowerCase().includes(searchKeyword.toLowerCase()) || 
            s.code.includes(searchKeyword)
          ).slice(0, 20))
    : availableItems.slice(0, 20)

  const addItem = (code) => {
    setCurrentCodes([...currentCodes, code])
    setSaved(false)
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
    return currentList.find(f => f.code === code)
  }

  const handleAddStock = () => {
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

      {adminTab === 'fund' && cacheStatus && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-blue-800">
              {cacheStatus.exists ? (
                <>
                  已缓存 {cacheStatus.count.toLocaleString()} 只基金，
                  缓存时间：{cacheStatus.hours} 小时前
                  {!cacheStatus.isValid && <span className="text-orange-600 ml-2">(缓存已过期)</span>}
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
            
            {adminTab === 'stock' ? (
              <>
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="输入股票代码（如：0.600519、1.688981）..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-3 max-h-60 overflow-y-auto space-y-2">
                  {filteredItems.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      请输入股票代码
                    </p>
                  ) : null}
                  {searchKeyword && (
                    <div
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-800 truncate">{searchKeyword}</p>
                        <p className="text-xs text-gray-500">{searchKeyword}</p>
                      </div>
                      <button
                        onClick={() => {
                          addItem(searchKeyword)
                          setSearchKeyword('')
                        }}
                        className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors ml-2"
                      >
                        添加
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="搜索基金名称或代码..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                <div className="mt-3 max-h-60 overflow-y-auto space-y-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 size={20} className="animate-spin text-gray-500" />
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      {availableItems.length === 0 ? '所有基金已添加' : '未找到匹配的基金'}
                    </p>
                  ) : (
                    filteredItems.map(fund => (
                      <div
                        key={fund.code}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-800 truncate">{fund.name}</p>
                          <p className="text-xs text-gray-500">{fund.code} · {fund.type}</p>
                        </div>
                        <button
                          onClick={() => addItem(fund.code)}
                          className="px-3 py-1 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors ml-2"
                        >
                          添加
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
