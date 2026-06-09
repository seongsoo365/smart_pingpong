'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'

function getStrength(password: string): { bars: number; label: string; color: string } {
  if (password.length === 0) return { bars: 0, label: '', color: '' }
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-zA-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[!@#$%^&*()_+\-=]/.test(password)) score++
  if (score <= 2) return { bars: 1, label: '약함', color: 'bg-red-500' }
  if (score <= 3) return { bars: 2, label: '보통', color: 'bg-yellow-500' }
  return { bars: 3, label: '강함', color: 'bg-green-500' }
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return '최소 8자 이상이어야 합니다'
  if (!/[a-zA-Z]/.test(password)) return '영문자를 포함해야 합니다'
  if (!/[0-9]/.test(password)) return '숫자를 포함해야 합니다'
  return null
}

export default function AddAdminForm() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const strength = getStrength(password)

  function handlePasswordChange(value: string) {
    setPassword(value)
    setPasswordError(value.length > 0 ? validatePassword(value) : null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validatePassword(password)
    if (err) { setPasswordError(err); return }

    setLoading(true)
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, password }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error('생성 실패: ' + data.error)
    } else {
      toast.success(`${name} 계정이 생성되었습니다`)
      setEmail(''); setName(''); setPassword(''); setPasswordError(null)
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-5 border border-white/10 space-y-4">
      <h2 className="font-semibold">대회 관리자 계정 생성</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          required
          placeholder="이름"
          className="glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary"
        />
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="이메일"
          className="glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary"
        />
      </div>
      <div className="space-y-2">
        <input
          type="password"
          value={password}
          onChange={e => handlePasswordChange(e.target.value)}
          required
          placeholder="초기 비밀번호 (최소 8자, 영문+숫자)"
          className={`w-full glass border rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none transition-colors ${
            passwordError ? 'border-red-500' : 'border-white/10 focus:border-primary'
          }`}
        />
        {password.length > 0 && (
          <div className="space-y-1">
            <div className="flex gap-1.5">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                    i <= strength.bars ? strength.color : 'bg-white/10'
                  }`}
                />
              ))}
            </div>
            <p className={`text-xs ${
              strength.bars === 1 ? 'text-red-400' :
              strength.bars === 2 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              비밀번호 강도: {strength.label}
            </p>
          </div>
        )}
        {passwordError && <p className="text-xs text-red-400">{passwordError}</p>}
        <p className="text-xs text-muted-foreground">최소 8자, 영문+숫자 조합 필수 — 계정 생성 후 첫 로그인 시 변경 요청됩니다.</p>
      </div>
      <button
        type="submit"
        disabled={loading || !!passwordError}
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        <UserPlus className="w-4 h-4" /> {loading ? '생성 중...' : '계정 생성'}
      </button>
    </form>
  )
}
