'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// 네이버 OAuth 완료 페이지 — Supabase 임플리싯 플로우에서 반환된 fragment 토큰을 처리
export default function NaverCompletePage() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) {
      router.replace('/login?error=naver_no_token')
      return
    }

    const params = new URLSearchParams(hash.substring(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=naver_no_token')
      return
    }

    const supabase = createClient()
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          router.replace(`/login?error=naver_session_failed`)
        } else {
          router.replace('/admin')
        }
      })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F172A' }}>
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">네이버 로그인 처리 중...</p>
      </div>
    </div>
  )
}
