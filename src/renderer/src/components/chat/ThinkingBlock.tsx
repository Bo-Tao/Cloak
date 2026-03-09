import { useState } from 'react'

interface Props {
  content: string
}

export default function ThinkingBlock({ content }: Props) {
  const [expanded, setExpanded] = useState(false)

  if (!content) return null

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-cloudy hover:bg-gray-50 transition-colors"
      >
        <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
        <span>Thinking...</span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-xs text-gray-500 whitespace-pre-wrap border-t border-gray-100">
          {content}
        </div>
      )}
    </div>
  )
}
