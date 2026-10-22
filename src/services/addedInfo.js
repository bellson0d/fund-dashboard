// 添加信息 - 记录基金/股票的添加时间，并据此计算"添加后涨幅"
// - 新添加项：Admin 添加时记录实际日期，写入服务端持仓数据（meta 结构：{ addedAt, basePrice }）
// - 已有项：依据 git 提交记录确定的默认列表日期（见 shared/addedDefaults.js）补种，无记录者回退为"3个月前"
// - 基准价：基金取添加日的历史净值、股票取添加日的历史日 K 收盘价（前复权）
//           首次请求后写入 meta 缓存，之后不再重复请求
import { StockSDK } from 'stock-sdk'
import { createLimiter } from './concurrency'
import {
  DEFAULT_FUND_ADDED_AT, DEFAULT_STOCK_ADDED_AT, FALLBACK_MONTHS, monthsAgo, toDateStr
} from '../shared/addedDefaults'

export { DEFAULT_FUND_ADDED_AT, DEFAULT_STOCK_ADDED_AT }

const stockSDK = new StockSDK({ timeout: 15000 })

// 基准价请求限流：所有股票/基金的 kline / navHistory 请求共用，避免突发并发被数据源丢弃
const limitBasePrice = createLimiter(4)

// 基准价请求失败后的冷却时间：期间不再重试，避免每次加载都重复失败刷屏
const BASE_PRICE_FAIL_TTL = 6 * 60 * 60 * 1000

function shiftDate(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return toDateStr(d).replace(/-/g, '')
}

// 新添加项：在已有 meta 基础上写入今天的日期（返回新对象，便于 React 更新）
export function recordAddition(meta, code) {
  return {
    ...meta,
    [code]: { ...meta?.[code], addedAt: toDateStr(new Date()) }
  }
}

// 已有项：补齐缺失的添加时间（默认列表用 git 日期，其余回退 3 个月前）
// 无变化时返回原对象，调用方可据此跳过写服务端
export function ensureAddedAt(type, codes, defaultCodes, meta) {
  const current = meta || {}
  const defaultDate = type === 'fund' ? DEFAULT_FUND_ADDED_AT : DEFAULT_STOCK_ADDED_AT
  const fallback = monthsAgo(FALLBACK_MONTHS)
  const defaults = new Set(defaultCodes || [])
  let next = current
  let changed = false

  codes.forEach(code => {
    if (next[code]?.addedAt) return
    if (!changed) {
      next = { ...current }
      changed = true
    }
    next[code] = { ...next[code], addedAt: defaults.has(code) ? defaultDate : fallback }
  })

  return next
}

// 动态时长：大于 1 年 → x.x年；小于 1 年 → x天
export function formatAddedDuration(addedAt, now = Date.now()) {
  if (!addedAt) return ''
  const start = new Date(`${addedAt}T00:00:00`).getTime()
  if (Number.isNaN(start)) return ''
  const days = Math.max(0, Math.floor((now - start) / 86400000))
  if (days >= 365) return `${(days / 365).toFixed(1)}年`
  return `${days}天`
}

// 基准价：优先用缓存；失败后进入冷却期（TTL 内不再重试）；否则限流请求一次历史数据
// 返回 { price, patch }，patch 需要写回服务端 meta（成功记 basePrice，失败记冷却时间）
export async function resolveBasePrice(type, code, addedAt, entry = {}) {
  if (entry?.basePrice) return { price: entry.basePrice, patch: null }
  if (entry?.basePriceFailedAt && Date.now() - entry.basePriceFailedAt < BASE_PRICE_FAIL_TTL) {
    return { price: null, patch: null }
  }

  let price = null
  try {
    price = await limitBasePrice(() => (
      type === 'fund' ? fetchFundNavAt(code, addedAt) : fetchStockCloseAt(code, addedAt)
    ))
  } catch (error) {
    console.warn('Failed to fetch base price:', code, error?.message)
  }

  return {
    price,
    patch: price ? { basePrice: price } : { basePriceFailedAt: Date.now() }
  }
}

// 基金：历史净值中取添加日当天或之后的首个净值
async function fetchFundNavAt(code, addedAt) {
  const res = await stockSDK.fund.navHistory(code)
  return pickNearest(res?.items || [], addedAt, item => item.nav)
}

// 股票：历史日 K 中取添加日当天或之后的首个收盘价
async function fetchStockCloseAt(code, addedAt) {
  const symbol = toKlineSymbol(code)
  if (!symbol) return null
  const startDate = shiftDate(addedAt, -10)
  const endDate = shiftDate(addedAt, 10)
  const bars = await symbol.fetch(startDate, endDate)
  return pickNearest(bars || [], addedAt, bar => bar.close)
}

// 内部代码 → stock-sdk K 线符号
// 0./1. = A股(深/沪) · 116. = 港股 · 105. = 美股
function toKlineSymbol(code) {
  if (!code || typeof code !== 'string') return null

  if (code.startsWith('116.')) {
    const sym = code.substring(4)
    return { fetch: (s, e) => stockSDK.kline.hk(sym, { startDate: s, endDate: e }) }
  }
  if (code.startsWith('105.')) {
    const sym = code.substring(4)
    return { fetch: (s, e) => stockSDK.kline.us(sym, { startDate: s, endDate: e }) }
  }

  const clean = code.replace(/^[01]\./, '')
  const prefix = code.startsWith('1.') || clean.startsWith('6') ? 'sh' : 'sz'
  const sym = prefix + clean
  return { fetch: (s, e) => stockSDK.kline.cn(sym, { startDate: s, endDate: e }) }
}

// 取添加日当天或之后的最近一条；若区间内全部早于添加日，则取最后一条
function pickNearest(list, addedAt, getter) {
  if (!list || list.length === 0) return null
  const target = new Date(`${addedAt}T00:00:00`).getTime()
  let after = null
  let before = null

  for (const item of list) {
    const value = getter(item)
    if (value == null) continue
    const t = new Date(`${item.date}T00:00:00`).getTime()
    if (Number.isNaN(t)) continue

    if (t >= target) {
      if (!after || t < new Date(`${after.date}T00:00:00`).getTime()) after = item
    } else if (!before || t > new Date(`${before.date}T00:00:00`).getTime()) {
      before = item
    }
  }

  const chosen = after || before
  return chosen ? getter(chosen) : null
}
