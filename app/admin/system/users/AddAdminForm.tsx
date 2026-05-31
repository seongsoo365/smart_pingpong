'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'

export default function AddAdminForm() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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
      setEmail(''); setName(''); setPassword('')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-5 border border-white/10 space-y-4">
      <h2 className="font-semibold">대회 관리자 계정 생성</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input value={name} onChange={e => setName(e.target.value)} required placeholder="이름"
          className="glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="이메일"
          className="glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="초기 비밀번호" minLength={6}
          className="glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
      </div>
      <button type="submit" disabled={loading}
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
        <UserPlus className="w-4 h-4" /> {loading ? '생성 중...' : '계정 생성'}
      </button>
    </form>
  )
}
