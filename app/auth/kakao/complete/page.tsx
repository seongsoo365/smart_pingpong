'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function KakaoCompletePage() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) {
      router.replace('/login?error=kakao_no_token')
      return
    }

    const params = new URLSearchParams(hash.substring(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      router.replace('/login?error=kakao_no_token')
      return
    }

    const supabase = createClient()
    supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          router.replace('/login?error=kakao_session_failed')
        } else {
          router.replace('/admin')
        }
      })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F172A' }}>
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground">카카오 로그인 처리 중...</p>
      </div>
    </div>
  )
}
