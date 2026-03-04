'use client'

import { useCallback, useRef } from 'react'

type AppState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking'

interface Props {
  appState: AppState
  onRecordStart: () => void
  onRecordStop: () => void
}

export default function VoiceButton({ appState, onRecordStart, onRecordStop }: Props) {
  const isRecording = appState === 'recording'
  const isDisabled = appState !== 'idle' && appState !== 'recording'
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recordingRef = useRef(false)

  const startRecord = useCallback(() => {
    if (isDisabled) return
    if (recordingRef.current) return
    recordingRef.current = true
    onRecordStart()
  }, [isDisabled, onRecordStart])

  const stopRecord = useCallback(() => {
    if (!recordingRef.current) return
    recordingRef.current = false
    onRecordStop()
  }, [onRecordStop])

  // 터치 이벤트 (모바일)
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault()
      startRecord()
    },
    [startRecord]
  )

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault()
      stopRecord()
    },
    [stopRecord]
  )

  // 마우스 이벤트 (데스크탑)
  const onMouseDown = useCallback(() => startRecord(), [startRecord])
  const onMouseUp = useCallback(() => stopRecord(), [stopRecord])
  const onMouseLeave = useCallback(() => {
    if (recordingRef.current) stopRecord()
  }, [stopRecord])

  return (
    <div className="relative flex items-center justify-center w-32 h-32">
      {/* 펄스 링 (녹음 중) */}
      {isRecording && (
        <>
          <div className="absolute inset-0 rounded-full bg-red-500 opacity-20 pulse-ring" />
          <div
            className="absolute inset-0 rounded-full bg-red-500 opacity-10 pulse-ring"
            style={{ animationDelay: '0.3s' }}
          />
        </>
      )}

      {/* 파형 애니메이션 (말하는 중) */}
      {appState === 'speaking' && (
        <div className="absolute inset-0 rounded-full flex items-end justify-center gap-1 pb-3 pointer-events-none">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="w-1 bg-green-400 rounded-full wave-bar"
              style={{
                height: '24px',
                animationDelay: `${i * 0.12}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* 메인 버튼 */}
      <button
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        disabled={isDisabled}
        className={`
          relative z-10 w-24 h-24 rounded-full flex items-center justify-center
          text-4xl font-bold transition-all duration-150 select-none
          ${isRecording
            ? 'bg-red-600 scale-110 shadow-lg shadow-red-900/50'
            : isDisabled
            ? 'bg-gray-800 opacity-40 cursor-not-allowed'
            : 'bg-green-700 hover:bg-green-600 active:scale-95 shadow-lg shadow-green-900/40 cursor-pointer'
          }
        `}
        aria-label={isRecording ? '녹음 중 (놓으면 완료)' : '마이크 버튼'}
      >
        {isRecording ? '⏹️' : appState === 'speaking' ? '🔊' : appState !== 'idle' ? '⏳' : '🎙️'}
      </button>
    </div>
  )
}
