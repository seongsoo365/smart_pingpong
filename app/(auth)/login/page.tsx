'use client'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// Google SVG icon
function GoogleIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

// Naver SVG icon
function NaverIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#03C75A" />
      <path d="M13.5 12.3L10.2 7H7v10h3.5v-5.3L14.1 17H17V7h-3.5v5.3z" fill="white" />
    </svg>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'google' | 'naver' | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const errorParam = searchParams.get('error')

  const errorMessages: Record<string, string> = {
    auth_callback_failed: '로그인 처리 중 오류가 발생했습니다.',
    naver_not_configured: '네이버 로그인이 설정되지 않았습니다.',
    naver_token_failed: '네이버 인증에 실패했습니다.',
    naver_profile_failed: '네이버 프로필 조회에 실패했습니다.',
    naver_link_failed: '네이버 계정 연동에 실패했습니다.',
    naver_unexpected: '네이버 로그인 중 오류가 발생했습니다.',
    invalid_state: '보안 검증에 실패했습니다. 다시 시도해주세요.',
  }

  async function handleGoogleLogin() {
    setSocialLoading('google')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin`,
      },
    })
    if (error) {
      toast.error('구글 로그인 실패: ' + error.message)
      setSocialLoading(null)
    }
    // On success, browser redirects away — no need to setSocialLoading(null)
  }

  function handleNaverLogin() {
    setSocialLoading('naver')
    window.location.href = '/auth/naver'
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error('로그인 실패: ' + error.message)
    } else {
      toast.success('로그인 성공')
      router.push('/admin')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 gradient-bg">
      <div className="w-full max-w-sm">
        <div className="glass rounded-2xl p-8 border border-white/10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto">
              <Trophy className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">관리자 로그인</h1>
            <p className="text-sm text-muted-foreground">Smart Pingpong 관리자 계정으로 로그인하세요</p>
          </div>

          {errorParam && errorMessages[errorParam] && (
            <p className="text-sm text-red-400 text-center bg-red-500/10 rounded-xl px-4 py-2.5">
              {errorMessages[errorParam]}
            </p>
          )}

          {/* Social Login */}
          <div className="space-y-2.5">
            <button
              onClick={handleGoogleLogin}
              disabled={!!socialLoading}
              className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-60"
            >
              <GoogleIcon />
              {socialLoading === 'google' ? '로그인 중...' : '구글로 로그인'}
            </button>
            <button
              onClick={handleNaverLogin}
              disabled={!!socialLoading}
              className="w-full flex items-center justify-center gap-3 bg-[#03C75A] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#02b350] transition-colors disabled:opacity-60"
            >
              <NaverIcon />
              {socialLoading === 'naver' ? '로그인 중...' : '네이버로 로그인'}
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-muted-foreground">또는 이메일로 로그인</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Email Login */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">이메일</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="admin@example.com"
                className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !!socialLoading}
              className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
