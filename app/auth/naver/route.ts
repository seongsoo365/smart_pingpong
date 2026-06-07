import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { randomBytes } from 'crypto'

// Initiates Naver OAuth flow
export async function GET(request: NextRequest) {
  const clientId = process.env.NAVER_CLIENT_ID
  if (!clientId) {
    return NextResponse.redirect(new URL('/login?error=naver_not_configured', request.url))
  }

  const state = randomBytes(16).toString('hex')
  const callbackUrl = `${new URL(request.url).origin}/auth/callback/naver`

  const naverAuthUrl = new URL('https://nid.naver.com/oauth2.0/authorize')
  naverAuthUrl.searchParams.set('response_type', 'code')
  naverAuthUrl.searchParams.set('client_id', clientId)
  naverAuthUrl.searchParams.set('redirect_uri', callbackUrl)
  naverAuthUrl.searchParams.set('state', state)

  const response = NextResponse.redirect(naverAuthUrl.toString())
  // Store state in httpOnly cookie for CSRF verification
  response.cookies.set('naver_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 300, // 5 minutes
    path: '/',
  })
  return response
}
