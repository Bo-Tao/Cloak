import type { ChatMessage } from '../../../../shared/types'
import MarkdownRenderer from './MarkdownRenderer'
import ThinkingBlock from './ThinkingBlock'
import ToolCard from './ToolCard'

interface Props {
  message: ChatMessage
}

export default function AssistantMessage({ message }: Props) {
  return (
    <div className="flex justify-start px-4 py-2">
      <div className="max-w-[85%] space-y-2">
        {message.blocks.map((block, i) => {
          switch (block.type) {
            case 'text':
              return <MarkdownRenderer key={i} content={block.content} />
            case 'thinking':
              return <ThinkingBlock key={i} content={block.content} />
            case 'tool_use':
              return (
                <ToolCard
                  key={i}
                  toolName={block.name}
                  input={block.input}
                  toolId={block.toolId}
                />
              )
            case 'tool_result':
              return (
                <ToolCard
                  key={i}
                  toolName="Result"
                  input={{}}
                  toolId={block.toolId}
                  result={block.output}
                  error={block.error}
                />
              )
            default:
              return null
          }
        })}
        {message.cost && (
          <p className="text-[10px] text-cloudy mt-1">
            {message.cost.inputTokens + message.cost.outputTokens} tokens
            {message.cost.usdCost > 0 && ` · $${message.cost.usdCost.toFixed(4)}`}
          </p>
        )}
      </div>
    </div>
  )
}
