import { ArrowUp, Plus, Square } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '../ui/select'

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
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id)
  const [selectedReasoning, setSelectedReasoning] = useState(REASONING_LEVELS[0].id)

  return (
    <div className="flex items-center justify-between px-3 pb-3">
      {/* Left: action buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-text-secondary hover:text-text-primary"
        >
          <Plus className="size-4" />
        </Button>

        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger
            className="h-auto border-none bg-transparent shadow-none px-2 py-1 text-sm font-normal text-text-secondar
         -y cursor-pointer gap-1 focus:ring-0 hover:bg-gray-100"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectGroup>
              <SelectLabel className="text-text-secondary/60">请选择模型</SelectLabel>
              {MODELS.map(model => (
                <SelectItem key={model.id} value={model.id}>
                  {model.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Select value={selectedReasoning} onValueChange={setSelectedReasoning}>
          <SelectTrigger
            className="h-auto border-none bg-transparent shadow-none px-2 py-1 text-sm font-normal text-text-secondar
         -y cursor-pointer gap-1 focus:ring-0 hover:bg-gray-100"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectGroup>
              <SelectLabel className="text-text-secondary/60">请选择推理模式</SelectLabel>
              {REASONING_LEVELS.map(level => (
                <SelectItem key={level.id} value={level.id}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
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
