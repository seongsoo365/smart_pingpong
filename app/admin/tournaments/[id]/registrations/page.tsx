'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ChevronLeft, Check, Trash2, CheckCheck, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Division, Player, Team, TeamMember } from '@/lib/types'

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }

interface PendingPlayer extends Player { division?: Division }
interface PendingTeam extends Team { division?: Division; members: TeamMember[] }

export default function RegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()

  const [divisions, setDivisions] = useState<Division[]>([])
  const [pendingPlayers, setPendingPlayers] = useState<PendingPlayer[]>([])
  const [pendingTeams, setPendingTeams] = useState<PendingTeam[]>([])
  const [selectedDivId, setSelectedDivId] = useState('all')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const { data: divs } = await supabase
      .from('divisions').select('*').eq('tournament_id', id).order('display_order')
    if (!divs?.length) { setLoading(false); return }

    const divIds = divs.map(d => d.id)
    const divMap = new Map(divs.map(d => [d.id, d]))

    const individualDivIds = divs.filter(d => d.match_type === 'individual').map(d => d.id)
    const teamDivIds = divs.filter(d => d.match_type === 'team').map(d => d.id)

    const [{ data: players }, { data: teams }] = await Promise.all([
      individualDivIds.length > 0
        ? supabase.from('players').select('*').in('division_id', individualDivIds).eq('confirmed', false).order('created_at')
        : Promise.resolve({ data: [] as Player[] }),
      teamDivIds.length > 0
        ? supabase.from('teams').select('*, members:team_members(*)').in('division_id', teamDivIds).eq('confirmed', false).order('created_at' as never)
        : Promise.resolve({ data: [] as (Team & { members: TeamMember[] })[] }),
    ])

    setDivisions(divs)
    setPendingPlayers((players ?? []).map(p => ({ ...p, division: divMap.get(p.division_id) })))
    setPendingTeams((teams ?? []).map(t => ({ ...t, division: divMap.get(t.division_id), members: (t as any).members ?? [] })))
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const totalPending = pendingPlayers.length + pendingTeams.length

  // --- Player actions ---
  async function approvePlayer(p: PendingPlayer) {
    const { error } = await supabase.from('players').update({ confirmed: true }).eq('id', p.id)
    if (error) { toast.error('승인 실패: ' + error.message); return }
    setPendingPlayers(prev => prev.filter(x => x.id !== p.id))
    toast.success(`${p.name} 선수를 승인했습니다`)
  }

  async function rejectPlayer(p: PendingPlayer) {
    if (!confirm(`"${p.name}" 선수의 신청을 거절하시겠습니까?`)) return
    const { error } = await supabase.from('players').delete().eq('id', p.id)
    if (error) { toast.error('거절 실패'); return }
    setPendingPlayers(prev => prev.filter(x => x.id !== p.id))
    toast.success(`${p.name} 신청을 거절했습니다`)
  }

  async function approveAllPlayers(divId: string) {
    const targets = pendingPlayers.filter(p => p.division_id === divId)
    if (!targets.length || !confirm(`${targets.length}명을 모두 승인하시겠습니까?`)) return
    const ids = targets.map(p => p.id)
    const { error } = await supabase.from('players').update({ confirmed: true }).in('id', ids)
    if (error) { toast.error('일괄 승인 실패'); return }
    setPendingPlayers(prev => prev.filter(p => !ids.includes(p.id)))
    toast.success(`${targets.length}명을 일괄 승인했습니다`)
  }

  // --- Team actions ---
  async function approveTeam(t: PendingTeam) {
    const { error } = await supabase.from('teams').update({ confirmed: true }).eq('id', t.id)
    if (error) { toast.error('승인 실패: ' + error.message); return }
    setPendingTeams(prev => prev.filter(x => x.id !== t.id))
    toast.success(`${t.name} 팀을 승인했습니다`)
  }

  async function rejectTeam(t: PendingTeam) {
    if (!confirm(`"${t.name}" 팀의 신청을 거절하시겠습니까?`)) return
    const { error } = await supabase.from('teams').delete().eq('id', t.id)
    if (error) { toast.error('거절 실패'); return }
    setPendingTeams(prev => prev.filter(x => x.id !== t.id))
    toast.success(`${t.name} 팀 신청을 거절했습니다`)
  }

  async function approveAllTeams(divId: string) {
    const targets = pendingTeams.filter(t => t.division_id === divId)
    if (!targets.length || !confirm(`${targets.length}팀을 모두 승인하시겠습니까?`)) return
    const ids = targets.map(t => t.id)
    const { error } = await supabase.from('teams').update({ confirmed: true }).in('id', ids)
    if (error) { toast.error('일괄 승인 실패'); return }
    setPendingTeams(prev => prev.filter(t => !ids.includes(t.id)))
    toast.success(`${targets.length}팀을 일괄 승인했습니다`)
  }

  // filtered views
  const filteredPlayers = selectedDivId === 'all' ? pendingPlayers : pendingPlayers.filter(p => p.division_id === selectedDivId)
  const filteredTeams   = selectedDivId === 'all' ? pendingTeams  : pendingTeams.filter(t => t.division_id === selectedDivId)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/tournaments/${id}/edit`} className="p-2 glass rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">접수 관리</h1>
          <p className="text-sm text-muted-foreground">미승인 신청 {totalPending}건</p>
        </div>
      </div>

      {/* Division filter tabs */}
      {divisions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setSelectedDivId('all')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${selectedDivId === 'all' ? 'bg-primary text-primary-foreground' : 'glass border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10'}`}>
            전체 ({totalPending})
          </button>
          {divisions.map(div => {
            const cnt = pendingPlayers.filter(p => p.division_id === div.id).length
                      + pendingTeams.filter(t => t.division_id === div.id).length
            return (
              <button key={div.id} onClick={() => setSelectedDivId(div.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${selectedDivId === div.id ? 'bg-primary text-primary-foreground' : 'glass border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10'}`}>
                {genderLabel[div.gender]} {div.name} ({cnt})
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">불러오는 중...</div>
      ) : totalPending === 0 ? (
        <div className="glass rounded-2xl p-10 border border-white/10 text-center text-muted-foreground text-sm">
          미승인 접수 신청이 없습니다
        </div>
      ) : (
        <div className="space-y-4">
          {/* Individual divisions */}
          {divisions.filter(d => d.match_type === 'individual').map(div => {
            const players = filteredPlayers.filter(p => p.division_id === div.id)
            if (!players.length) return null
            return (
              <section key={div.id} className="glass rounded-2xl p-5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">
                    {genderLabel[div.gender]} {div.name}
                    <span className="text-muted-foreground font-normal text-sm ml-2">{players.length}명 대기</span>
                  </h2>
                  <button onClick={() => approveAllPlayers(div.id)}
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <CheckCheck className="w-3.5 h-3.5" /> 전체 승인
                  </button>
                </div>
                <div className="space-y-2">
                  {players.map(p => (
                    <div key={p.id} className="rounded-xl bg-white/5 px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-muted-foreground space-x-2">
                          {p.club && <span>{p.club}</span>}
                          {p.phone && <span>{p.phone}</span>}
                          <span className="text-white/20">{new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => approvePlayer(p)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                          <Check className="w-3 h-3" /> 승인
                        </button>
                        <button onClick={() => rejectPlayer(p)}
                          className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}

          {/* Team divisions */}
          {divisions.filter(d => d.match_type === 'team').map(div => {
            const teams = filteredTeams.filter(t => t.division_id === div.id)
            if (!teams.length) return null
            return (
              <section key={div.id} className="glass rounded-2xl p-5 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">
                    {genderLabel[div.gender]} {div.name}
                    <span className="text-muted-foreground font-normal text-sm ml-2">{teams.length}팀 대기</span>
                  </h2>
                  <button onClick={() => approveAllTeams(div.id)}
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                    <CheckCheck className="w-3.5 h-3.5" /> 전체 승인
                  </button>
                </div>
                <div className="space-y-2">
                  {teams.map(t => (
                    <div key={t.id} className="rounded-xl bg-white/5 px-4 py-3 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="font-medium">{t.name}</span>
                            {t.club && <span className="text-xs text-muted-foreground">{t.club}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 pl-5">
                            {t.members.sort((a, b) => a.player_order - b.player_order).map(m => m.player_name).join(' · ')}
                            <span className="ml-2 text-white/20">({t.members.length}명)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => approveTeam(t)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                            <Check className="w-3 h-3" /> 승인
                          </button>
                          <button onClick={() => rejectTeam(t)}
                            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
