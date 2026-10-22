// 持仓状态 - 替代原 useLocalStorage，读写改为服务端数据（PortfolioContext）
// 用法与 useState 相同，支持函数式更新
import { useCallback } from 'react'
import { usePortfolio } from '../context/PortfolioContext'

const KEY_MAP = {
  fundCodes: ['lists', 'fund'],
  stockCodes: ['lists', 'stock'],
  fundInfoCache: ['info', 'fund'],
  stockInfoCache: ['info', 'stock'],
  fundAddedMeta: ['addedMeta', 'fund'],
  stockAddedMeta: ['addedMeta', 'stock']
}

export function usePortfolioState(key) {
  const { data, setSlice } = usePortfolio()
  const mapping = KEY_MAP[key]
  if (!mapping) throw new Error(`usePortfolioState: 未知的键 ${key}`)

  const [section, type] = mapping
  const value = data[section][type]
  const setValue = useCallback(
    (updater) => setSlice(section, type, updater),
    [setSlice, section, type]
  )

  return [value, setValue]
}
