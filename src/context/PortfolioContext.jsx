// 组合数据 - 登录后一次性从服务端拉取持仓列表 / 名称缓存 / 添加信息
// 本地修改先乐观更新，再防抖 300ms 整体同步到服务端（每个类型一次 PUT）
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

const TYPES = ['fund', 'stock']
const SYNC_DELAY = 300

export const PortfolioContext = createContext(null)

function sliceSignature(data, type) {
  return JSON.stringify({
    codes: data.lists[type],
    info: data.info[type],
    addedMeta: data.addedMeta[type]
  })
}

function buildSliceBody(data, type) {
  return {
    codes: data.lists[type],
    info: data.info[type],
    addedMeta: data.addedMeta[type]
  }
}

export function PortfolioProvider({ children }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const dataRef = useRef(null)
  dataRef.current = data

  const lastSent = useRef({ fund: null, stock: null })
  const timers = useRef({ fund: null, stock: null })
  const chains = useRef({ fund: Promise.resolve(), stock: Promise.resolve() })

  const applyData = useCallback((next) => {
    setData(next)
    TYPES.forEach(type => {
      lastSent.current[type] = sliceSignature(next, type)
    })
  }, [])

  const load = useCallback(async () => {
    setError(null)
    try {
      applyData(await api.get('/portfolio'))
    } catch (nextError) {
      setError(nextError)
    }
  }, [applyData])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => () => {
    TYPES.forEach(type => {
      if (timers.current[type]) clearTimeout(timers.current[type])
    })
  }, [])

  const scheduleSync = useCallback((type) => {
    if (timers.current[type]) clearTimeout(timers.current[type])
    timers.current[type] = setTimeout(() => {
      const snapshot = dataRef.current
      if (!snapshot) return
      const body = buildSliceBody(snapshot, type)
      const signature = JSON.stringify(body)
      if (signature === lastSent.current[type]) return

      // 串行发送，保证服务端最终顺序与本地一致
      chains.current[type] = chains.current[type]
        .catch(() => {})
        .then(() => api.put(`/portfolio/${type}`, body))
        .then(() => { lastSent.current[type] = signature })
        .catch(nextError => {
          console.warn(`同步${type === 'fund' ? '基金' : '股票'}数据失败:`, nextError?.message)
        })
    }, SYNC_DELAY)
  }, [])

  // 任一字段变化都触发对应类型的全量同步
  useEffect(() => {
    if (!data) return
    TYPES.forEach(type => {
      if (sliceSignature(data, type) === lastSent.current[type]) return
      scheduleSync(type)
    })
  }, [data, scheduleSync])

  // 支持函数式更新，语义与 useState 一致
  const setSlice = useCallback((section, type, updater) => {
    setData(prev => {
      if (!prev) return prev
      const current = prev[section]?.[type]
      const next = typeof updater === 'function' ? updater(current) : updater
      if (next === current) return prev
      if (JSON.stringify(next) === JSON.stringify(current)) return prev
      return { ...prev, [section]: { ...prev[section], [type]: next } }
    })
  }, [])

  const reload = useCallback(async () => {
    applyData(await api.get('/portfolio'))
  }, [applyData])

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 gap-3">
        <p className="text-sm text-gray-600">持仓数据加载失败：{error.message}</p>
        <button
          onClick={load}
          className="px-4 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600"
        >
          重试
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          正在加载持仓数据...
        </div>
      </div>
    )
  }

  return (
    <PortfolioContext.Provider value={{ data, setSlice, reload }}>
      {children}
    </PortfolioContext.Provider>
  )
}

export function usePortfolio() {
  const context = useContext(PortfolioContext)
  if (!context) throw new Error('usePortfolio must be used within PortfolioProvider')
  return context
}
