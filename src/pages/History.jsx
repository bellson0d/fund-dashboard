// 历史页 - 手动保存持仓快照、查看变更记录、导出/导入备份
import { useState, useEffect, useCallback, useRef } from 'react'
import { Camera, Download, Upload, Trash2, ChevronDown, ChevronUp, Loader2, Pencil, Check, X, ListChecks, History as HistoryIcon } from 'lucide-react'
import { usePortfolioState } from '../hooks/usePortfolioState'
import { fetchFundQuotesMap, batchFetchStockData } from '../services/realApi'
import { ensureAddedAt, resolveBasePrice, formatAddedDuration } from '../services/addedInfo'
import {
  listSnapshots, addSnapshot, updateSnapshotNote, deleteSnapshot, clearSnapshots,
  listChanges, clearChanges, exportHistory, importHistory
} from '../services/portfolioHistory'
import { defaultFundCodes } from '../data/mockData'
import { defaultStockCodes } from '../data/stockData'

const ACTION_LABEL = { add: '添加', remove: '删除', reorder: '排序', reset: '重置默认' }
const TYPE_LABEL = { fund: '基金', stock: '股票' }

function formatDateTime(iso) {
  if (!iso) return '--'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '--'
  return d.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

function changeColor(value) {
  if (value == null) return 'text-gray-400'
  if (value > 0) return 'text-red-600'
  if (value < 0) return 'text-green-600'
  return 'text-gray-500'
}

function History() {
  const [fundCodes] = usePortfolioState('fundCodes')
  const [stockCodes] = usePortfolioState('stockCodes')
  const [fundInfoCache] = usePortfolioState('fundInfoCache')
  const [fundAddedMeta] = usePortfolioState('fundAddedMeta')
  const [stockAddedMeta] = usePortfolioState('stockAddedMeta')

  const [historyTab, setHistoryTab] = useState('snapshots')
  const [snapshots, setSnapshots] = useState([])
  const [changes, setChanges] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const fileInputRef = useRef(null)

  const refresh = useCallback(async () => {
    try {
      const [nextSnapshots, nextChanges] = await Promise.all([listSnapshots(), listChanges()])
      setSnapshots(nextSnapshots)
      setChanges(nextChanges)
    } catch (error) {
      console.warn('加载历史记录失败:', error?.message)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // 抓取当前全部基金/股票行情，存为一份完整组合快照
  // 每项同时记录添加时间，以及"添加到本次保存"区间的涨跌幅
  const handleSaveSnapshot = async () => {
    if (fundCodes.length === 0 && stockCodes.length === 0) return
    setIsSaving(true)
    try {
      const [fundQuotes, stockQuotes] = await Promise.all([
        fetchFundQuotesMap(fundCodes),
        batchFetchStockData(stockCodes)
      ])

      // 补齐添加时间（与看板相同的补种规则），并取各标的添加日基准价
      const fundMeta = ensureAddedAt('fund', fundCodes, defaultFundCodes, fundAddedMeta)
      const stockMeta = ensureAddedAt('stock', stockCodes, defaultStockCodes, stockAddedMeta)
      const now = Date.now()

      const funds = await Promise.all(fundCodes.map(async code => {
        const q = fundQuotes[code]
        const info = fundMeta[code] || {}
        const netValue = q?.nav != null ? Number(q.nav) : null
        const { price: basePrice } = info.addedAt
          ? await resolveBasePrice('fund', code, info.addedAt, info)
          : { price: null }
        return {
          code,
          name: q?.name || fundInfoCache[code] || code,
          netValue,
          change: q?.change != null ? Number(q.change) : null,
          addedAt: info.addedAt || null,
          addedDays: info.addedAt ? formatAddedDuration(info.addedAt, now) : '',
          addedGain: basePrice && netValue != null ? (netValue / basePrice - 1) * 100 : null
        }
      }))

      const stocks = await Promise.all(stockCodes.map(async code => {
        const q = stockQuotes[code]
        const info = stockMeta[code] || {}
        const price = q?.price != null ? Number(q.price) : null
        const { price: basePrice } = info.addedAt
          ? await resolveBasePrice('stock', code, info.addedAt, info)
          : { price: null }
        return {
          code,
          name: q?.name || code,
          price,
          change: q?.changePercent != null ? Number(q.changePercent) : null,
          addedAt: info.addedAt || null,
          addedDays: info.addedAt ? formatAddedDuration(info.addedAt, now) : '',
          addedGain: basePrice && price != null ? (price / basePrice - 1) * 100 : null
        }
      }))

      await addSnapshot({ funds, stocks })
      refresh()
    } catch (error) {
      console.error('Failed to save snapshot:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleNoteSave = async (id) => {
    try {
      await updateSnapshotNote(id, noteDraft.trim())
      setEditingNoteId(null)
      setNoteDraft('')
      refresh()
    } catch (error) {
      console.error('Failed to update note:', error)
    }
  }

  const handleDeleteSnapshot = async (id) => {
    if (!window.confirm('确定删除这条快照？')) return
    try {
      await deleteSnapshot(id)
      if (expandedId === id) setExpandedId(null)
      refresh()
    } catch (error) {
      console.error('Failed to delete snapshot:', error)
    }
  }

  const handleClearAll = async () => {
    if (!window.confirm('确定清空全部快照与变更记录？此操作不可恢复。')) return
    try {
      await clearSnapshots()
      await clearChanges()
      setExpandedId(null)
      refresh()
    } catch (error) {
      console.error('Failed to clear history:', error)
    }
  }

  const handleExport = async () => {
    try {
      const json = await exportHistory()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `portfolio-export-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export history:', error)
      window.alert('导出失败，请稍后重试')
    }
  }

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const result = await importHistory(await file.text(), { mode: 'merge' })
      refresh()
      window.alert(`导入完成：合并 ${result.snapshots} 条快照、${result.changes} 条变更记录`)
    } catch (error) {
      console.error('Failed to import history:', error)
      window.alert(`导入失败：${error?.message || '文件格式不正确'}`)
    }
  }

  const containerClass = 'bg-white rounded-xl shadow-sm p-3'
  const tabClass = (tab) => `px-3 py-1 text-xs rounded-lg transition-colors ${
    historyTab === tab ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
  }`

  return (
    <div className="max-w-4xl mx-auto space-y-3">
      <div className={`${containerClass} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2`}>
        <div>
          <h1 className="text-lg font-semibold text-gray-800">历史记录</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            保存当前持仓快照，或查看自动记录的增删/排序变更
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleSaveSnapshot}
            disabled={isSaving || (fundCodes.length === 0 && stockCodes.length === 0)}
            className="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
            {isSaving ? '保存中...' : '保存当前快照'}
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-1"
          >
            <Download size={12} />
            导出
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 text-xs bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-1"
          >
            <Upload size={12} />
            导入
          </button>
          <button
            onClick={handleClearAll}
            className="px-3 py-1.5 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-1"
          >
            <Trash2 size={12} />
            清空
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>
      </div>

      <div className={`${containerClass} flex items-center gap-2`}>
        <button onClick={() => setHistoryTab('snapshots')} className={tabClass('snapshots')}>
          快照 ({snapshots.length})
        </button>
        <button onClick={() => setHistoryTab('changes')} className={tabClass('changes')}>
          变更记录 ({changes.length})
        </button>
      </div>

      {historyTab === 'snapshots' ? (
        snapshots.length === 0 ? (
          <div className={`${containerClass} text-center py-10`}>
            <p className="text-gray-500 text-sm">暂无快照，点上方「保存当前快照」记录此刻持仓</p>
          </div>
        ) : (
          <div className="space-y-2">
            {snapshots.map(snapshot => {
              const isExpanded = expandedId === snapshot.id
              const isEditing = editingNoteId === snapshot.id
              return (
                <div key={snapshot.id} className={containerClass}>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : snapshot.id)}
                      className="p-1 text-gray-400 hover:text-gray-600"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {formatDateTime(snapshot.savedAt)}
                      </p>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>基金 {snapshot.funds?.length || 0} · 股票 {snapshot.stocks?.length || 0}</span>
                        {isEditing ? (
                          <span className="flex items-center gap-1">
                            <input
                              autoFocus
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleNoteSave(snapshot.id) }}
                              placeholder="备注"
                              className="px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            <button onClick={() => handleNoteSave(snapshot.id)} className="text-green-600 hover:text-green-700">
                              <Check size={12} />
                            </button>
                            <button onClick={() => { setEditingNoteId(null); setNoteDraft('') }} className="text-gray-400 hover:text-gray-600">
                              <X size={12} />
                            </button>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <span className="text-gray-600">{snapshot.note || '（无备注）'}</span>
                            <button
                              onClick={() => { setEditingNoteId(snapshot.id); setNoteDraft(snapshot.note || '') }}
                              className="text-gray-400 hover:text-gray-600"
                              title="编辑备注"
                            >
                              <Pencil size={11} />
                            </button>
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSnapshot(snapshot.id)}
                      className="p-1 text-red-400 hover:text-red-600"
                      title="删除快照"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">基金</p>
                        {snapshot.funds?.length ? snapshot.funds.map(f => (
                          <div key={f.code} className="py-1 border-b border-gray-50 last:border-0">
                            <div className="flex items-center justify-between text-xs">
                              <span className="truncate mr-2 text-gray-700">{f.name}</span>
                              <span className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-gray-500">{f.netValue != null ? f.netValue.toFixed(4) : '--'}</span>
                                <span className={`font-medium ${changeColor(f.change)}`}>
                                  {f.change != null ? `${f.change > 0 ? '+' : ''}${f.change.toFixed(2)}%` : '--'}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-0.5">
                              <span>添加 {f.addedDays || '--'}</span>
                              <span className={changeColor(f.addedGain)}>
                                添加后 {f.addedGain != null ? `${f.addedGain > 0 ? '+' : ''}${f.addedGain.toFixed(2)}%` : '--'}
                              </span>
                            </div>
                          </div>
                        )) : <p className="text-xs text-gray-400">无</p>}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">股票</p>
                        {snapshot.stocks?.length ? snapshot.stocks.map(s => (
                          <div key={s.code} className="py-1 border-b border-gray-50 last:border-0">
                            <div className="flex items-center justify-between text-xs">
                              <span className="truncate mr-2 text-gray-700">{s.name}</span>
                              <span className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-gray-500">{s.price != null ? s.price.toFixed(2) : '--'}</span>
                                <span className={`font-medium ${changeColor(s.change)}`}>
                                  {s.change != null ? `${s.change > 0 ? '+' : ''}${s.change.toFixed(2)}%` : '--'}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-0.5">
                              <span>添加 {s.addedDays || '--'}</span>
                              <span className={changeColor(s.addedGain)}>
                                添加后 {s.addedGain != null ? `${s.addedGain > 0 ? '+' : ''}${s.addedGain.toFixed(2)}%` : '--'}
                              </span>
                            </div>
                          </div>
                        )) : <p className="text-xs text-gray-400">无</p>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      ) : (
        changes.length === 0 ? (
          <div className={`${containerClass} text-center py-10`}>
            <p className="text-gray-500 text-sm flex items-center justify-center gap-1">
              <ListChecks size={14} />
              暂无变更记录，在 Admin 增删/排序后自动记录
            </p>
          </div>
        ) : (
          <div className={containerClass}>
            <div className="space-y-1">
              {changes.map(change => (
                <div key={change.id} className="flex items-center gap-2 text-xs py-1 border-b border-gray-100 last:border-0">
                  <HistoryIcon size={12} className="text-gray-400 flex-shrink-0" />
                  <span className="text-gray-500 flex-shrink-0 w-28">{formatDateTime(change.at)}</span>
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 flex-shrink-0">
                    {TYPE_LABEL[change.type] || change.type}
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 flex-shrink-0">
                    {ACTION_LABEL[change.action] || change.action}
                  </span>
                  <span className="text-gray-700 truncate">
                    {change.name || change.code}
                    {change.action === 'reorder' && change.from != null && change.to != null && (
                      <span className="text-gray-400 ml-1">第 {change.from + 1} → 第 {change.to + 1} 位</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  )
}

export default History
