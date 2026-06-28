'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, Clock, Pencil, X, User, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  getMyRegistrationsByTournament,
  removeMyRegistration,
  type MyRegistration,
} from '@/lib/utils/myRegistrations'
import type { Division, Player, Team } from '@/lib/types'

interface RegistrationStatus {
  reg: MyRegistration
  name: string
  division: Division | null
  confirmed: boolean
}

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }

export default function MyRegistrationStatus({ tournamentId }: { tournamentId: string }) {
  const supabase = createClient()
  const [statuses, setStatuses] = useState<RegistrationStatus[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const regs = getMyRegistrationsByTournament(tournamentId)
    if (!regs.length) { setLoaded(true); return }

    const playerIds = regs.filter(r => r.type === 'player').map(r => r.id)
    const teamIds = regs.filter(r => r.type === 'team').map(r => r.id)

    const [playersRes, teamsRes] = await Promise.all([
      playerIds.length > 0
        ? supabase.from('players').select('*, division:divisions(*)').in('id', playerIds)
        : Promise.resolve({ data: [] as (Player & { division: Division })[] }),
      teamIds.length > 0
        ? supabase.from('teams').select('*, division:divisions(*)').in('id', teamIds)
        : Promise.resolve({ data: [] as (Team & { division: Division })[] }),
    ])

    const results: RegistrationStatus[] = []
    for (const reg of regs) {
      if (reg.type === 'player') {
        const p = (playersRes.data ?? []).find(x => x.id === reg.id) as (Player & { division: Division }) | undefined
        if (p) {
          results.push({ reg, name: p.name, division: p.division ?? null, confirmed: p.confirmed })
        } else {
          removeMyRegistration(reg.id)
        }
      } else {
        const t = (teamsRes.data ?? []).find(x => x.id === reg.id) as (Team & { division: Division }) | undefined
        if (t) {
          results.push({ reg, name: t.name, division: t.division ?? null, confirmed: t.confirmed })
        } else {
          removeMyRegistration(reg.id)
        }
      }
    }
    setStatuses(results)
    setLoaded(true)
  }

  async function cancelRegistration(s: RegistrationStatus) {
    if (!confirm(`"${s.name}" 신청을 취소하시겠습니까?`)) return
    const table = s.reg.type === 'player' ? 'players' : 'teams'
    const { error } = await supabase.from(table).delete().eq('id', s.reg.id)
    if (error) { toast.error('취소 실패: ' + error.message); return }
    removeMyRegistration(s.reg.id)
    setStatuses(prev => prev.filter(x => x.reg.id !== s.reg.id))
    toast.success('신청이 취소되었습니다.')
  }

  if (!loaded || statuses.length === 0) return null

  const hasApproved = statuses.some(s => s.confirmed)

  return (
    <div className="glass rounded-2xl border border-white/10 p-5 space-y-3">
      <h2 className="text-sm font-semibold">내 신청 내역</h2>
      {statuses.map(s => (
        <div key={s.reg.id} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
          s.confirmed ? 'border-primary/40 bg-primary/5' : 'border-white/10 bg-white/5'
        }`}>
          {s.reg.type === 'team'
            ? <Users className="w-4 h-4 text-primary shrink-0" />
            : <User className="w-4 h-4 text-primary shrink-0" />}
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm">{s.name}</div>
            {s.division && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {genderLabel[s.division.gender]} {s.division.name} · {s.reg.type === 'team' ? '단체전' : '개인전'}
              </div>
            )}
          </div>
          {s.confirmed ? (
            <span className="flex items-center gap-1 text-xs text-primary font-medium shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5" /> 승인됨
            </span>
          ) : (
            <div className="flex items-center gap-1 shrink-0">
              <span className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
                <Clock className="w-3.5 h-3.5 text-accent" /> 검토 중
              </span>
              <Link
                href={`/tournaments/${tournamentId}/my-registration?regId=${s.reg.id}&type=${s.reg.type}`}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                title="수정"
              >
                <Pencil className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={() => cancelRegistration(s)}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                title="취소"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      ))}
      {hasApproved && (
        <p className="text-xs text-muted-foreground">
          승인된 신청은 수정이 필요한 경우 운영진에게 문의하세요.
        </p>
      )}
    </div>
  )
}
