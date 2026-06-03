// iOS 风格拖拽排序 Hook
// - 原位置卡片折叠消失，后面卡片自然上移填充
// - 半透明占位卡片出现在插入位置，提示松手后的目标位置
// - 幽灵卡片跟随鼠标，其他卡片平滑过渡动画
import { useState, useRef, useCallback, useEffect } from 'react'

export function useDragSort(items, setItems) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)
  const [ghostPos, setGhostPos] = useState(null)
  const [offset, setOffset] = useState({ dx: 0, dy: 0 })
  const dragIndexRef = useRef(null)
  const overIndexRef = useRef(null)
  const itemsRef = useRef(items)

  useEffect(() => { itemsRef.current = items }, [items])

  const isDragging = dragIndex !== null

  // 计算展示用的数组：移除被拖拽项，在 overIndex 处插入占位标记
  const displayItems = (() => {
    if (!isDragging) return items

    const result = []
    const total = items.length

    for (let i = 0; i < total; i++) {
      if (i === dragIndex) continue // 跳过被拖拽项

      // 如果当前应该插入占位符
      if (overIndex <= dragIndex && i === overIndex) {
        result.push({ _placeholder: true })
      }
      if (overIndex > dragIndex && i === overIndex - 1) {
        result.push(items[i])
        result.push({ _placeholder: true })
        continue
      }

      result.push(items[i])
    }

    // 拖到末尾
    if (overIndex >= total) {
      result.push({ _placeholder: true })
    }

    return result
  })()

  const handleMouseDown = useCallback((e, index) => {
    if (e.button !== 0) return
    e.preventDefault()

    const rect = e.currentTarget.getBoundingClientRect()
    dragIndexRef.current = index
    overIndexRef.current = index
    setDragIndex(index)
    setOverIndex(index)
    setOffset({ dx: e.clientX - rect.left, dy: e.clientY - rect.top })
    setGhostPos({ x: rect.left, y: rect.top, w: rect.width, h: rect.height })
  }, [])

  // 全局事件: mousemove + mouseup
  useEffect(() => {
    if (dragIndex === null) return

    const onMove = (e) => {
      if (dragIndexRef.current === null) return

      setGhostPos(prev => ({
        ...prev,
        x: e.clientX - offset.dx,
        y: e.clientY - offset.dy,
      }))

      // 通过 elementsFromPoint 检测鼠标下方卡片
      const ghost = document.getElementById('drag-ghost')
      if (ghost) ghost.style.pointerEvents = 'none'

      const els = document.elementsFromPoint(e.clientX, e.clientY)
      if (ghost) ghost.style.pointerEvents = 'auto'

      let found = false
      for (const el of els) {
        const wrapper = el.closest('[data-drag-index]')
        if (wrapper) {
          const idx = parseInt(wrapper.dataset.dragIndex)
          if (idx !== dragIndexRef.current) {
            overIndexRef.current = idx
            setOverIndex(idx)
            found = true
          }
          break
        }
      }

      // 鼠标在最后一张卡之后 → 插入到末尾
      if (!found) {
        const grid = document.getElementById('drag-grid')
        if (grid) {
          const lastCard = grid.querySelector('[data-drag-index]:last-of-type')
          if (lastCard) {
            const lastRect = lastCard.getBoundingClientRect()
            if (e.clientY > lastRect.bottom + 20 || (e.clientY > lastRect.top && e.clientX > lastRect.right)) {
              const end = itemsRef.current.length
              if (overIndexRef.current !== end) {
                overIndexRef.current = end
                setOverIndex(end)
              }
            }
          }
        }
      }
    }

    const onUp = () => {
      const from = dragIndexRef.current
      const to = overIndexRef.current
      if (from !== null && to !== null && from !== to) {
        const newItems = [...itemsRef.current]
        const [moved] = newItems.splice(from, 1)
        newItems.splice(to > from ? to - 1 : to, 0, moved)
        setItems(newItems)
      }
      dragIndexRef.current = null
      overIndexRef.current = null
      setDragIndex(null)
      setOverIndex(null)
      setGhostPos(null)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'

    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
  }, [dragIndex, offset, setItems])

  // 获取每个 item 的原始 index（在 items 中的位置）
  const getItemOriginalIndex = useCallback((item) => {
    return items.indexOf(item)
  }, [items])

  return {
    isDragging,
    displayItems,
    dragIndex,
    overIndex,
    ghostPos,
    handleMouseDown,
    getItemOriginalIndex,
  }
}
