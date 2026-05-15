import { useState, useEffect, useCallback } from 'react'
import StockCard from '../components/StockCard'
import { batchFetchStockData } from '../services/realApi'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { defaultStockCodes } from '../data/stockData'

function Stock({ searchQuery, refreshKey }) {
  const [stockCodes, setStockCodes] = useLocalStorage('stockCodes', defaultStockCodes)
  const [stocks, setStocks] = useState([])
  const [apiError, setApiError] = useState(false)

  const loadStockData = useCallback(async () => {
    setApiError(false)
    
    if (stockCodes.length === 0) {
      setStocks([])
      return
    }

    try {
      const stockData = await batchFetchStockData(stockCodes)
      
      const validStocks = stockCodes.map(code => {
        const data = stockData[code]
        if (data) {
          return {
            code,
            name: data.name || code,
            price: data.price || 0,
            change: data.changePercent || 0
          }
        }
        return {
          code,
          name: code,
          price: 0,
          change: 0
        }
      })

      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase()
        const filtered = validStocks.filter(stock => 
          stock.name.toLowerCase().includes(lowerQuery) ||
          stock.code.includes(searchQuery)
        )
        setStocks(filtered)
      } else {
        setStocks(validStocks)
      }
    } catch (error) {
      console.error('Failed to fetch stock data:', error)
      setApiError(true)
    }
  }, [stockCodes, searchQuery])

  useEffect(() => {
    loadStockData()
  }, [loadStockData, refreshKey])

  return (
    <div>
      {apiError && (
        <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
          获取股票数据失败，请稍后重试
        </div>
      )}
      <div className="grid grid-cols-4 gap-3">
        {stocks.length === 0 ? (
          <div className="col-span-4 text-center py-10">
            <p className="text-gray-500">
              {searchQuery ? '未找到匹配的股票' : '暂无股票数据，请在 Admin 中添加股票'}
            </p>
          </div>
        ) : (
          stocks.map(stock => (
            <StockCard key={stock.code} stock={stock} />
          ))
        )}
      </div>
    </div>
  )
}

export default Stock