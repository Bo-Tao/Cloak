import { useState } from 'react'

interface Props {
  toolName: string
  input: Record<string, unknown>
  toolId: string
  result?: string
  error?: string
}

export default function ToolCard({ toolName, input, toolId, result, error }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
      >
        <span className={`transition-transform text-gray-400 ${expanded ? 'rotate-90' : ''}`}>▶</span>
        <span className="font-mono text-gray-700">{toolName}</span>
        {input.file_path && (
          <span className="text-cloudy truncate">{String(input.file_path)}</span>
        )}
        {input.command && (
          <span className="text-cloudy truncate">{String(input.command).slice(0, 60)}</span>
        )}
        {error && <span className="text-red-500 ml-auto">Error</span>}
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-2">
          {Object.keys(input).length > 0 && (
            <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(input, null, 2)}
            </pre>
          )}
          {result && (
            <pre className="text-xs text-gray-500 whitespace-pre-wrap overflow-x-auto max-h-40 overflow-y-auto bg-gray-50 p-2 rounded">
              {result}
            </pre>
          )}
          {error && (
            <pre className="text-xs text-red-500 whitespace-pre-wrap">{error}</pre>
          )}
        </div>
      )}
    </div>
  )
}
