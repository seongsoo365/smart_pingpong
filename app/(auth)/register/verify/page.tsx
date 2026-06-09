'use client'
import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MailCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const COOLDOWN_SEC = 60

function VerifyContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const [cooldown, setCooldown] = useState(0)
  const [resending, setResending] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown(c => c - 1), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  async function handleResend() {
    if (!email || cooldown > 0) return
    setResending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) {
      toast.error('재발송 실패: ' + error.message)
    } else {
      toast.success('인증 메일을 재발송했습니다')
      setCooldown(COOLDOWN_SEC)
    }
    setResending(false)
  }

  return (
    <div className="space-y-5 text-center">
      <p className="text-sm text-muted-foreground leading-relaxed">
        <span className="text-foreground font-medium">{email}</span>로<br />
        인증 메일을 발송했습니다.<br />
        메일함을 확인하고 링크를 클릭해 주세요.
      </p>

      <div className="glass rounded-xl px-4 py-3 border border-white/10 text-xs text-muted-foreground text-left space-y-1">
        <p>• 메일이 오지 않으면 스팸함을 확인해 주세요.</p>
        <p>• 링크는 발송 후 24시간 동안 유효합니다.</p>
      </div>

      <button
        onClick={handleResend}
        disabled={cooldown > 0 || resending || !email}
        className="w-full py-2.5 glass border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors disabled:opacity-50"
      >
        {resending ? '발송 중...' : cooldown > 0 ? `재발송 (${cooldown}초)` : '인증 메일 재발송'}
      </button>

      <Link href="/login" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
        로그인 페이지로 돌아가기
      </Link>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 gradient-bg">
      <div className="w-full max-w-sm">
        <div className="glass rounded-2xl p-8 border border-white/10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto">
              <MailCheck className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">이메일 인증</h1>
          </div>
          <Suspense>
            <VerifyContent />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
