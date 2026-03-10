import { useState } from 'react'
import { Plus, ArrowUp, Square, ChevronDown } from 'lucide-react'
import { Button } from '../ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

const MODELS = [
  { id: 'custom', label: '自定义' },
  { id: 'claude-sonnet', label: 'Claude Sonnet' },
  { id: 'claude-opus', label: 'Claude Opus' },
  { id: 'gpt-4o', label: 'GPT-4o' },
]

const REASONING_LEVELS = [
  { id: 'high', label: '高' },
  { id: 'medium', label: '中' },
  { id: 'low', label: '低' },
  { id: 'none', label: '无' },
]

interface InputToolbarProps {
  isStreaming: boolean
  canSend: boolean
  onSend: () => void
  onStop: () => void
}

export default function InputToolbar({ isStreaming, canSend, onSend, onStop }: InputToolbarProps) {
  const [selectedModel, setSelectedModel] = useState(MODELS[0])
  const [selectedReasoning, setSelectedReasoning] = useState(REASONING_LEVELS[0])
  const [modelOpen, setModelOpen] = useState(false)
  const [reasoningOpen, setReasoningOpen] = useState(false)

  return (
    <div className="flex items-center justify-between px-3 pb-3">
      {/* Left: action buttons */}
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon-sm" className="text-text-secondary hover:text-text-primary">
          <Plus className="size-4" />
        </Button>

        <Popover open={modelOpen} onOpenChange={setModelOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-text-secondary hover:text-text-primary gap-1 text-sm font-normal">
              {selectedModel.label}
              <ChevronDown className="size-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="start">
            {MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  setSelectedModel(model)
                  setModelOpen(false)
                }}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                  selectedModel.id === model.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                }`}
              >
                {model.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        <Popover open={reasoningOpen} onOpenChange={setReasoningOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-text-secondary hover:text-text-primary gap-1 text-sm font-normal">
              {selectedReasoning.label}
              <ChevronDown className="size-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-32 p-1" align="start">
            {REASONING_LEVELS.map((level) => (
              <button
                key={level.id}
                onClick={() => {
                  setSelectedReasoning(level)
                  setReasoningOpen(false)
                }}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
                  selectedReasoning.id === level.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                }`}
              >
                {level.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>
      </div>

      {/* Right: send/stop button */}
      {isStreaming ? (
        <Button
          onClick={onStop}
          size="icon-sm"
          className="rounded-full bg-red-500 hover:bg-red-600 text-white"
        >
          <Square className="size-3.5" />
        </Button>
      ) : (
        <Button
          onClick={onSend}
          disabled={!canSend}
          size="icon-sm"
          className="rounded-full bg-text-secondary hover:bg-text-primary text-white disabled:opacity-30"
        >
          <ArrowUp className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
