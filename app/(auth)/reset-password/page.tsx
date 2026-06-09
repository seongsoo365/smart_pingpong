'use client'
import { Suspense, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

function validatePassword(password: string): string | null {
  if (password.length < 8) return '최소 8자 이상이어야 합니다'
  if (!/[a-zA-Z]/.test(password)) return '영문자를 포함해야 합니다'
  if (!/[0-9]/.test(password)) return '숫자를 포함해야 합니다'
  return null
}

function ResetPasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationError = validatePassword(password)
    if (validationError) { toast.error(validationError); return }
    if (password !== confirm) { toast.error('비밀번호가 일치하지 않습니다'); return }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error('변경 실패: ' + error.message)
      setLoading(false)
      return
    }
    // password_changed 플래그 업데이트
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_profiles').update({ password_changed: true }).eq('id', user.id)
    }
    toast.success('비밀번호가 변경되었습니다')
    router.push('/admin')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-sm font-medium">새 비밀번호</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          placeholder="최소 8자, 영문+숫자"
          className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">비밀번호 확인</label>
        <input
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          placeholder="비밀번호 재입력"
          className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        {loading ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center px-4 gradient-bg">
      <div className="w-full max-w-sm">
        <div className="glass rounded-2xl p-8 border border-white/10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center mx-auto">
              <Trophy className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold">비밀번호 재설정</h1>
            <p className="text-sm text-muted-foreground">새 비밀번호를 입력해 주세요.</p>
          </div>
          <Suspense>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
