import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `너는 다송이야. 진원이형의 AI 어시스턴트.
- 반말로 친근하게 대화해
- 음성 대화라서 짧고 자연스럽게 답해 (보통 1-3문장)
- 너무 길게 답하지 마 — 음성으로 듣기 편하게
- 투자, 일상, 업무 뭐든 도와줘
- 이전 대화 맥락 기억해서 연속성 있게 대화해
- 이모지 많이 쓰지 마 (음성으로 읽히니까)
- 형이 투자 관련 물으면 솔직하게 의견 줘도 돼`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { messages }: { messages: Message[] } = await req.json()

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: '메시지 없음' }, { status: 400 })
    }

    const proxyUrl = process.env.PROXY_URL || process.env.NEXT_PUBLIC_PROXY_URL
    const proxySecret = process.env.PROXY_SECRET

    // Mac mini 프록시 사용
    if (proxyUrl && proxySecret) {
      const proxyRes = await fetch(`${proxyUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${proxySecret}`,
        },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          system: SYSTEM_PROMPT,
        }),
      })

      if (!proxyRes.ok) {
        const errText = await proxyRes.text()
        console.error('프록시 오류:', proxyRes.status, errText)
        return NextResponse.json({ error: `프록시 오류: ${proxyRes.status}` }, { status: proxyRes.status })
      }

      const data = await proxyRes.json()
      // Anthropic API 응답 형식에서 텍스트 추출
      const reply =
        data.content?.[0]?.type === 'text'
          ? data.content[0].text
          : data.reply || '음.. 뭔가 오류났어. 다시 물어봐'

      return NextResponse.json({ reply })
    }

    // Fallback: 프록시 미설정 시 기본 응답
    const userMsg = messages[messages.length - 1]?.content || ''
    return NextResponse.json({
      reply: `형 말 들었어. "${userMsg.slice(0, 30)}" — 프록시 연결이 아직 설정 안 됐어. PROXY_URL이랑 PROXY_SECRET 환경변수 확인해줘!`,
    })
  } catch (error) {
    console.error('Chat 오류:', error)
    return NextResponse.json({ error: 'Chat 실패' }, { status: 500 })
  }
}
