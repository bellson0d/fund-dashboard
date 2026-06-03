// 基金看板 - 展示已添加基金的净值和持仓，支持 iOS 风格拖拽排序
import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import FundCard from '../components/FundCard'
import { fetchFundData } from '../services/api'
import { fetchFundRealData, batchFetchStockData } from '../services/realApi'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useDragSort } from '../hooks/useDragSort'
import { defaultFundCodes } from '../data/mockData'

function Dashboard({ searchQuery, refreshKey, useRealApi }) {
  const [fundCodes, setFundCodes] = useLocalStorage('fundCodes', defaultFundCodes)
  const [funds, setFunds] = useState([])
  const [apiError, setApiError] = useState(false)

  const loadFundData = useCallback(async () => {
    setApiError(false)

    const fetchFn = useRealApi ? fetchFundRealData : fetchFundData

    const results = await Promise.all(
      fundCodes.map(code => fetchFn(code))
    )

    let validFunds = results.filter(Boolean)

    // 真实模式下，获取基金持仓股票的实时涨跌
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

    // 真实 API 失败时降级到模拟数据
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

  const { isDragging, dragIndex, displayItems, ghostPos, handleMouseDown, getItemOriginalIndex } = useDragSort(fundCodes, setFundCodes)

  // 通过 code 查找基金数据
  const fundMap = {}
  funds.forEach(f => { fundMap[f.code] = f })

  // 幽灵卡片数据
  const draggedFund = isDragging ? fundMap[fundCodes[dragIndex]] : null

  return (
    <div>
      {apiError && (
        <div className="mb-2 p-2 bg-yellow-100 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
          真实API获取失败，已自动切换到模拟数据
        </div>
      )}
      <div id="drag-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {funds.length === 0 ? (
          <div className="col-span-1 sm:col-span-2 lg:col-span-3 text-center py-10">
            <p className="text-gray-500">
              {searchQuery ? '未找到匹配的基金' : '暂无基金数据，请在 Admin 中添加基金'}
            </p>
          </div>
        ) : (
          displayItems.map((item, index) => {
            // 占位卡片
            if (item._placeholder) {
              return (
                <div
                  key="_ph"
                  className="rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/40 transition-all duration-300"
                  style={{ minHeight: ghostPos ? `${ghostPos.h}px` : '220px' }}
                />
              )
            }

            // 真实卡片
            const fund = fundMap[item]
            if (!fund) return null
            const origIndex = getItemOriginalIndex(item)

            return (
              <div
                key={fund.code}
                data-drag-index={origIndex}
                onMouseDown={(e) => handleMouseDown(e, origIndex)}
                style={{
                  transition: 'transform 0.3s ease, opacity 0.3s ease',
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
              >
                <FundCard fund={fund} />
              </div>
            )
          })
        )}
      </div>

      {/* 拖拽幽灵卡片 */}
      {ghostPos && draggedFund &&
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
            <FundCard fund={draggedFund} />
          </div>,
          document.body
        )}
    </div>
  )
}

export default Dashboard
