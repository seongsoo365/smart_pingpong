import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Supabase가 설정되지 않은 경우 통과 (auth/admin redirect는 layout에서 처리)
  if (!supabaseUrl || !supabaseKey || !supabaseUrl.startsWith('https://')) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // 세션 쿠키 갱신 (auth token 만료 방지)
  const { data: { user } } = await supabase.auth.getUser()

  // 이메일 로그인 사용자의 /admin 접근 시 첫 로그인 비밀번호 변경 확인
  // (Naver는 app_metadata.provider가 'email'로 반환되므로 user_profiles.provider로 정확히 판단)
  const pathname = request.nextUrl.pathname
  if (
    user &&
    pathname.startsWith('/admin') &&
    !pathname.startsWith('/admin/change-password')
  ) {
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('password_changed, provider')
      .eq('id', user.id)
      .single()

    if (profile && !profile.password_changed && profile.provider === 'email') {
      const redirectResponse = NextResponse.redirect(new URL('/admin/change-password', request.url))
      // 세션 쿠키를 리다이렉트 응답에 복사
      supabaseResponse.cookies.getAll().forEach(cookie => {
        redirectResponse.cookies.set(cookie.name, cookie.value)
      })
      return redirectResponse
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
