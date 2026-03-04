import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { toFile } from 'openai'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioBlob = formData.get('audio') as Blob | null

    if (!audioBlob) {
      return NextResponse.json({ error: '오디오 데이터 없음' }, { status: 400 })
    }

    const arrayBuffer = await audioBlob.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 확장자 결정
    const mimeType = audioBlob.type || 'audio/webm'
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm'

    const file = await toFile(buffer, `audio.${ext}`, { type: mimeType })

    const transcription = await getOpenAI().audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'ko',
    })

    return NextResponse.json({ text: transcription.text })
  } catch (error) {
    console.error('Whisper STT 오류:', error)
    return NextResponse.json({ error: 'STT 실패' }, { status: 500 })
  }
}

export const config = {
  api: { bodyParser: false },
}
