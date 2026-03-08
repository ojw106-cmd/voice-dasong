'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'

type Message = { role: 'user' | 'assistant'; content: string }
type AppState = 'idle' | 'listening' | 'recording' | 'processing' | 'speaking'

const VOLUME_THRESHOLD = 0.035
const SILENCE_DURATION = 1500

const agentMeta: Record<string, { emoji: string; name: string; color: string }> = {
  main:    { emoji: '🌲', name: '다송',   color: 'bg-green-600' },
  sangwoo: { emoji: '💼', name: '상보',   color: 'bg-blue-600' },
  michael: { emoji: '🔧', name: '마이클', color: 'bg-purple-600' },
  lincoln: { emoji: '⚖️', name: '링컨',   color: 'bg-amber-700' },
  zamsae:  { emoji: '📝', name: '잠새',   color: 'bg-sky-600' },
  intern:  { emoji: '📊', name: '드니로', color: 'bg-orange-600' },
  minwook: { emoji: '🏥', name: '민욱',   color: 'bg-teal-600' },
  karina:  { emoji: '💅', name: '카리나', color: 'bg-pink-600' },
}

export default function VoiceChat() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.agentId as string
  const agent = agentMeta[agentId] || { emoji: '🤖', name: agentId, color: 'bg-gray-600' }

  const [messages, setMessages] = useState<Message[]>([])
  const [appState, setAppState] = useState<AppState>('idle')
  const [statusText, setStatusText] = useState('시작하기를 눌러주세요')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const isRecordingRef = useRef(false)
  const messagesRef = useRef<Message[]>([])

  useEffect(() => { messagesRef.current = messages }, [messages])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      if (audioContextRef.current) audioContextRef.current.close()
    }
  }, [])

  const startVAD = useCallback((analyser: AnalyserNode, stream: MediaStream) => {
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const checkVolume = () => {
      if (!analyserRef.current) return
      analyserRef.current.getByteTimeDomainData(dataArray)
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        const val = (dataArray[i] - 128) / 128
        sum += val * val
      }
      const rms = Math.sqrt(sum / dataArray.length)

      if (rms > VOLUME_THRESHOLD && !isRecordingRef.current) {
        startCapture(stream)
      } else if (rms < VOLUME_THRESHOLD && isRecordingRef.current) {
        if (!silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => stopCapture(), SILENCE_DURATION)
        }
      } else if (rms > VOLUME_THRESHOLD && isRecordingRef.current) {
        if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
      }
      animFrameRef.current = requestAnimationFrame(checkVolume)
    }
    animFrameRef.current = requestAnimationFrame(checkVolume)
  }, [])

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new AudioContext()
      audioContextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      setAppState('listening')
      setStatusText('듣는 중... 말해주세요')
      startVAD(analyser, stream)
    } catch (e) {
      setStatusText('마이크 권한을 허용해주세요')
    }
  }, [startVAD])

  const startCapture = useCallback((stream: MediaStream) => {
    if (isRecordingRef.current) return
    isRecordingRef.current = true
    chunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : ''
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.start(100)
    mediaRecorderRef.current = recorder
    setAppState('recording')
    setStatusText('🔴 녹음 중...')
  }, [])

  const stopCapture = useCallback(async () => {
    if (!isRecordingRef.current || !mediaRecorderRef.current) return
    isRecordingRef.current = false
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }

    setAppState('processing')
    setStatusText('인식 중...')

    mediaRecorderRef.current.stop()
    await new Promise(r => { mediaRecorderRef.current!.onstop = r })

    const recorderMime = mediaRecorderRef.current?.mimeType || 'audio/webm'
    const blob = new Blob(chunksRef.current, { type: recorderMime })

    if (blob.size < 5000) { restartListening(); return }

    const form = new FormData()
    form.append('audio', blob)

    try {
      const sttRes = await fetch('/api/transcribe', { method: 'POST', body: form }).then(r => r.json())
      if (sttRes.error) { setStatusText(`STT 오류: ${sttRes.detail || sttRes.error}`); setTimeout(restartListening, 3000); return }
      const text = sttRes.text
      if (!text?.trim()) { setStatusText('인식 실패 — 다시 말해주세요'); setTimeout(restartListening, 2000); return }

      const userMsg: Message = { role: 'user', content: text }
      const newMessages = [...messagesRef.current, userMsg]
      setMessages(newMessages)
      setStatusText(`${agent.name} 생각 중...`)

      const { reply, error } = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, agent: agentId }),
      }).then(r => r.json())

      if (error) { setStatusText(`오류: ${error}`); setTimeout(restartListening, 3000); return }

      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      setAppState('speaking')
      setStatusText(`🔊 ${agent.name} 답변 중...`)

      const audioRes = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reply, agent: agentId }),
      })
      const audioBlob = await audioRes.blob()
      const url = URL.createObjectURL(audioBlob)
      const player = new Audio(url)
      player.onended = () => { URL.revokeObjectURL(url); restartListening() }
      player.play()
    } catch (e) {
      setStatusText('오류 발생, 다시 시도할게요')
      setTimeout(restartListening, 2000)
    }
  }, [startCapture, agentId, agent.name])

  const restartListening = useCallback(() => {
    isRecordingRef.current = false
    if (streamRef.current && analyserRef.current) {
      setAppState('listening')
      setStatusText('듣는 중... 말해주세요')
      startVAD(analyserRef.current, streamRef.current)
    }
  }, [startVAD])

  const stateColors: Record<AppState, string> = {
    idle: 'bg-gray-700',
    listening: 'bg-green-600 animate-pulse',
    recording: 'bg-red-500 animate-pulse',
    processing: 'bg-yellow-500 animate-pulse',
    speaking: 'bg-blue-500 animate-pulse',
  }

  const stateIcons: Record<AppState, string> = {
    idle: '🎙️', listening: '👂', recording: '🔴', processing: '⚙️', speaking: '🔊',
  }

  return (
    <main className="flex flex-col h-screen max-w-md mx-auto p-4 pb-safe">
      {/* Header */}
      <div className="flex items-center gap-3 py-3">
        <button onClick={() => router.push('/')} className="text-gray-400 hover:text-white text-2xl">←</button>
        <div className={`w-10 h-10 rounded-full ${agent.color} flex items-center justify-center text-lg`}>
          {agent.emoji}
        </div>
        <h1 className="text-lg font-bold text-white">{agent.name} 보이스</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20 text-sm">
            시작 버튼을 누르면<br/>자동으로 대화를 감지해요
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs px-4 py-2 rounded-2xl text-sm ${
              m.role === 'user' ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-100'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {/* Status + Button */}
      <div className="text-center text-xs text-gray-400 mb-4">{statusText}</div>
      <div className="flex justify-center pb-8">
        {appState === 'idle' ? (
          <button
            onClick={startListening}
            className={`w-20 h-20 rounded-full ${agent.color} text-3xl hover:opacity-80 transition-all`}
          >
            🎙️
          </button>
        ) : (
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all ${stateColors[appState]}`}>
            {stateIcons[appState]}
          </div>
        )}
      </div>
    </main>
  )
}
