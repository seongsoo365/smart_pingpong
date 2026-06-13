import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

interface NaverTokenResponse {
  access_token: string
  token_type: string
  error?: string
  error_description?: string
}

interface NaverUserResponse {
  resultcode: string
  message: string
  response: {
    id: string
    email?: string
    name: string
    profile_image?: string
    nickname?: string
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = request.cookies.get('naver_oauth_state')?.value

  // CSRF check
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${origin}/login?error=invalid_state`)
  }

  const clientId = process.env.NAVER_CLIENT_ID
  const clientSecret = process.env.NAVER_CLIENT_SECRET
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!clientId) return NextResponse.redirect(`${origin}/login?error=missing_naver_client_id`)
  if (!clientSecret) return NextResponse.redirect(`${origin}/login?error=missing_naver_client_secret`)
  if (!serviceRoleKey) return NextResponse.redirect(`${origin}/login?error=missing_supabase_service_key`)
  if (!supabaseUrl) return NextResponse.redirect(`${origin}/login?error=missing_supabase_url`)

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=naver_code_missing`)
  }

  try {
    // 1. Exchange code for Naver access token
    const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token')
    tokenUrl.searchParams.set('grant_type', 'authorization_code')
    tokenUrl.searchParams.set('client_id', clientId)
    tokenUrl.searchParams.set('client_secret', clientSecret)
    tokenUrl.searchParams.set('code', code)
    tokenUrl.searchParams.set('state', state)

    const tokenRes = await fetch(tokenUrl.toString())
    const tokenData: NaverTokenResponse = await tokenRes.json()

    if (tokenData.error || !tokenData.access_token) {
      return NextResponse.redirect(`${origin}/login?error=naver_token_failed`)
    }

    // 2. Fetch user profile from Naver
    const profileRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profileData: NaverUserResponse = await profileRes.json()

    if (profileData.resultcode !== '00') {
      return NextResponse.redirect(`${origin}/login?error=naver_profile_failed`)
    }

    const naverUser = profileData.response

    // 이메일 미제공 시 네이버 고유 ID 기반 합성 이메일 사용, auth.users 정규화와 일치시키기 위해 소문자 처리
    const email = (naverUser.email ?? `naver_${naverUser.id}@naver.user`).toLowerCase()

    // 3. Create/find user in Supabase via admin API
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 3. 유저 생성 (이미 존재하면 무시)
    const { data: createData } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        name: naverUser.name || naverUser.nickname,
        avatar_url: naverUser.profile_image,
        provider: 'naver',
        naver_id: naverUser.id,
      },
    })

    // 3-1. user_profiles 직접 upsert (트리거 실패 대비)
    const userId = createData?.user?.id
    if (userId) {
      await adminClient.from('user_profiles').upsert({
        id: userId,
        email,
        name: naverUser.name || naverUser.nickname || email.split('@')[0],
        avatar_url: naverUser.profile_image ?? null,
        provider: 'naver',
        role: 'tournament_admin',
        password_changed: true,
      }, { onConflict: 'id' })
    }

    // 4. Generate magic link for session creation (PKCE-compatible)
    const { data, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${origin}/auth/naver/complete` },
    })

    if (linkError || !data.properties?.action_link) {
      const detail = encodeURIComponent(linkError?.message ?? 'no_action_link')
      return NextResponse.redirect(`${origin}/login?error=naver_link_failed&detail=${detail}`)
    }

    // 5. Clear state cookie and redirect to Supabase verify URL
    const response = NextResponse.redirect(data.properties.action_link)
    response.cookies.delete('naver_oauth_state')
    return response
  } catch {
    return NextResponse.redirect(`${origin}/login?error=naver_unexpected`)
  }
}
