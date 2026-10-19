// 股票看板 - 展示已添加股票的实时价格和涨跌幅，支持拖拽排序
import { useState, useEffect, useCallback } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import StockCard from '../components/StockCard'
import SortableCard from '../components/SortableCard'
import { batchFetchStockData } from '../services/realApi'
import { ensureAddedAt, resolveBasePrice, formatAddedDuration } from '../services/addedInfo'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { defaultStockCodes } from '../data/stockData'

function Stock({ searchQuery, refreshKey }) {
  const [stockCodes, setStockCodes] = useLocalStorage('stockCodes', defaultStockCodes)
  const [stocks, setStocks] = useState([])
  const [apiError, setApiError] = useState(false)
  const [activeId, setActiveId] = useState(null)

  const loadStockData = useCallback(async () => {
    setApiError(false)

    if (stockCodes.length === 0) {
      setStocks([])
      return
    }

    try {
      const stockData = await batchFetchStockData(stockCodes)

      let validStocks = stockCodes.map(code => {
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

      // 计算"添加后涨幅 / 添加时间"（添加时间持久化在 localStorage，基准价按需取一次历史日 K）
      const addedMeta = ensureAddedAt('stock', stockCodes, defaultStockCodes)
      validStocks = await Promise.all(validStocks.map(async (stock) => {
        const info = addedMeta[stock.code]
        if (!info) return stock

        const addedDays = formatAddedDuration(info.addedAt)
        const basePrice = await resolveBasePrice('stock', stock.code, info.addedAt)
        const addedGain = basePrice && stock.price
          ? (stock.price / basePrice - 1) * 100
          : null
        return { ...stock, addedAt: info.addedAt, addedDays, addedGain }
      }))

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

  const stockMap = {}
  stocks.forEach(s => { stockMap[s.code] = s })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = (event) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = (event) => {
    setActiveId(null)
    const { active, over } = event
    if (over && active.id !== over.id) {
      setStockCodes((items) => {
        const oldIndex = items.indexOf(active.id)
        const newIndex = items.indexOf(over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const activeStock = activeId ? stockMap[activeId] : null

  return (
    <div>
      {apiError && (
        <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
          获取股票数据失败，请稍后重试
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={stockCodes} strategy={rectSortingStrategy}>
          <div id="drag-grid" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {stocks.length === 0 ? (
              <div className="col-span-2 sm:col-span-3 lg:col-span-4 text-center py-10">
                <p className="text-gray-500">
                  {searchQuery ? '未找到匹配的股票' : '暂无股票数据，请在 Admin 中添加股票'}
                </p>
              </div>
            ) : (
              stockCodes.map(code => {
                const stock = stockMap[code]
                if (!stock) return null
                return (
                  <SortableCard key={code} id={code}>
                    <StockCard stock={stock} />
                  </SortableCard>
                )
              })
            )}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeStock ? (
            <div style={{ opacity: 0.9, transform: 'scale(1.03)', boxShadow: '0 10px 40px rgba(0,0,0,0.25)', borderRadius: '12px' }}>
              <StockCard stock={activeStock} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

export default Stock
