'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Send } from 'lucide-react'

export default function AddAdminForm() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    })
    const data = await res.json()
    if (!res.ok) {
      toast.error('초대 실패: ' + data.error)
    } else {
      toast.success(`${email}로 초대 링크를 발송했습니다`)
      setEmail(''); setName('')
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-5 border border-white/10 space-y-4">
      <div>
        <h2 className="font-semibold">대회 관리자 초대</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          이메일로 초대 링크를 발송합니다. 초대받은 사용자가 링크를 클릭해 비밀번호를 직접 설정합니다.
        </p>
      </div>
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
      <button
        type="submit"
        disabled={loading}
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
      >
        <Send className="w-4 h-4" /> {loading ? '발송 중...' : '초대 링크 발송'}
      </button>
    </form>
  )
}
