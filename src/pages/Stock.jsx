// 股票看板 - 展示已添加股票的实时价格和涨跌幅，支持 iOS 风格拖拽排序
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import StockCard from '../components/StockCard'
import { batchFetchStockData } from '../services/realApi'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useDragSort } from '../hooks/useDragSort'
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
        return { code, name: code, price: 0, change: 0 }
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

  const { isDragging, dragIndex, displayItems, ghostPos, handleMouseDown, getItemOriginalIndex } = useDragSort(stockCodes, setStockCodes)

  const stockMap = {}
  stocks.forEach(s => { stockMap[s.code] = s })

  const draggedStock = isDragging ? stockMap[stockCodes[dragIndex]] : null

  return (
    <div>
      {apiError && (
        <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
          获取股票数据失败，请稍后重试
        </div>
      )}
      <div id="drag-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {stocks.length === 0 ? (
          <div className="col-span-2 sm:col-span-3 lg:col-span-4 text-center py-10">
            <p className="text-gray-500">
              {searchQuery ? '未找到匹配的股票' : '暂无股票数据，请在 Admin 中添加股票'}
            </p>
          </div>
        ) : (
          displayItems.map((item, index) => {
            if (item._placeholder) {
              return (
                <div
                  key="_ph"
                  className="rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/40 transition-all duration-300"
                  style={{ minHeight: ghostPos ? `${ghostPos.h}px` : '100px' }}
                />
              )
            }

            const stock = stockMap[item]
            if (!stock) return null
            const origIndex = getItemOriginalIndex(item)

            return (
              <div
                key={stock.code}
                data-drag-index={origIndex}
                onMouseDown={(e) => handleMouseDown(e, origIndex)}
                style={{
                  transition: 'transform 0.3s ease, opacity 0.3s ease',
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
              >
                <StockCard stock={stock} />
              </div>
            )
          })
        )}
      </div>

      {ghostPos && draggedStock &&
        createPortal(
          <div
            id="drag-ghost"
            style={{
              position: 'fixed',
              left: ghostPos.x,
              top: ghostPos.y,
              width: ghostPos.w,
              height: ghostPos.h,
              zIndex: 9999,
              opacity: 0.9,
              transform: 'scale(1.03)',
              pointerEvents: 'none',
              boxShadow: '0 10px 40px rgba(0,0,0,0.25)',
              borderRadius: '12px',
            }}
          >
            <StockCard stock={draggedStock} />
          </div>,
          document.body
        )}
    </div>
  )
}

export default Stock
