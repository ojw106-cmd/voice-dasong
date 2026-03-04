import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

    // Anthropic API가 placeholder면 기본 응답
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'placeholder_for_now') {
      const userMsg = messages[messages.length - 1]?.content || ''
      return NextResponse.json({
        reply: `형 말 들었어. "${userMsg.slice(0, 30)}" — 아직 Claude 연동 준비 중이야. 곧 제대로 답할게!`,
      })
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })

    const reply = response.content[0]?.type === 'text' ? response.content[0].text : '음.. 뭔가 오류났어. 다시 물어봐'

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Claude API 오류:', error)
    return NextResponse.json({ error: 'Chat 실패' }, { status: 500 })
  }
}
