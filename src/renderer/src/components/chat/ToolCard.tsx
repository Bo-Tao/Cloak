import { useState } from 'react'
import {
  FileText,
  Pencil,
  Terminal,
  Search,
  Globe,
  FolderOpen,
  Code,
  Wrench,
} from 'lucide-react'
import type { RiskLevel } from '../../../../shared/types'
import DiffView from './DiffView'

interface Props {
  toolName: string
  input: Record<string, unknown>
  toolId: string
  result?: string
  error?: string
  riskLevel?: RiskLevel
  autoAccepted?: boolean
}

const TOOL_ICONS: Record<string, React.ElementType> = {
  Read: FileText,
  Write: Pencil,
  Edit: Pencil,
  Bash: Terminal,
  Grep: Search,
  Glob: FolderOpen,
  WebSearch: Globe,
  WebFetch: Globe,
  NotebookEdit: Code,
}

const RISK_STYLES: Record<RiskLevel, string> = {
  low: 'bg-blue-100 text-blue-700',
  medium: 'bg-orange-100 text-orange-700',
  high: 'bg-red-100 text-red-700',
}

function inferRisk(name: string): RiskLevel {
  const low = ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch', 'LS', 'Result']
  const med = ['Write', 'Edit', 'NotebookEdit']
  if (low.includes(name)) return 'low'
  if (med.includes(name)) return 'medium'
  return 'high'
}

function getOperationSummary(toolName: string, input: Record<string, unknown>): string {
  if (input.file_path) return String(input.file_path)
  if (input.command) return String(input.command).slice(0, 80)
  if (input.pattern) return String(input.pattern)
  if (input.query) return String(input.query).slice(0, 60)
  if (input.url) return String(input.url).slice(0, 60)
  return ''
}

export default function ToolCard({
  toolName,
  input,
  toolId,
  result,
  error,
  riskLevel,
  autoAccepted,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const risk = riskLevel ?? inferRisk(toolName)
  const Icon = TOOL_ICONS[toolName] ?? Wrench
  const summary = getOperationSummary(toolName, input)
  const showDiff = (toolName === 'Edit' || toolName === 'Write') && input.old_string !== undefined

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-surface">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50 transition-colors"
      >
        <span
          className={`transition-transform text-gray-400 ${expanded ? 'rotate-90' : ''}`}
        >
          ▶
        </span>
        <Icon className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <span className="font-mono text-gray-700 shrink-0">{toolName}</span>
        {summary && (
          <span className="text-cloudy truncate">{summary}</span>
        )}
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {autoAccepted && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-yellow-100 text-yellow-700">
              Auto
            </span>
          )}
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${RISK_STYLES[risk]}`}
          >
            {risk}
          </span>
          {error && <span className="text-red-500 text-[10px]">Error</span>}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-2">
          {Object.keys(input).length > 0 && !showDiff && (
            <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">
              {JSON.stringify(input, null, 2)}
            </pre>
          )}
          {showDiff && (
            <DiffView
              oldValue={String(input.old_string ?? '')}
              newValue={String(input.new_string ?? '')}
              fileName={String(input.file_path ?? '')}
            />
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
