// 基金/股票"添加时间"的默认规则（前后端共用）
// 由 git log 推导：现有默认列表的加入日期
export const DEFAULT_FUND_ADDED_AT = '2026-05-14'   // commit 6f06261 更新默认配置
export const DEFAULT_STOCK_ADDED_AT = '2026-05-15'  // commit 78bef6f 更新默认股票列表

// 无添加时间记录时的回退时长（"暂时以过去 3 个月涨幅为基础数据"）
export const FALLBACK_MONTHS = 3

export function toDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function monthsAgo(months, from = new Date()) {
  const d = new Date(from)
  d.setMonth(d.getMonth() - months)
  return toDateStr(d)
}
