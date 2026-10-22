// 历史快照与变更记录服务
// - 快照：某个时间点的完整持仓清单 + 当时行情，供日后投资回顾
// - 变更记录：新增/删除/排序等操作的自动 log
// 数据持久化在服务端 SQLite（按用户隔离），支持导出/导入 JSON 备份
import { api } from '../api/client'

// ---------- 快照 ----------

export async function listSnapshots() {
  const data = await api.get('/snapshots')
  return Array.isArray(data?.snapshots) ? data.snapshots : []
}

// 新增快照（最新的排在最前，服务端自动裁剪到 100 条）
export async function addSnapshot({ note = '', funds = [], stocks = [] }) {
  const data = await api.post('/snapshots', { note, funds, stocks })
  return data?.snapshot || null
}

export async function updateSnapshotNote(id, note) {
  await api.patch(`/snapshots/${encodeURIComponent(id)}`, { note })
}

export async function deleteSnapshot(id) {
  await api.del(`/snapshots/${encodeURIComponent(id)}`)
}

export async function clearSnapshots() {
  await api.del('/snapshots')
}

// ---------- 变更记录 ----------

export async function listChanges() {
  const data = await api.get('/changes')
  return Array.isArray(data?.changes) ? data.changes : []
}

// 记录一条变更（失败不影响主流程，仅打印警告）
export function logChange(entry) {
  api.post('/changes', entry).catch(error => {
    console.warn('记录变更失败:', error?.message)
  })
}

export async function clearChanges() {
  await api.del('/changes')
}

// ---------- 导出 / 导入 ----------

// 导出全量数据（v2：含持仓列表、名称缓存、添加信息、快照与变更）
export async function exportHistory() {
  const data = await api.get('/export')
  return JSON.stringify(data, null, 2)
}

// mode: 'merge' 合并去重（默认） | 'replace' 覆盖
export async function importHistory(json, { mode = 'merge' } = {}) {
  const data = typeof json === 'string' ? JSON.parse(json) : json
  const result = await api.post('/import', { mode, data })
  const counts = result?.counts || {}
  return {
    snapshots: counts.snapshots || 0,
    changes: counts.changes || 0,
    fund: counts.fund || 0,
    stock: counts.stock || 0,
    info: counts.info || { fund: 0, stock: 0 }
  }
}
