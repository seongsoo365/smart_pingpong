'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

function validatePassword(password: string): string | null {
  if (password.length < 8) return '최소 8자 이상이어야 합니다'
  if (!/[a-zA-Z]/.test(password)) return '영문자를 포함해야 합니다'
  if (!/[0-9]/.test(password)) return '숫자를 포함해야 합니다'
  return null
}

export default function ChangePasswordPage() {
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
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_profiles').update({ password_changed: true }).eq('id', user.id)
    }
    toast.success('비밀번호가 변경되었습니다')
    router.push('/admin')
    router.refresh()
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-xl font-bold">비밀번호 변경</h1>
          <p className="text-sm text-muted-foreground">보안을 위해 초기 비밀번호를 변경해 주세요.</p>
        </div>
      </div>

      <div className="glass rounded-2xl p-6 border border-white/10">
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
          <p className="text-xs text-muted-foreground">최소 8자, 영문+숫자 조합이 필요합니다.</p>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground rounded-xl py-2.5 font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  )
}
