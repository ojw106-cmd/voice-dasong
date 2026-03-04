interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
}

interface Props {
  message: Message
}

export default function ChatBubble({ message }: Props) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-end gap-2`}>
      {/* 아바타 (다송) */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-green-900 flex items-center justify-center text-sm shrink-0 mb-1">
          🌲
        </div>
      )}

      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {/* 이름 레이블 */}
        <span className={`text-xs px-1 ${isUser ? 'text-right text-gray-500' : 'text-green-500'}`}>
          {isUser ? '형' : '다송'}
        </span>

        {/* 말풍선 */}
        <div
          className={`
            px-4 py-2.5 rounded-2xl text-sm leading-relaxed
            ${isUser
              ? 'bg-green-700 text-white rounded-tr-sm'
              : 'bg-gray-800 text-gray-100 rounded-tl-sm'
            }
          `}
        >
          {message.text}
        </div>

        {/* 시간 */}
        <span className="text-xs text-gray-600 px-1">
          {message.timestamp.toLocaleTimeString('ko-KR', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      {/* 아바타 (형) */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm shrink-0 mb-1">
          👤
        </div>
      )}
    </div>
  )
}
