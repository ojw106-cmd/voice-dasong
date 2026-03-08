import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const APP_PASSWORD = process.env.APP_PASSWORD
  if (!APP_PASSWORD) return NextResponse.next()

  // 로그인 페이지와 auth API는 통과
  if (req.nextUrl.pathname === '/login' || req.nextUrl.pathname === '/api/auth') {
    return NextResponse.next()
  }

  // API 요청은 세션 쿠키로 인증
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const session = req.cookies.get('voice-auth')?.value
    if (session === APP_PASSWORD) return NextResponse.next()
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 인증 쿠키 확인
  const session = req.cookies.get('voice-auth')?.value
  if (session === APP_PASSWORD) return NextResponse.next()

  // 미인증 → 로그인 페이지로
  return NextResponse.redirect(new URL('/login', req.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
