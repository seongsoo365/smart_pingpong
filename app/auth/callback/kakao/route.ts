import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

interface KakaoTokenResponse {
  access_token: string
  token_type: string
  error?: string
  error_description?: string
}

interface KakaoUserResponse {
  id: number
  kakao_account?: {
    email?: string
    profile?: {
      nickname?: string
      profile_image_url?: string
    }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const storedState = request.cookies.get('kakao_oauth_state')?.value

  // CSRF check
  if (!state || !storedState || state !== storedState) {
    return NextResponse.redirect(`${origin}/login?error=invalid_state`)
  }

  const clientId = process.env.KAKAO_CLIENT_ID
  const clientSecret = process.env.KAKAO_CLIENT_SECRET
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!clientId) return NextResponse.redirect(`${origin}/login?error=kakao_not_configured`)
  if (!serviceRoleKey) return NextResponse.redirect(`${origin}/login?error=missing_supabase_service_key`)
  if (!supabaseUrl) return NextResponse.redirect(`${origin}/login?error=missing_supabase_url`)
  if (!code) return NextResponse.redirect(`${origin}/login?error=kakao_code_missing`)

  try {
    // 1. Exchange code for Kakao access token
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: `${origin}/auth/callback/kakao`,
      code,
    })
    if (clientSecret) tokenParams.set('client_secret', clientSecret)

    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    })
    const tokenData: KakaoTokenResponse = await tokenRes.json()

    if (tokenData.error || !tokenData.access_token) {
      return NextResponse.redirect(`${origin}/login?error=kakao_token_failed`)
    }

    // 2. Fetch user profile from Kakao
    const profileRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profileData: KakaoUserResponse = await profileRes.json()

    if (!profileData.id) {
      return NextResponse.redirect(`${origin}/login?error=kakao_profile_failed`)
    }

    const kakaoId = String(profileData.id)
    const kakaoAccount = profileData.kakao_account
    // 이메일 미제공 시 카카오 고유 ID 기반 합성 이메일 사용
    const email = (kakaoAccount?.email ?? `kakao_${kakaoId}@kakao.user`).toLowerCase()
    const name = kakaoAccount?.profile?.nickname ?? email.split('@')[0]
    const avatarUrl = kakaoAccount?.profile?.profile_image_url ?? null

    // 3. Create/find user in Supabase via admin API
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: createData } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: {
        name,
        avatar_url: avatarUrl,
        provider: 'kakao',
        kakao_id: kakaoId,
      },
    })

    const userId = createData?.user?.id
    if (userId) {
      await adminClient.from('user_profiles').upsert({
        id: userId,
        email,
        name,
        avatar_url: avatarUrl,
        provider: 'kakao',
        role: 'tournament_admin',
        password_changed: true,
      }, { onConflict: 'id' })
    }

    // 4. Generate magic link for session creation
    const { data, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${origin}/auth/kakao/complete` },
    })

    if (linkError || !data.properties?.action_link) {
      const detail = encodeURIComponent(linkError?.message ?? 'no_action_link')
      return NextResponse.redirect(`${origin}/login?error=kakao_link_failed&detail=${detail}`)
    }

    const response = NextResponse.redirect(data.properties.action_link)
    response.cookies.delete('kakao_oauth_state')
    return response
  } catch {
    return NextResponse.redirect(`${origin}/login?error=kakao_unexpected`)
  }
}
