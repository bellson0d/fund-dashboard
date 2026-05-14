import { useState, useEffect, useCallback } from 'react'
import FundCard from '../components/FundCard'
import { fetchFundData } from '../services/api'
import { fetchFundRealData } from '../services/realApi'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { defaultFundCodes } from '../data/mockData'

function Dashboard({ searchQuery, refreshKey, useRealApi }) {
  const [fundCodes, setFundCodes] = useLocalStorage('fundCodes', defaultFundCodes)
  const [funds, setFunds] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(false)

  const loadFundData = useCallback(async () => {
    setLoading(true)
    setApiError(false)
    
    const fetchFn = useRealApi ? fetchFundRealData : fetchFundData
    
    const results = await Promise.all(
      fundCodes.map(code => fetchFn(code))
    )
    
    const validFunds = results.filter(Boolean)
    
    if (useRealApi && validFunds.length === 0) {
      setApiError(true)
      const mockResults = await Promise.all(
        fundCodes.map(code => fetchFundData(code))
      )
      setFunds(mockResults.filter(Boolean))
    } else {
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase()
        const filtered = validFunds.filter(fund => 
          fund.name.toLowerCase().includes(lowerQuery) ||
          fund.code.includes(searchQuery)
        )
        setFunds(filtered)
      } else {
        setFunds(validFunds)
      }
    }
    setLoading(false)
  }, [fundCodes, searchQuery, useRealApi])

  useEffect(() => {
    loadFundData()
  }, [loadFundData, refreshKey])

  return (
    <div>
      {apiError && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
          真实API获取失败，已自动切换到模拟数据
        </div>
      )}
      <div className="grid grid-cols-3 gap-5">
        {loading ? (
          Array(12).fill(null).map((_, i) => (
            <div key={i} className="card-neutral rounded-xl p-3 animate-pulse">
              <div className="h-8 bg-gray-200 rounded mb-2" />
              <div className="space-y-0.5">
                <div className="h-3 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded" />
                <div className="h-3 bg-gray-200 rounded" />
              </div>
            </div>
          ))
        ) : funds.length === 0 ? (
          <div className="col-span-3 text-center py-20">
            <p className="text-gray-500">
              {searchQuery ? '未找到匹配的基金' : '暂无基金数据，请在 Admin 中添加基金'}
            </p>
          </div>
        ) : (
          funds.map(fund => (
            <FundCard key={fund.code} fund={fund} />
          ))
        )}
      </div>
    </div>
  )
}

export default Dashboard
