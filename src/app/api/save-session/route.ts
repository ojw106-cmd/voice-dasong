import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import os from 'os'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

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

    // 요약 생성 (Claude API 사용 가능한 경우)
    let summary = '(요약 없음 — ANTHROPIC_API_KEY 미설정)'

    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'placeholder_for_now') {
      try {
        const res = await anthropic.messages.create({
          model: 'claude-sonnet-4-5',
          max_tokens: 200,
          messages: [
            {
              role: 'user',
              content: `다음 음성 대화를 3줄 이내로 한국어로 요약해줘:\n\n${conversation}`,
            },
          ],
        })
        summary = res.content[0]?.type === 'text' ? res.content[0].text : summary
      } catch {
        summary = '요약 생성 실패'
      }
    }

    // 파일 저장 경로
    const date = new Date(timestamp)
    const dateStr = date.toISOString().slice(0, 16).replace('T', '-').replace(':', ':')
    const memoryDir = path.join(os.homedir(), '.openclaw', 'workspace', 'memory')

    let savedPath = null
    let savedLocally = false

    try {
      fs.mkdirSync(memoryDir, { recursive: true })
      const fileName = `voice-${dateStr}.md`
      const filePath = path.join(memoryDir, fileName)

      const content = [
        `# 다송 보이스 대화 — ${date.toLocaleDateString('ko-KR')} ${date.toLocaleTimeString('ko-KR')}`,
        '',
        `## 요약`,
        summary,
        '',
        `## 대화 내역`,
        conversation,
        '',
        `---`,
        `*저장 시각: ${new Date().toLocaleString('ko-KR')}*`,
      ].join('\n')

      fs.writeFileSync(filePath, content, 'utf-8')
      savedPath = filePath
      savedLocally = true
    } catch (fsErr) {
      console.error('파일 저장 실패:', fsErr)
    }

    return NextResponse.json({
      ok: true,
      saved: savedLocally,
      path: savedPath,
      summary,
      messageCount: messages.length,
    })
  } catch (error) {
    console.error('Save session 오류:', error)
    return NextResponse.json({ error: '저장 실패' }, { status: 500 })
  }
}
