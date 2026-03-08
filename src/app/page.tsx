'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

type Message = { role: 'user' | 'assistant'; content: string }
type AppState = 'idle' | 'listening' | 'recording' | 'processing' | 'speaking'

const VOLUME_THRESHOLD = 0.015  // 볼륨 임계값 (0~1)
const SILENCE_DURATION = 1500   // 침묵 감지 시간 (ms)

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [appState, setAppState] = useState<AppState>('idle')
  const [statusText, setStatusText] = useState('시작하기를 눌러주세요')
  const [hasPermission, setHasPermission] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const isRecordingRef = useRef(false)
  const messagesRef = useRef<Message[]>([])

  // messages를 ref에 동기화
  useEffect(() => { messagesRef.current = messages }, [messages])

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      setHasPermission(true)

      // AudioContext 설정
      const ctx = new AudioContext()
      audioContextRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      setAppState('listening')
      setStatusText('듣는 중... 말해주세요')

      // VAD 루프 시작
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      
      const checkVolume = () => {
        if (!analyserRef.current) return
        analyserRef.current.getByteTimeDomainData(dataArray)
        
        // RMS 계산
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128
          sum += val * val
        }
        const rms = Math.sqrt(sum / dataArray.length)

        if (rms > VOLUME_THRESHOLD && !isRecordingRef.current) {
          // 말 시작 감지
          startCapture(stream)
        } else if (rms < VOLUME_THRESHOLD && isRecordingRef.current) {
          // 침묵 감지
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              stopCapture()
            }, SILENCE_DURATION)
          }
        } else if (rms > VOLUME_THRESHOLD && isRecordingRef.current) {
          // 계속 말하는 중 - 침묵 타이머 리셋
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current)
            silenceTimerRef.current = null
          }
        }

        animFrameRef.current = requestAnimationFrame(checkVolume)
      }
      
      animFrameRef.current = requestAnimationFrame(checkVolume)
    } catch (e) {
      setStatusText('마이크 권한을 허용해주세요')
    }
  }, [])

  const startCapture = useCallback((stream: MediaStream) => {
    if (isRecordingRef.current) return
    isRecordingRef.current = true
    chunksRef.current = []
    
    // iOS Safari는 webm 미지원 → mp4 fallback
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : ''
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)
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
    
    // 너무 짧은 녹음 무시 (0.5초 미만)
    if (blob.size < 5000) {
      setAppState('listening')
      setStatusText('듣는 중... 말해주세요')
      // VAD 재시작
      if (streamRef.current) {
        const analyser = analyserRef.current!
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const checkVolume = () => {
          analyser.getByteTimeDomainData(dataArray)
          let sum = 0
          for (let i = 0; i < dataArray.length; i++) {
            const val = (dataArray[i] - 128) / 128
            sum += val * val
          }
          const rms = Math.sqrt(sum / dataArray.length)
          if (rms > VOLUME_THRESHOLD && !isRecordingRef.current) startCapture(streamRef.current!)
          else if (rms < VOLUME_THRESHOLD && isRecordingRef.current) {
            if (!silenceTimerRef.current) silenceTimerRef.current = setTimeout(() => stopCapture(), SILENCE_DURATION)
          } else if (rms > VOLUME_THRESHOLD && isRecordingRef.current) {
            if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
          }
          animFrameRef.current = requestAnimationFrame(checkVolume)
        }
        animFrameRef.current = requestAnimationFrame(checkVolume)
      }
      return
    }

    const form = new FormData()
    form.append('audio', blob)
    
    try {
      const sttRes = await fetch('/api/transcribe', { method: 'POST', body: form }).then(r => r.json())
      if (sttRes.error) { console.error('STT error:', sttRes); setStatusText(`STT 오류: ${sttRes.detail || sttRes.error}`); setTimeout(restartListening, 3000); return }
      const text = sttRes.text
      if (!text?.trim()) { setStatusText(`인식 실패 (빈 텍스트, ${blob.size}bytes, ${recorderMime})`); setTimeout(restartListening, 3000); return }

      const userMsg: Message = { role: 'user', content: text }
      const newMessages = [...messagesRef.current, userMsg]
      setMessages(newMessages)
      setStatusText('다송 생각 중...')

      const { reply } = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      }).then(r => r.json())

      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      setAppState('speaking')
      setStatusText('🔊 다송 답변 중...')

      const audioRes = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reply }),
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
  }, [startCapture])

  const restartListening = useCallback(() => {
    isRecordingRef.current = false
    if (streamRef.current && audioContextRef.current && analyserRef.current) {
      setAppState('listening')
      setStatusText('듣는 중... 말해주세요')
      const analyser = analyserRef.current
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const checkVolume = () => {
        analyser.getByteTimeDomainData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128
          sum += val * val
        }
        const rms = Math.sqrt(sum / dataArray.length)
        if (rms > VOLUME_THRESHOLD && !isRecordingRef.current) startCapture(streamRef.current!)
        else if (rms < VOLUME_THRESHOLD && isRecordingRef.current) {
          if (!silenceTimerRef.current) silenceTimerRef.current = setTimeout(() => stopCapture(), SILENCE_DURATION)
        } else if (rms > VOLUME_THRESHOLD && isRecordingRef.current) {
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null }
        }
        animFrameRef.current = requestAnimationFrame(checkVolume)
      }
      animFrameRef.current = requestAnimationFrame(checkVolume)
    }
  }, [startCapture, stopCapture])

  const stateColors: Record<AppState, string> = {
    idle: 'bg-gray-700',
    listening: 'bg-green-600 animate-pulse',
    recording: 'bg-red-500 animate-pulse',
    processing: 'bg-yellow-500 animate-pulse',
    speaking: 'bg-blue-500 animate-pulse',
  }

  const stateIcons: Record<AppState, string> = {
    idle: '🎙️',
    listening: '👂',
    recording: '🔴',
    processing: '⚙️',
    speaking: '🔊',
  }

  return (
    <main className="flex flex-col h-screen max-w-md mx-auto p-4 pb-safe">
      <h1 className="text-xl font-bold text-green-400 text-center py-3">🌲 다송 보이스</h1>

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

      <div className="text-center text-xs text-gray-400 mb-4">{statusText}</div>

      <div className="flex justify-center pb-8">
        {appState === 'idle' ? (
          <button
            onClick={startListening}
            className="w-20 h-20 rounded-full bg-green-600 text-3xl hover:bg-green-500 transition-all"
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
