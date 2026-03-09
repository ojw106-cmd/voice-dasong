import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { messages, agent }: { messages: Message[]; agent?: string } = await req.json()

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: '메시지 없음' }, { status: 400 })
    }

    const rawMessage = messages[messages.length - 1]?.content || ''
    // 보이스챗임을 에이전트에게 알려서 짧게 + 마크다운 없이 답하도록
    const lastMessage = `[보이스챗] ${rawMessage}\n(음성 대화 중이니 1-3문장으로 짧게, 마크다운(**나 #) 없이 답해줘)`
    const agentId = agent || 'main'

    const { stdout } = await execFileAsync('openclaw', [
      'agent',
      '--agent', agentId,
      '-m', lastMessage,
      '--json',
      '--timeout', '60000',
    ], { 
      timeout: 65000,
      env: { ...process.env, PATH: process.env.PATH || '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin' },
    })

    const data = JSON.parse(stdout)
    const reply = data.result?.payloads?.[0]?.text 
      || data.result?.text 
      || '응답을 못 받았어. 다시 물어봐.'

    return NextResponse.json({ reply })
  } catch (error: any) {
    console.error('Chat 오류:', error)
    return NextResponse.json({ 
      error: 'Chat 실패', 
      detail: error?.message || String(error),
    }, { status: 500 })
  }
}
