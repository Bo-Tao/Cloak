import type { ChatMessage } from '../../../../shared/types'

interface Props {
  message: ChatMessage
}

export default function UserMessage({ message }: Props) {
  const textContent = message.blocks
    .filter((b) => b.type === 'text')
    .map((b) => (b.type === 'text' ? b.content : ''))
    .join('\n')

  return (
    <div className="flex justify-end px-4 py-2">
      <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-terracotta text-white px-4 py-3">
        <p className="text-sm whitespace-pre-wrap">{textContent}</p>
      </div>
    </div>
  )
}
