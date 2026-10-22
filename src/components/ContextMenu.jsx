// 通用右键菜单 - 由 items 配置驱动，后续新增右键操作只需往 items 里追加一项
// item 结构：{ key, label, icon?, danger?, disabled?, onClick } 或 { separator: true }
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export default function ContextMenu({ x, y, title, subtitle, items, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: x, top: y })

  // 贴近视口边缘时向内翻转，避免菜单溢出
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const left = x + rect.width > window.innerWidth - 8
      ? Math.max(8, x - rect.width)
      : x
    const top = y + rect.height > window.innerHeight - 8
      ? Math.max(8, y - rect.height)
      : y
    setPos({ left, top })
  }, [x, y])

  useEffect(() => {
    const handlePointerDown = (e) => {
      if (!ref.current?.contains(e.target)) onClose()
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', onClose)
    window.addEventListener('scroll', onClose, true)
    return () => {
      window.removeEventListener('mousedown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', onClose)
      window.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={ref}
      style={{ position: 'fixed', left: pos.left, top: pos.top }}
      className="z-50 min-w-[170px] bg-white rounded-lg shadow-xl border border-gray-200 py-1 select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {(title || subtitle) && (
        <div className="px-2.5 py-1.5 border-b border-gray-100">
          {title && <p className="text-xs font-medium text-gray-700 truncate max-w-[220px]">{title}</p>}
          {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      )}
      <div className="pt-0.5">
        {items.map((item, index) => (
          item.separator
            ? <div key={`sep-${index}`} className="my-1 border-t border-gray-100" />
            : (
              <button
                key={item.key}
                disabled={item.disabled}
                onClick={() => {
                  onClose()
                  item.onClick?.()
                }}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors ${
                  item.disabled
                    ? 'text-gray-300 cursor-not-allowed'
                    : item.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.icon && <item.icon size={13} className="flex-shrink-0" />}
                <span className="truncate">{item.label}</span>
              </button>
            )
        ))}
      </div>
    </div>,
    document.body
  )
}
