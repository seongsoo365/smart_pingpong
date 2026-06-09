'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { Trophy, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    if (error) {
      toast.error('발송 실패: ' + error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          <span className="text-foreground font-medium">{email}</span>로<br />
          비밀번호 재설정 링크를 발송했습니다.<br />
          이메일을 확인해 주세요.
        </p>
        <Link href="/login" className="text-sm text-primary hover:underline">
          로그인으로 돌아가기
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        가입한 이메일 주소를 입력하면 재설정 링크를 발송합니다.
      </p>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        placeholder="admin@example.com"
        className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? '발송 중...' : '재설정 링크 발송'}
      </button>
      <div className="text-center">
        <Link href="/login" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> 로그인으로 돌아가기
        </Link>
      </div>
    </form>
  )
}

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 gradient-bg">
      <div className="w-full max-w-sm">
        <div className="glass rounded-2xl p-8 border border-white/10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto">
              <Trophy className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">비밀번호 찾기</h1>
          </div>
          <Suspense>
            <ForgotPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
