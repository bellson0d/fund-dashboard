// 基金看板 - 展示已添加基金的净值和持仓，支持拖拽排序
import { useState, useEffect, useCallback } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { Loader2 } from 'lucide-react'
import FundCard from '../components/FundCard'
import SortableCard from '../components/SortableCard'
import { fetchFundData } from '../services/api'
import { fetchFundsRealData, batchFetchStockData } from '../services/realApi'
import { ensureAddedAt, resolveBasePrice, formatAddedDuration } from '../services/addedInfo'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { defaultFundCodes } from '../data/mockData'

function Dashboard({ searchQuery, refreshKey, useRealApi }) {
  const [fundCodes, setFundCodes] = useLocalStorage('fundCodes', defaultFundCodes)
  const [funds, setFunds] = useState([])
  const [apiError, setApiError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)

  const loadFundData = useCallback(async () => {
    setApiError(false)

    if (fundCodes.length === 0) {
      setFunds([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      let usingReal = useRealApi
      let validFunds

      if (useRealApi) {
        // 真实接口：一次批量请求取回全部基金行情（原先每只基金各一次），持仓逐只限流获取
        validFunds = await fetchFundsRealData(fundCodes)
      } else {
        const results = await Promise.all(
          fundCodes.map(code => fetchFundData(code))
        )
        validFunds = results.filter(Boolean)
      }

      if (useRealApi && validFunds.length > 0) {
        const secids = []
        validFunds.forEach(fund => {
          fund.holdings.forEach(holding => {
            if (holding.code && !secids.includes(holding.code)) {
              secids.push(holding.code)
            }
          })
        })

        if (secids.length > 0) {
          try {
            const stockData = await batchFetchStockData(secids)

            validFunds = validFunds.map(fund => ({
              ...fund,
              holdings: fund.holdings.map(holding => {
                let realData = null
                if (holding.code) {
                  realData = stockData[holding.code]
                  if (!realData) {
                    const cleanCode = holding.code.replace(/^[01]\./, '')
                    realData = stockData[cleanCode]
                  }
                }
                if (realData) {
                  return {
                    ...holding,
                    name: realData.name || holding.name,
                    change: realData.changePercent || holding.change,
                    price: realData.price
                  }
                }
                return holding
              })
            }))
          } catch (error) {
            console.error('Failed to fetch batch stock data:', error)
          }
        }
      }

      if (useRealApi && validFunds.length === 0) {
        setApiError(true)
        usingReal = false
        const mockResults = await Promise.all(
          fundCodes.map(code => fetchFundData(code))
        )
        validFunds = mockResults.filter(Boolean)
      }

      // 计算"添加后涨幅 / 添加时间"（添加时间持久化在 localStorage，基准价按需取一次历史净值）
      const addedMeta = ensureAddedAt('fund', fundCodes, defaultFundCodes)
      validFunds = await Promise.all(validFunds.map(async (fund) => {
        const info = addedMeta[fund.code]
        if (!info) return fund

        const addedDays = formatAddedDuration(info.addedAt)
        if (!usingReal) return { ...fund, addedAt: info.addedAt, addedDays }

        const basePrice = await resolveBasePrice('fund', fund.code, info.addedAt)
        const addedGain = basePrice && fund.netValue
          ? (fund.netValue / basePrice - 1) * 100
          : null
        return { ...fund, addedAt: info.addedAt, addedDays, addedGain }
      }))

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
    } finally {
      setIsLoading(false)
    }
  }, [fundCodes, searchQuery, useRealApi])

  useEffect(() => {
    loadFundData()
  }, [loadFundData, refreshKey])

  const fundMap = {}
  funds.forEach(f => { fundMap[f.code] = f })

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
      setFundCodes((items) => {
        const oldIndex = items.indexOf(active.id)
        const newIndex = items.indexOf(over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const activeFund = activeId ? fundMap[activeId] : null
  // 仅在"有数据待加载"时显示骨架屏：无基金时直接显示空状态
  const showSkeleton = isLoading && fundCodes.length > 0

  return (
    <div>
      {apiError && (
        <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
          真实API获取失败，已自动切换到模拟数据
        </div>
      )}
      {showSkeleton && (
        <div className="mb-2 flex items-center gap-1.5 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          正在加载基金数据...
        </div>
      )}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={fundCodes} strategy={rectSortingStrategy}>
          <div id="drag-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {showSkeleton ? (
              Array.from({ length: fundCodes.length }).map((_, i) => (
                <div key={`skeleton-${i}`} className="bg-white rounded-xl p-2 shadow-sm animate-pulse">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="h-4 w-3/4 bg-gray-200 rounded" />
                      <div className="h-3 w-1/3 bg-gray-100 rounded mt-1" />
                    </div>
                    <div className="text-right space-y-1">
                      <div className="h-5 w-16 bg-gray-200 rounded ml-auto" />
                      <div className="h-3 w-10 bg-gray-100 rounded ml-auto" />
                    </div>
                  </div>
                  <div className="h-3 w-1/2 bg-gray-100 rounded mt-2" />
                  <div className="border-t border-gray-200/50 pt-2 mt-1 grid grid-cols-2 gap-x-3 gap-y-1">
                    {Array.from({ length: 8 }).map((_, j) => (
                      <div key={j} className="h-3 bg-gray-100 rounded" />
                    ))}
                  </div>
                </div>
              ))
            ) : funds.length === 0 ? (
              <div className="col-span-1 sm:col-span-2 lg:col-span-3 text-center py-10">
                <p className="text-gray-500">
                  {searchQuery ? '未找到匹配的基金' : '暂无基金数据，请在 Admin 中添加基金'}
                </p>
              </div>
            ) : (
              fundCodes.map(code => {
                const fund = fundMap[code]
                if (!fund) return null
                return (
                  <SortableCard key={code} id={code}>
                    <FundCard fund={fund} />
                  </SortableCard>
                )
              })
            )}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={null}>
          {activeFund ? (
            <div style={{ opacity: 0.9, transform: 'scale(1.03)', boxShadow: '0 10px 40px rgba(0,0,0,0.25)', borderRadius: '12px' }}>
              <FundCard fund={activeFund} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}

export default Dashboard
