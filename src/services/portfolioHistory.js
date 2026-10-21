// 历史快照与变更记录服务
// - 快照：某个时间点的完整持仓清单 + 当时行情，供日后投资回顾
// - 变更记录：新增/删除/排序等操作的自动 log
// 数据持久化在 localStorage，支持导出/导入 JSON 备份

const SNAPSHOTS_KEY = 'portfolioSnapshots'
const CHANGES_KEY = 'portfolioChangeLog'
const MAX_SNAPSHOTS = 100
const MAX_CHANGES = 500

function readStore(key) {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeStore(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error('Failed to write portfolio history:', error)
  }
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function dedupeById(list) {
  const map = new Map()
  list.forEach(item => {
    if (item && item.id && !map.has(item.id)) map.set(item.id, item)
  })
  return [...map.values()]
}

// ---------- 快照 ----------

export function listSnapshots() {
  return readStore(SNAPSHOTS_KEY)
}

// 新增快照（最新的排在最前）
export function addSnapshot({ note = '', funds = [], stocks = [] }) {
  const snapshot = {
    id: makeId('snap'),
    savedAt: new Date().toISOString(),
    note,
    funds,
    stocks
  }
  const next = [snapshot, ...listSnapshots()].slice(0, MAX_SNAPSHOTS)
  writeStore(SNAPSHOTS_KEY, next)
  return snapshot
}

export function updateSnapshotNote(id, note) {
  writeStore(SNAPSHOTS_KEY, listSnapshots().map(s => (s.id === id ? { ...s, note } : s)))
}

export function deleteSnapshot(id) {
  writeStore(SNAPSHOTS_KEY, listSnapshots().filter(s => s.id !== id))
}

export function clearSnapshots() {
  writeStore(SNAPSHOTS_KEY, [])
}

// ---------- 变更记录 ----------

export function listChanges() {
  return readStore(CHANGES_KEY)
}

// 记录一条变更（最新的排在最前）
export function logChange(entry) {
  const record = {
    id: makeId('chg'),
    at: new Date().toISOString(),
    ...entry
  }
  const next = [record, ...listChanges()].slice(0, MAX_CHANGES)
  writeStore(CHANGES_KEY, next)
  return record
}

export function clearChanges() {
  writeStore(CHANGES_KEY, [])
}

// ---------- 导出 / 导入 ----------

export function exportHistory() {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    snapshots: listSnapshots(),
    changes: listChanges()
  }, null, 2)
}

// mode: 'merge' 合并去重（默认） | 'replace' 覆盖
export function importHistory(json, { mode = 'merge' } = {}) {
  const data = typeof json === 'string' ? JSON.parse(json) : json
  const snapshots = Array.isArray(data?.snapshots) ? data.snapshots : []
  const changes = Array.isArray(data?.changes) ? data.changes : []

  if (mode === 'replace') {
    writeStore(SNAPSHOTS_KEY, snapshots.slice(0, MAX_SNAPSHOTS))
    writeStore(CHANGES_KEY, changes.slice(0, MAX_CHANGES))
  } else {
    writeStore(SNAPSHOTS_KEY, dedupeById([...listSnapshots(), ...snapshots])
      .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
      .slice(0, MAX_SNAPSHOTS))
    writeStore(CHANGES_KEY, dedupeById([...listChanges(), ...changes])
      .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
      .slice(0, MAX_CHANGES))
  }

  return { snapshots: snapshots.length, changes: changes.length }
}
