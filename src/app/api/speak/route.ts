import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function POST(req: NextRequest) {
  try {
    const { text, agent }: { text: string; agent?: string } = await req.json()

    if (!text?.trim()) {
      return NextResponse.json({ error: '텍스트 없음' }, { status: 400 })
    }

    const voiceMap: Record<string, string> = {
      main:    'ballad',   // 다송
      sangwoo: 'echo',     // 상보
      michael: 'alloy',    // 마이클
      lincoln: 'ash',      // 링컨
      zamsae:  'echo',     // 잠새
      intern:  'alloy',    // 드니로
      minwook: 'ash',      // 민욱
      karina:  'sage',     // 카리나
    }

    const voice = voiceMap[agent || 'main'] || 'ballad'

    // 텍스트 길이 제한 (TTS는 4096자 제한)
    const truncated = text.slice(0, 1000)

    const mp3 = await getOpenAI().audio.speech.create({
      model: 'tts-1',
      voice: voice as any,
      input: truncated,
      speed: 1.05,     // 살짝 빠르게 — 음성 대화에 적합
    })

    const buffer = Buffer.from(await mp3.arrayBuffer())

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('TTS 오류:', error)
    return NextResponse.json({ error: 'TTS 실패' }, { status: 500 })
  }
}
