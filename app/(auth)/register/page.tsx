'use client'
import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

function validatePassword(password: string): string | null {
  if (password.length < 8) return '최소 8자 이상이어야 합니다'
  if (!/[a-zA-Z]/.test(password)) return '영문자를 포함해야 합니다'
  if (!/[0-9]/.test(password)) return '숫자를 포함해야 합니다'
  return null
}

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

function NaverIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="4" fill="#03C75A" />
      <path d="M13.5 12.3L10.2 7H7v10h3.5v-5.3L14.1 17H17V7h-3.5v5.3z" fill="white" />
    </svg>
  )
}

function RegisterForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'google' | 'naver' | null>(null)
  const router = useRouter()

  async function handleGoogleSignup() {
    setSocialLoading('google')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/admin` },
    })
    if (error) { toast.error('구글 가입 실패: ' + error.message); setSocialLoading(null) }
  }

  function handleNaverSignup() {
    setSocialLoading('naver')
    window.location.href = '/auth/naver'
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('이름을 입력하세요'); return }
    const pwErr = validatePassword(password)
    if (pwErr) { toast.error(pwErr); return }
    if (password !== confirm) { toast.error('비밀번호가 일치하지 않습니다'); return }

    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/admin`,
      },
    })

    if (error) {
      toast.error('가입 실패: ' + error.message)
      setLoading(false)
      return
    }

    if (data.session) {
      // 이메일 인증 불필요 설정인 경우 바로 로그인
      router.push('/admin')
    } else {
      router.push(`/register/verify?email=${encodeURIComponent(email)}`)
    }
  }

  return (
    <div className="space-y-5">
      {/* Social Signup */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={handleGoogleSignup}
          disabled={!!socialLoading}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-800 rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-60"
        >
          <GoogleIcon />
          {socialLoading === 'google' ? '처리 중...' : '구글로 가입'}
        </button>
        <button
          type="button"
          onClick={handleNaverSignup}
          disabled={!!socialLoading}
          className="w-full flex items-center justify-center gap-3 bg-[#03C75A] text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-[#02b350] transition-colors disabled:opacity-60"
        >
          <NaverIcon />
          {socialLoading === 'naver' ? '처리 중...' : '네이버로 가입'}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-xs text-muted-foreground">또는 이메일로 가입</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="이름"
          className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors"
        />
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="이메일"
          className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors"
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          placeholder="비밀번호 (최소 8자, 영문+숫자)"
          className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors"
        />
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          placeholder="비밀번호 확인"
          className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors"
        />
        <button
          type="submit"
          disabled={loading || !!socialLoading}
          className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? '가입 중...' : '회원가입'}
        </button>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="text-primary hover:underline font-medium">로그인</Link>
      </p>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 gradient-bg">
      <div className="w-full max-w-sm">
        <div className="glass rounded-2xl p-8 border border-white/10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto">
              <Trophy className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">대회 관리자 가입</h1>
            <p className="text-sm text-muted-foreground">Smart Pingpong 대회 관리자로 등록하세요</p>
          </div>
          <Suspense>
            <RegisterForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
