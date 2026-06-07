'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Trash2, ChevronDown } from 'lucide-react'
import type { UserProfile } from '@/lib/types'

const roleLabel: Record<string, string> = {
  system_admin: '시스템 관리자',
  tournament_admin: '대회 관리자',
}

const providerLabel: Record<string, { label: string; className: string }> = {
  google:  { label: 'Google', className: 'bg-blue-500/20 text-blue-400' },
  naver:   { label: 'Naver',  className: 'bg-green-500/20 text-green-400' },
  email:   { label: '이메일',  className: 'bg-white/10 text-muted-foreground' },
}

function Avatar({ user }: { user: UserProfile }) {
  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar_url}
        alt={user.name}
        className="w-9 h-9 rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    )
  }
  return (
    <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
      {user.name.charAt(0)}
    </div>
  )
}

interface Props {
  users: UserProfile[]
  currentUserId: string
}

export default function UserList({ users: initial, currentUserId }: Props) {
  const [users, setUsers] = useState(initial)
  const [updating, setUpdating] = useState<string | null>(null)

  async function handleRoleChange(id: string, newRole: string) {
    setUpdating(id)
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole as UserProfile['role'] } : u))
      toast.success('역할이 변경되었습니다.')
    } catch (e) {
      toast.error('역할 변경 실패: ' + (e instanceof Error ? e.message : '알 수 없는 오류'))
    } finally {
      setUpdating(null)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`"${name}" 계정을 삭제하시겠습니까?`)) return
    setUpdating(id)
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      setUsers(prev => prev.filter(u => u.id !== id))
      toast.success(`${name} 계정이 삭제되었습니다.`)
    } catch (e) {
      toast.error('삭제 실패: ' + (e instanceof Error ? e.message : '알 수 없는 오류'))
    } finally {
      setUpdating(null)
    }
  }

  return (
    <section className="glass rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
        <h2 className="font-semibold">등록된 사용자</h2>
        <span className="text-sm text-muted-foreground">{users.length}명</span>
      </div>
      <div className="divide-y divide-white/5">
        {users.length === 0 && (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">등록된 사용자가 없습니다.</p>
        )}
        {users.map(u => {
          const provider = providerLabel[u.provider ?? 'email'] ?? providerLabel.email
          const isSelf = u.id === currentUserId
          const busy = updating === u.id
          return (
            <div key={u.id} className={`flex items-center gap-3 px-5 py-3.5 ${busy ? 'opacity-60' : ''}`}>
              <Avatar user={u} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{u.name}</span>
                  {isSelf && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground">나</span>
                  )}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${provider.className}`}>
                    {provider.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>

              {/* Role selector */}
              <div className="relative shrink-0">
                <select
                  value={u.role}
                  disabled={busy}
                  onChange={e => handleRoleChange(u.id, e.target.value)}
                  className="appearance-none bg-white/5 border border-white/10 rounded-lg pl-3 pr-7 py-1.5 text-xs font-medium cursor-pointer focus:outline-none focus:border-primary hover:bg-white/10 transition-colors"
                >
                  <option value="tournament_admin">대회 관리자</option>
                  <option value="system_admin">시스템 관리자</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
              </div>

              {/* Delete button */}
              <button
                onClick={() => handleDelete(u.id, u.name)}
                disabled={busy || isSelf}
                title={isSelf ? '본인 계정은 삭제할 수 없습니다' : '삭제'}
                className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-500/20 hover:text-red-400 text-muted-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
