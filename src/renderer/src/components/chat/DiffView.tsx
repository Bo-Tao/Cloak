import { useState } from 'react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'

interface Props {
  oldValue: string
  newValue: string
  fileName?: string
}

export default function DiffView({ oldValue, newValue, fileName }: Props) {
  const [splitView, setSplitView] = useState(false)

  return (
    <div className="rounded-lg overflow-hidden border border-gray-200">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
        {fileName && (
          <span className="text-xs font-mono text-gray-600 truncate">{fileName}</span>
        )}
        <button
          onClick={() => setSplitView(!splitView)}
          className="text-[10px] text-cloudy hover:text-gray-600 transition-colors ml-auto"
        >
          {splitView ? 'Unified' : 'Split'}
        </button>
      </div>
      <div className="text-xs overflow-x-auto">
        <ReactDiffViewer
          oldValue={oldValue}
          newValue={newValue}
          splitView={splitView}
          useDarkTheme={false}
          compareMethod={DiffMethod.WORDS}
          styles={{
            contentText: { fontSize: '12px', lineHeight: '1.5' },
          }}
        />
      </div>
    </div>
  )
}
