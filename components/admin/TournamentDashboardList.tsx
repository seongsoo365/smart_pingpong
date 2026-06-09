'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import type { Tournament } from '@/lib/types'

interface Props {
  tournaments: Tournament[]
}

export default function TournamentDashboardList({ tournaments }: Props) {
  const router = useRouter()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const statusLabel: Record<string, string> = {
    draft: '준비', registration: '접수', in_progress: '진행', completed: '종료',
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    const res = await fetch(`/api/tournaments/${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('대회가 삭제되었습니다')
      setConfirmId(null)
      router.refresh()
    } else {
      const { error } = await res.json() as { error: string }
      toast.error('삭제 실패: ' + error)
    }
    setDeleting(false)
  }

  return (
    <div className="space-y-3">
      {tournaments.map((t: Tournament) => (
        <div key={t.id} className="glass rounded-xl p-4 border border-white/10 hover:bg-white/5 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{t.name}</div>
              <div className="text-sm text-muted-foreground">{t.venue} · {t.start_date}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-medium px-2 py-1 rounded-full status-${t.status}`}>
                {statusLabel[t.status] ?? t.status}
              </span>
              <Link href={`/admin/tournaments/${t.id}/edit`}
                className="text-xs px-3 py-1.5 rounded-lg glass border border-white/10 hover:bg-white/10 transition-colors">
                관리
              </Link>
              <button
                onClick={() => setConfirmId(t.id)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                title="대회 삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 인라인 삭제 확인 */}
          {confirmId === t.id && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <p className="text-sm text-red-300">
                  <span className="font-semibold">"{t.name}"</span>을(를) 삭제하시겠습니까?<br />
                  부수·선수·대진표가 모두 영구 삭제됩니다.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete(t.id)}
                  disabled={deleting}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                >
                  {deleting ? '삭제 중...' : '삭제 확인'}
                </button>
                <button
                  onClick={() => setConfirmId(null)}
                  className="px-3 py-1.5 rounded-lg text-xs glass border border-white/10 hover:bg-white/10 transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
