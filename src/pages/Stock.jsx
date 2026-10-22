// 股票看板 - 展示已添加股票的实时价格和涨跌幅，支持拖拽排序
import { useState, useEffect, useCallback, useRef } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { Loader2, Trash2 } from 'lucide-react'
import StockCard from '../components/StockCard'
import SortableCard from '../components/SortableCard'
import ContextMenu from '../components/ContextMenu'
import { batchFetchStockData } from '../services/realApi'
import { ensureAddedAt, resolveBasePrice, formatAddedDuration } from '../services/addedInfo'
import { logChange } from '../services/portfolioHistory'
import { readCache, writeCache } from '../services/memoryCache'
import { usePortfolioState } from '../hooks/usePortfolioState'
import { defaultStockCodes } from '../data/stockData'

function Stock({ searchQuery, refreshKey }) {
  const [stockCodes, setStockCodes] = usePortfolioState('stockCodes')
  const [stockAddedMeta, setStockAddedMeta] = usePortfolioState('stockAddedMeta')
  // 添加信息在异步流程中会多次写入，用 ref 保持最新值，避免重复触发数据加载
  const metaRef = useRef(stockAddedMeta)
  metaRef.current = stockAddedMeta
  // 首次进入会话时无缓存 -> 显示骨架屏；之后切回沿用上次数据，在后台静默刷新
  const cachedStocks = readCache('stocks')
  const [stocks, setStocks] = useState(() => cachedStocks || [])
  const [apiError, setApiError] = useState(false)
  const [isLoading, setIsLoading] = useState(() => !cachedStocks)
  const [hasLoaded, setHasLoaded] = useState(() => !!cachedStocks)
  const [activeId, setActiveId] = useState(null)
  // 右键菜单：记录坐标与被点击的股票代码
  const [menu, setMenu] = useState(null)

  const loadStockData = useCallback(async () => {
    setApiError(false)

    if (stockCodes.length === 0) {
      setStocks([])
      setIsLoading(false)
      setHasLoaded(true)
      return
    }

    setIsLoading(true)
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

      // 计算"添加后涨幅 / 添加时间"（添加时间存在服务端，基准价按需取一次历史日 K）
      const addedMeta = ensureAddedAt('stock', stockCodes, defaultStockCodes, metaRef.current)
      if (addedMeta !== metaRef.current) {
        metaRef.current = addedMeta
        setStockAddedMeta(addedMeta)
      }
      validStocks = await Promise.all(validStocks.map(async (stock) => {
        const info = addedMeta[stock.code]
        if (!info) return stock

        const addedDays = formatAddedDuration(info.addedAt)
        const { price: basePrice, patch } = await resolveBasePrice('stock', stock.code, info.addedAt, info)
        if (patch) {
          metaRef.current = { ...metaRef.current, [stock.code]: { ...metaRef.current[stock.code], ...patch } }
          setStockAddedMeta(prev => ({ ...prev, [stock.code]: { ...prev[stock.code], ...patch } }))
        }
        const addedGain = basePrice && stock.price
          ? (stock.price / basePrice - 1) * 100
          : null
        return { ...stock, addedAt: info.addedAt, addedDays, addedGain }
      }))

      // 先缓存完整数据（不含搜索过滤），供下次切回时立即渲染
      writeCache('stocks', validStocks)

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
    } finally {
      setIsLoading(false)
      setHasLoaded(true)
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
      const oldIndex = stockCodes.indexOf(active.id)
      const newIndex = stockCodes.indexOf(over.id)
      logChange({ type: 'stock', action: 'reorder', code: active.id, name: stockMap[active.id]?.name || active.id, from: oldIndex, to: newIndex })
      setStockCodes((items) => {
        const o = items.indexOf(active.id)
        const n = items.indexOf(over.id)
        return arrayMove(items, o, n)
      })
    }
  }

  const activeStock = activeId ? stockMap[activeId] : null
  // 仅在首次加载（会话内无缓存）时显示骨架屏；切回时保留旧数据，后台静默刷新
  const showSkeleton = isLoading && !hasLoaded && stockCodes.length > 0

  const openMenu = (e, code) => {
    e.preventDefault()
    e.stopPropagation()
    setMenu({ x: e.clientX, y: e.clientY, code })
  }

  const closeMenu = useCallback(() => setMenu(null), [])

  const removeStock = (code) => {
    const name = stockMap[code]?.name || code
    if (!window.confirm(`确定从看板删除「${name}」？`)) return
    setStockCodes(items => items.filter(c => c !== code))
    logChange({ type: 'stock', action: 'remove', code, name })
  }

  // 右键菜单动作：后续新增操作直接往这里追加即可
  const menuItems = menu
    ? [
        { key: 'delete', label: '删除股票', icon: Trash2, danger: true, onClick: () => removeStock(menu.code) }
      ]
    : []

  return (
    <div>
      {apiError && (
        <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
          获取股票数据失败，请稍后重试
        </div>
      )}
      {showSkeleton && (
        <div className="mb-2 flex items-center gap-1.5 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          正在加载股票数据...
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
            {showSkeleton ? (
              Array.from({ length: stockCodes.length }).map((_, i) => (
                <div key={`skeleton-${i}`} className="bg-white rounded-xl p-2 shadow-sm animate-pulse">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="h-4 w-2/3 bg-gray-200 rounded" />
                      <div className="h-3 w-1/3 bg-gray-100 rounded mt-1" />
                    </div>
                    <div className="text-right space-y-1">
                      <div className="h-5 w-14 bg-gray-200 rounded ml-auto" />
                      <div className="h-3 w-10 bg-gray-100 rounded ml-auto" />
                    </div>
                  </div>
                  <div className="h-3 w-full bg-gray-100 rounded mt-2" />
                </div>
              ))
            ) : stocks.length === 0 ? (
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
                  <SortableCard key={code} id={code} onContextMenu={(e) => openMenu(e, code)}>
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
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          title={stockMap[menu.code]?.name || menu.code}
          subtitle={menu.code}
          items={menuItems}
          onClose={closeMenu}
        />
      )}
    </div>
  )
}

export default Stock
