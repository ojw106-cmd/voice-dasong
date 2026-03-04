import { NextRequest, NextResponse } from 'next/server'

interface Message {
  role: 'user' | 'assistant'
  text: string
  timestamp: string
}

interface SessionData {
  messages: Message[]
  timestamp: string
}

export async function POST(req: NextRequest) {
  try {
    const data: SessionData = await req.json()
    const { messages, timestamp } = data

    if (!messages || messages.length === 0) {
      return NextResponse.json({ ok: true, saved: false, reason: '빈 대화' })
    }

    // 대화 텍스트 구성
    const conversation = messages
      .map((m) => `${m.role === 'user' ? '형' : '다송'}: ${m.text}`)
      .join('\n')

    // 요약 생성 (프록시 통해서)
    let summary = '(요약 없음 — 프록시 미설정)'

    const proxyUrl = process.env.PROXY_URL || process.env.NEXT_PUBLIC_PROXY_URL
    const proxySecret = process.env.PROXY_SECRET

    if (proxyUrl && proxySecret) {
      try {
        const proxyRes = await fetch(`${proxyUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${proxySecret}`,
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: `다음 음성 대화를 3줄 이내로 한국어로 요약해줘:\n\n${conversation}`,
              },
            ],
          }),
        })

        if (proxyRes.ok) {
          const resData = await proxyRes.json()
          const text =
            resData.content?.[0]?.type === 'text'
              ? resData.content[0].text
              : resData.reply
          if (text) summary = text
        }
      } catch {
        summary = '요약 생성 실패'
      }
    }

    // Vercel 환경에서는 파일 시스템 저장 불가 → 요약만 반환
    return NextResponse.json({
      ok: true,
      saved: false,
      reason: 'Vercel 환경 (파일 저장 불가)',
      summary,
      messageCount: messages.length,
      timestamp,
    })
  } catch (error) {
    console.error('Save session 오류:', error)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
