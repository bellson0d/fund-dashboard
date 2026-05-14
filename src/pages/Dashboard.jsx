import { useState, useEffect, useCallback } from 'react'
import FundCard from '../components/FundCard'
import { fetchFundData } from '../services/api'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { defaultFundCodes } from '../data/mockData'

function Dashboard({ searchQuery, refreshKey }) {
  const [fundCodes, setFundCodes] = useLocalStorage('fundCodes', defaultFundCodes)
  const [funds, setFunds] = useState([])
  const [loading, setLoading] = useState(true)

  const loadFundData = useCallback(async () => {
    setLoading(true)
    const results = await Promise.all(
      fundCodes.map(code => fetchFundData(code))
    )
    const validFunds = results.filter(Boolean)
    
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
    setLoading(false)
  }, [fundCodes, searchQuery])

  useEffect(() => {
    loadFundData()
  }, [loadFundData, refreshKey])

  return (
    <div className="grid grid-cols-4 gap-3">
      {loading ? (
        Array(16).fill(null).map((_, i) => (
          <div key={i} className="card-neutral rounded-xl p-3 animate-pulse">
            <div className="h-10 bg-gray-200 rounded mb-2" />
            <div className="space-y-1">
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded" />
            </div>
          </div>
        ))
      ) : funds.length === 0 ? (
        <div className="col-span-4 text-center py-20">
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
  )
}

export default Dashboard
