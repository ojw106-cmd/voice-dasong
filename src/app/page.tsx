'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import VoiceButton from '@/components/VoiceButton'
import ChatBubble from '@/components/ChatBubble'

export type Message = {
  id: string
  role: 'user' | 'assistant'
  text: string
  timestamp: Date
}

type AppState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking'

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [appState, setAppState] = useState<AppState>('idle')
  const [statusText, setStatusText] = useState('마이크 버튼을 누르고 말해봐')
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Service worker 등록
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
  }, [])

  // 스크롤
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 오디오 재생 완료
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onEnd = () => {
      setAppState('idle')
      setStatusText('마이크 버튼을 누르고 말해봐')
    }
    audio.addEventListener('ended', onEnd)
    return () => audio.removeEventListener('ended', onEnd)
  }, [])

  const addMessage = useCallback((role: 'user' | 'assistant', text: string) => {
    const msg: Message = {
      id: Date.now().toString(),
      role,
      text,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, msg])
    return msg
  }, [])

  const handleRecordStart = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.start(100)
      setAppState('recording')
      setStatusText('듣고 있어... 말해봐 🎙️')
    } catch (err) {
      console.error('마이크 접근 실패:', err)
      setStatusText('마이크 권한이 필요해!')
      setAppState('idle')
    }
  }, [])

  const handleRecordStop = useCallback(async () => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return

    setAppState('transcribing')
    setStatusText('받아쓰는 중...')

    recorder.stop()
    recorder.stream.getTracks().forEach((t) => t.stop())

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
      if (blob.size < 1000) {
        setAppState('idle')
        setStatusText('너무 짧아! 다시 해봐')
        return
      }

      try {
        // 1. STT (Whisper)
        const formData = new FormData()
        formData.append('audio', blob, 'recording.webm')
        const sttRes = await fetch('/api/transcribe', { method: 'POST', body: formData })
        if (!sttRes.ok) throw new Error('STT 실패')
        const { text: userText } = await sttRes.json()

        if (!userText?.trim()) {
          setAppState('idle')
          setStatusText('잘 안 들렸어. 다시 해봐')
          return
        }

        addMessage('user', userText)

        // 2. Claude 응답
        setAppState('thinking')
        setStatusText('생각 중...')

        const chatHistory = messages.map((m) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text,
        }))

        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...chatHistory, { role: 'user', content: userText }],
          }),
        })
        if (!chatRes.ok) throw new Error('Chat 실패')
        const { reply } = await chatRes.json()
        addMessage('assistant', reply)

        // 3. TTS
        setAppState('speaking')
        setStatusText('다송이 말하는 중...')

        const ttsRes = await fetch('/api/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: reply }),
        })
        if (!ttsRes.ok) throw new Error('TTS 실패')

        const audioBuf = await ttsRes.arrayBuffer()
        const audioBlob = new Blob([audioBuf], { type: 'audio/mpeg' })
        const url = URL.createObjectURL(audioBlob)

        if (audioUrl) URL.revokeObjectURL(audioUrl)
        setAudioUrl(url)

        if (audioRef.current) {
          audioRef.current.src = url
          await audioRef.current.play()
        }
      } catch (err) {
        console.error(err)
        setAppState('idle')
        setStatusText('오류 발생. 다시 해봐!')
      }
    }
  }, [messages, addMessage, audioUrl])

  const handleSaveSession = useCallback(async () => {
    if (messages.length === 0) return
    setStatusText('저장 중...')

    const sessionData = {
      messages,
      timestamp: new Date().toISOString(),
    }

    // localStorage 저장
    const key = `voice-session-${new Date().toISOString().slice(0, 16)}`
    localStorage.setItem(key, JSON.stringify(sessionData))

    // 서버 저장 시도
    try {
      await fetch('/api/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionData),
      })
    } catch {
      // 서버 오류 무시 (localStorage에 저장됨)
    }

    setMessages([])
    setStatusText('저장 완료! 새 대화를 시작해봐')
  }, [messages])

  const stateColors: Record<AppState, string> = {
    idle: 'text-gray-400',
    recording: 'text-red-400',
    transcribing: 'text-yellow-400',
    thinking: 'text-blue-400',
    speaking: 'text-green-400',
  }

  return (
    <main className="flex flex-col h-screen max-w-md mx-auto bg-[#0a0a0a]">
      {/* 헤더 */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🌲</span>
          <div>
            <h1 className="text-lg font-bold text-green-400">다송 보이스</h1>
            <p className="text-xs text-gray-500">진원이형 전용</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <div
            className={`w-2 h-2 rounded-full ${
              appState === 'idle' ? 'bg-green-500' : 'bg-yellow-400 animate-pulse'
            }`}
          />
          <span className="text-xs text-gray-400">
            {appState === 'idle' ? 'Ready' : appState}
          </span>
        </div>
      </header>

      {/* 대화 내역 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <span className="text-5xl mb-4">🌲</span>
            <p className="text-gray-400 text-sm">안녕 형! 뭐든지 물어봐</p>
            <p className="text-gray-600 text-xs mt-1">아래 버튼을 꾹 누르고 말해봐</p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}
        {/* 로딩 표시 */}
        {(appState === 'thinking' || appState === 'transcribing') && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-green-400 rounded-full dot-bounce"
                    style={{ animationDelay: `${i * 0.16}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* 상태 텍스트 */}
      <div className="px-4 py-2 text-center shrink-0">
        <p className={`text-sm font-medium transition-colors ${stateColors[appState]}`}>
          {statusText}
        </p>
      </div>

      {/* 보이스 버튼 */}
      <div className="flex flex-col items-center gap-4 px-4 pb-6 shrink-0">
        <VoiceButton
          appState={appState}
          onRecordStart={handleRecordStart}
          onRecordStop={handleRecordStop}
        />

        {messages.length > 0 && (
          <button
            onClick={handleSaveSession}
            disabled={appState !== 'idle'}
            className="text-sm text-gray-500 border border-gray-700 px-4 py-2 rounded-full 
                       hover:border-green-700 hover:text-green-400 transition-colors
                       disabled:opacity-30 disabled:cursor-not-allowed"
          >
            💾 대화 저장 &amp; 종료
          </button>
        )}
      </div>

      {/* 숨겨진 오디오 플레이어 */}
      <audio ref={audioRef} className="hidden" />
    </main>
  )
}
