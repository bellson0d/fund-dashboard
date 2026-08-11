// 基金看板 - 展示已添加基金的净值和持仓，支持拖拽排序
import { useState, useEffect, useCallback } from 'react'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import FundCard from '../components/FundCard'
import SortableCard from '../components/SortableCard'
import { fetchFundData } from '../services/api'
import { fetchFundRealData, batchFetchStockData } from '../services/realApi'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { defaultFundCodes } from '../data/mockData'

function Dashboard({ searchQuery, refreshKey, useRealApi }) {
  const [fundCodes, setFundCodes] = useLocalStorage('fundCodes', defaultFundCodes)
  const [funds, setFunds] = useState([])
  const [apiError, setApiError] = useState(false)
  const [activeId, setActiveId] = useState(null)

  const loadFundData = useCallback(async () => {
    setApiError(false)

    const fetchFn = useRealApi ? fetchFundRealData : fetchFundData

    const results = await Promise.all(
      fundCodes.map(code => fetchFn(code))
    )

    let validFunds = results.filter(Boolean)

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
      const mockResults = await Promise.all(
        fundCodes.map(code => fetchFundData(code))
      )
      validFunds = mockResults.filter(Boolean)
    }

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

  return (
    <div>
      {apiError && (
        <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
          真实API获取失败，已自动切换到模拟数据
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
            {funds.length === 0 ? (
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
