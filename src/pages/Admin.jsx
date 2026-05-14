import { useState, useEffect } from 'react'
import { Plus, X, ArrowUpDown, Save, RefreshCw, Loader2 } from 'lucide-react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { defaultFundCodes } from '../data/mockData'
import { getFundList, searchFunds, getCacheStatus, clearFundListCache } from '../services/fundListService'

function Admin() {
  const [fundCodes, setFundCodes] = useLocalStorage('fundCodes', defaultFundCodes)
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

  const availableFunds = fundList.filter(f => !fundCodes.includes(f.code))
  const filteredFunds = searchKeyword ? searchFunds(searchKeyword, availableFunds) : availableFunds.slice(0, 20)

  const addFund = (code) => {
    setFundCodes([...fundCodes, code])
    setSaved(false)
  }

  const removeFund = (code) => {
    setFundCodes(fundCodes.filter(c => c !== code))
    setSaved(false)
  }

  const moveUp = (index) => {
    if (index === 0) return
    const newCodes = [...fundCodes]
    ;[newCodes[index], newCodes[index - 1]] = [newCodes[index - 1], newCodes[index]]
    setFundCodes(newCodes)
    setSaved(false)
  }

  const moveDown = (index) => {
    if (index === fundCodes.length - 1) return
    const newCodes = [...fundCodes]
    ;[newCodes[index], newCodes[index + 1]] = [newCodes[index + 1], newCodes[index]]
    setFundCodes(newCodes)
    setSaved(false)
  }

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = () => {
    setFundCodes(defaultFundCodes)
    setSaved(false)
  }

  const handleRefreshCache = () => {
    clearFundListCache()
    loadFundList(true)
  }

  const getFundInfo = (code) => {
    return fundList.find(f => f.code === code)
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg font-semibold text-gray-800">基金管理</h1>
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
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-1"
          >
            <Plus size={12} />
            添加基金
          </button>
        </div>
      </div>

      {cacheStatus && (
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
        <h2 className="text-sm font-medium text-gray-600 mb-3">已添加的基金 ({fundCodes.length})</h2>
        {fundCodes.length === 0 ? (
          <p className="text-gray-500 text-sm py-8 text-center">暂无基金，请添加</p>
        ) : (
          <div className="space-y-2">
            {fundCodes.map((code, index) => {
              const fund = getFundInfo(code)
              return (
                <div key={code} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ArrowUpDown size={14} className="rotate-[-90deg]" />
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === fundCodes.length - 1}
                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  >
                    <ArrowUpDown size={14} className="rotate-90" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800 truncate">
                      {fund?.name || code}
                    </p>
                    <p className="text-xs text-gray-500">{code} {fund?.type && `· ${fund.type}`}</p>
                  </div>
                  <button
                    onClick={() => removeFund(code)}
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
              <h3 className="font-semibold text-gray-800">添加基金</h3>
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
              placeholder="搜索基金名称或代码..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <div className="mt-3 max-h-60 overflow-y-auto space-y-2">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin text-gray-500" />
                </div>
              ) : filteredFunds.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">
                  {availableFunds.length === 0 ? '所有基金已添加' : '未找到匹配的基金'}
                </p>
              ) : (
                filteredFunds.map(fund => (
                  <div
                    key={fund.code}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-800 truncate">{fund.name}</p>
                      <p className="text-xs text-gray-500">{fund.code} · {fund.type}</p>
                    </div>
                    <button
                      onClick={() => addFund(fund.code)}
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
