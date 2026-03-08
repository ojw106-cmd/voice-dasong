'use client'
import { useRouter } from 'next/navigation'

const agents = [
  { id: 'main',    emoji: '🌲', name: '다송',   role: 'PM / 일상',       color: 'bg-green-600' },
  { id: 'sangwoo', emoji: '💼', name: '상보',   role: '투자 CIO',        color: 'bg-blue-600' },
  { id: 'michael', emoji: '🔧', name: '마이클', role: 'CTO',             color: 'bg-purple-600' },
  { id: 'lincoln', emoji: '⚖️', name: '링컨',   role: '변호사',          color: 'bg-amber-700' },
  { id: 'zamsae',  emoji: '📝', name: '잠새',   role: '트위터 작가',     color: 'bg-sky-600' },
  { id: 'intern',  emoji: '📊', name: '드니로', role: '리서치 인턴',     color: 'bg-orange-600' },
  { id: 'minwook', emoji: '🏥', name: '민욱',   role: '에어스 COO',      color: 'bg-teal-600' },
  { id: 'karina',  emoji: '💅', name: '카리나', role: 'PA',              color: 'bg-pink-600' },
]

export default function Home() {
  const router = useRouter()

  return (
    <main className="flex flex-col h-screen max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold text-green-400 text-center py-4">🎙️ 보이스 에이전트</h1>
      <p className="text-center text-gray-500 text-sm mb-6">대화할 에이전트를 선택하세요</p>

      <div className="flex-1 overflow-y-auto space-y-3">
        {agents.map((a) => (
          <button
            key={a.id}
            onClick={() => router.push(`/chat/${a.id}`)}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gray-800 hover:bg-gray-700 active:scale-[0.98] transition-all"
          >
            <div className={`w-14 h-14 rounded-full ${a.color} flex items-center justify-center text-2xl shrink-0`}>
              {a.emoji}
            </div>
            <div className="text-left">
              <div className="text-white font-semibold text-lg">{a.name}</div>
              <div className="text-gray-400 text-sm">{a.role}</div>
            </div>
          </button>
        ))}
      </div>
    </main>
  )
}
