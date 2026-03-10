import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  label: string
  shortcut?: string
  children: ReactNode
}

export default function Tooltip({ label, shortcut, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

  const show = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), 400)
  }, [])

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setVisible(false)
  }, [])

  useEffect(() => {
    if (!visible || !triggerRef.current) return
    // contents 元素没有盒模型，取实际子元素的位置
    const el = triggerRef.current.firstElementChild as HTMLElement | null
    if (!el) return
    const rect = el.getBoundingClientRect()
    setPos({
      top: rect.bottom + 8,
      left: rect.left + rect.width / 2
    })
  }, [visible])

  return (
    <div ref={triggerRef} className="contents" onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {visible &&
        createPortal(
          <div
            className="fixed px-2.5 py-1.5 bg-pampas rounded-lg shadow-lg border border-[#F0EEE6] flex items-center gap-2 whitespace-nowrap z-50 pointer-events-none -translate-x-1/2"
            style={{ top: pos.top, left: pos.left }}
          >
            <span className="text-xs text-gray-600">{label}</span>
            {shortcut && (
              <kbd className="text-[11px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 font-sans">
                {shortcut}
              </kbd>
            )}
          </div>,
          document.body
        )}
    </div>
  )
}
