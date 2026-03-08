'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    if (res.ok) {
      router.push('/')
    } else {
      setError('비밀번호가 틀렸어')
    }
  }

  return (
    <main className="flex items-center justify-center h-screen bg-black">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-8 max-w-xs w-full">
        <h1 className="text-xl font-bold text-green-400 text-center">🌲 다송 보이스</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="비밀번호"
          className="px-4 py-3 rounded-xl bg-gray-800 text-white text-center text-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          autoFocus
        />
        {error && <p className="text-red-400 text-center text-sm">{error}</p>}
        <button
          type="submit"
          className="px-4 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-500 transition"
        >
          입장
        </button>
      </form>
    </main>
  )
}
