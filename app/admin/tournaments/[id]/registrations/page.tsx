'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ChevronLeft, Check, Trash2, CheckCheck, Users, Clock, ShieldCheck, RotateCcw, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Division, Player, Team, TeamMember } from '@/lib/types'

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }

interface PendingPlayer extends Player { division?: Division }
interface PendingTeam extends Team { division?: Division; members: TeamMember[]; created_at: string }

export default function RegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()

  const [tournamentName, setTournamentName] = useState('')
  const [divisions, setDivisions] = useState<Division[]>([])
  const [pendingPlayers, setPendingPlayers] = useState<PendingPlayer[]>([])
  const [pendingTeams, setPendingTeams] = useState<PendingTeam[]>([])
  const [approvedPlayers, setApprovedPlayers] = useState<PendingPlayer[]>([])
  const [approvedTeams, setApprovedTeams] = useState<PendingTeam[]>([])
  // 부수별 승인된 팀 수
  const [approvedTeamCounts, setApprovedTeamCounts] = useState<Record<string, number>>({})
  const [selectedDivId, setSelectedDivId] = useState('all')
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const [{ data: divs }, { data: t }] = await Promise.all([
      supabase.from('divisions').select('*').eq('tournament_id', id).order('display_order'),
      supabase.from('tournaments').select('name').eq('id', id).single(),
    ])
    if (t?.name) setTournamentName(t.name)
    if (!divs?.length) { setLoading(false); return }

    const divMap = new Map(divs.map(d => [d.id, d]))
    const individualDivIds = divs.filter(d => d.match_type === 'individual').map(d => d.id)
    const teamDivIds = divs.filter(d => d.match_type === 'team').map(d => d.id)

    const [
      { data: players },
      { data: pendingTeamsData },
      { data: approvedPlayersData },
      { data: approvedTeamsData },
    ] = await Promise.all([
      individualDivIds.length > 0
        ? supabase.from('players').select('*').in('division_id', individualDivIds).eq('confirmed', false).order('created_at')
        : Promise.resolve({ data: [] as Player[] }),
      teamDivIds.length > 0
        ? supabase.from('teams').select('*, members:team_members(*)').in('division_id', teamDivIds).eq('confirmed', false).order('created_at')
        : Promise.resolve({ data: [] as (Team & { members: TeamMember[] })[] }),
      individualDivIds.length > 0
        ? supabase.from('players').select('*').in('division_id', individualDivIds).eq('confirmed', true).order('created_at')
        : Promise.resolve({ data: [] as Player[] }),
      teamDivIds.length > 0
        ? supabase.from('teams').select('*, members:team_members(*)').in('division_id', teamDivIds).eq('confirmed', true).order('created_at')
        : Promise.resolve({ data: [] as (Team & { members: TeamMember[] })[] }),
    ])

    // 부수별 승인 팀 수 집계
    const counts: Record<string, number> = {}
    for (const t of approvedTeamsData ?? []) {
      counts[(t as Team).division_id] = (counts[(t as Team).division_id] ?? 0) + 1
    }

    setDivisions(divs)
    setPendingPlayers((players ?? []).map(p => ({ ...p, division: divMap.get(p.division_id) })))
    setPendingTeams(
      ((pendingTeamsData ?? []) as (Team & { members: TeamMember[]; created_at: string })[])
        .map(t => ({ ...t, division: divMap.get(t.division_id), members: (t as any).members ?? [] }))
    )
    setApprovedPlayers((approvedPlayersData ?? []).map(p => ({ ...p, division: divMap.get(p.division_id) })))
    setApprovedTeams(
      ((approvedTeamsData ?? []) as (Team & { members: TeamMember[]; created_at: string })[])
        .map(t => ({ ...t, division: divMap.get(t.division_id), members: (t as any).members ?? [] }))
    )
    setApprovedTeamCounts(counts)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const totalPending = pendingPlayers.length + pendingTeams.length
  const totalApproved = approvedPlayers.length + approvedTeams.length

  // --- Player actions ---
  async function approvePlayer(p: PendingPlayer) {
    const { error } = await supabase.from('players').update({ confirmed: true }).eq('id', p.id)
    if (error) { toast.error('승인 실패: ' + error.message); return }
    setPendingPlayers(prev => prev.filter(x => x.id !== p.id))
    toast.success(`${p.name} 선수를 승인했습니다`)
    notify('approved', p.email, p.name, p.division)
  }

  async function rejectPlayer(p: PendingPlayer) {
    if (!confirm(`"${p.name}" 선수의 신청을 거절하시겠습니까?`)) return
    const { error } = await supabase.from('players').delete().eq('id', p.id)
    if (error) { toast.error('거절 실패'); return }
    setPendingPlayers(prev => prev.filter(x => x.id !== p.id))
    toast.success(`${p.name} 신청을 거절했습니다`)
    notify('rejected', p.email, p.name, p.division)
  }

  async function approveAllPlayers(divId: string) {
    const targets = pendingPlayers.filter(p => p.division_id === divId)
    if (!targets.length || !confirm(`${targets.length}명을 모두 승인하시겠습니까?`)) return
    const ids = targets.map(p => p.id)
    const { error } = await supabase.from('players').update({ confirmed: true }).in('id', ids)
    if (error) { toast.error('일괄 승인 실패'); return }
    setPendingPlayers(prev => prev.filter(p => !ids.includes(p.id)))
    toast.success(`${targets.length}명을 일괄 승인했습니다`)
    targets.forEach(p => notify('approved', p.email, p.name, p.division))
  }

  // --- Team actions ---
  async function approveTeam(t: PendingTeam) {
    const div = divisions.find(d => d.id === t.division_id)
    const approved = approvedTeamCounts[t.division_id] ?? 0
    if (div?.max_teams && approved >= div.max_teams) {
      toast.error(`이미 최대 참가팀(${div.max_teams}팀)에 도달했습니다`)
      return
    }
    const { error } = await supabase.from('teams').update({ confirmed: true }).eq('id', t.id)
    if (error) { toast.error('승인 실패: ' + error.message); return }
    setPendingTeams(prev => prev.filter(x => x.id !== t.id))
    setApprovedTeamCounts(prev => ({ ...prev, [t.division_id]: (prev[t.division_id] ?? 0) + 1 }))
    toast.success(`${t.name} 팀을 승인했습니다`)
    notify('approved', t.email, t.name, div)
  }

  async function rejectTeam(t: PendingTeam) {
    if (!confirm(`"${t.name}" 팀의 신청을 거절하시겠습니까?`)) return
    const { error } = await supabase.from('teams').delete().eq('id', t.id)
    if (error) { toast.error('거절 실패'); return }
    setPendingTeams(prev => prev.filter(x => x.id !== t.id))
    toast.success(`${t.name} 팀 신청을 거절했습니다`)
    notify('rejected', t.email, t.name, divisions.find(d => d.id === t.division_id))
  }

  // 시간순 1팀씩 승인 (신청이 가장 이른 팀 → 빈 슬롯만큼)
  async function approveOldestTeams(divId: string) {
    const div = divisions.find(d => d.id === divId)
    const queue = pendingTeams.filter(t => t.division_id === divId) // 이미 created_at 오름차순
    if (!queue.length) return

    const approved = approvedTeamCounts[divId] ?? 0
    const available = div?.max_teams ? div.max_teams - approved : queue.length
    if (available <= 0) { toast.error('이미 최대 참가팀에 도달했습니다'); return }

    const toApprove = queue.slice(0, available)
    if (!confirm(`신청 시간 순으로 ${toApprove.length}팀을 승인하시겠습니까?`)) return

    const ids = toApprove.map(t => t.id)
    const { error } = await supabase.from('teams').update({ confirmed: true }).in('id', ids)
    if (error) { toast.error('일괄 승인 실패'); return }
    setPendingTeams(prev => prev.filter(t => !ids.includes(t.id)))
    setApprovedTeamCounts(prev => ({ ...prev, [divId]: (prev[divId] ?? 0) + toApprove.length }))
    toast.success(`${toApprove.length}팀을 시간순으로 승인했습니다`)
    toApprove.forEach(t => notify('approved', t.email, t.name, div))
  }

  function notify(type: 'approved' | 'rejected', email: string | undefined, name: string, division?: Division) {
    if (!email) return
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        email,
        name,
        tournamentName,
        divisionName: division ? `${genderLabel[division.gender]} ${division.name}` : '',
      }),
    })
  }

  // --- Revoke approval ---
  async function revokePlayer(p: PendingPlayer) {
    if (!confirm(`"${p.name}" 선수의 승인을 취소하시겠습니까?\n취소하면 신청자가 정보를 수정할 수 있습니다.`)) return
    const { error } = await supabase.from('players').update({ confirmed: false }).eq('id', p.id)
    if (error) { toast.error('승인 취소 실패: ' + error.message); return }
    setApprovedPlayers(prev => prev.filter(x => x.id !== p.id))
    setPendingPlayers(prev => [{ ...p, confirmed: false }, ...prev])
    toast.success(`${p.name} 선수의 승인이 취소되었습니다`)
  }

  async function revokeTeam(t: PendingTeam) {
    if (!confirm(`"${t.name}" 팀의 승인을 취소하시겠습니까?\n취소하면 신청자가 정보를 수정할 수 있습니다.`)) return
    const { error } = await supabase.from('teams').update({ confirmed: false }).eq('id', t.id)
    if (error) { toast.error('승인 취소 실패: ' + error.message); return }
    setApprovedTeams(prev => prev.filter(x => x.id !== t.id))
    setPendingTeams(prev => [{ ...t, confirmed: false }, ...prev])
    setApprovedTeamCounts(prev => ({ ...prev, [t.division_id]: Math.max(0, (prev[t.division_id] ?? 1) - 1) }))
    toast.success(`${t.name} 팀의 승인이 취소되었습니다`)
  }

  const filteredPlayers = selectedDivId === 'all' ? pendingPlayers : pendingPlayers.filter(p => p.division_id === selectedDivId)
  const filteredTeams   = selectedDivId === 'all' ? pendingTeams  : pendingTeams.filter(t => t.division_id === selectedDivId)
  const filteredApprovedPlayers = selectedDivId === 'all' ? approvedPlayers : approvedPlayers.filter(p => p.division_id === selectedDivId)
  const filteredApprovedTeams   = selectedDivId === 'all' ? approvedTeams   : approvedTeams.filter(t => t.division_id === selectedDivId)

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

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
                          {p.email && <span className="text-primary/70">{p.email}</span>}
                          <span className="text-white/30">{new Date(p.created_at).toLocaleDateString('ko-KR')}</span>
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
            const approved = approvedTeamCounts[div.id] ?? 0
            const max = div.max_teams
            const slotsLeft = max ? max - approved : null
            const isFull = slotsLeft !== null && slotsLeft <= 0
            return (
              <section key={div.id} className="glass rounded-2xl p-5 border border-white/10 space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">
                      {genderLabel[div.gender]} {div.name}
                    </h2>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                        승인 {approved}{max ? `/${max}` : ''}팀
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-accent" />
                        대기 {teams.length}팀
                      </span>
                      {isFull && (
                        <span className="px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs">마감</span>
                      )}
                    </div>
                  </div>
                  {!isFull && (
                    <button onClick={() => approveOldestTeams(div.id)}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline shrink-0">
                      <Clock className="w-3.5 h-3.5" />
                      시간순 승인{slotsLeft !== null ? ` (${slotsLeft}팀)` : ''}
                    </button>
                  )}
                </div>

                {/* Pending queue — 신청 시간 오름차순 */}
                <div className="space-y-2">
                  {teams.map((t, idx) => {
                    const canApprove = !isFull || (slotsLeft !== null && slotsLeft > 0)
                    return (
                      <div key={t.id} className="rounded-xl bg-white/5 px-4 py-3 space-y-1.5">
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground text-xs w-5 shrink-0 text-right">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="font-medium">{t.name}</span>
                              {t.club && <span className="text-xs text-muted-foreground">{t.club}</span>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 pl-5">
                              {[...(t.members)].sort((a, b) => a.player_order - b.player_order)
                                .map(m => m.player_level ? `${m.player_name}(${m.player_level}부)` : m.player_name)
                                .join(' · ')}
                              <span className="ml-1.5 text-white/30">({t.members.length}명)</span>
                            </div>
                            <div className="text-xs text-white/30 mt-0.5 pl-5 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {formatTime(t.created_at)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button onClick={() => approveTeam(t)} disabled={!canApprove}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                              <Check className="w-3 h-3" /> 승인
                            </button>
                            <button onClick={() => rejectTeam(t)}
                              className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {/* 승인 완료 섹션 */}
      {totalApproved > 0 && (
        <details className="group">
          <summary className="flex items-center gap-2 cursor-pointer list-none select-none py-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">승인 완료 ({totalApproved}건)</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto transition-transform duration-200 group-open:rotate-180" />
          </summary>

          <div className="space-y-4 mt-3">
            {/* 개인전 승인 목록 */}
            {divisions.filter(d => d.match_type === 'individual').map(div => {
              const players = filteredApprovedPlayers.filter(p => p.division_id === div.id)
              if (!players.length) return null
              return (
                <section key={div.id} className="glass rounded-2xl p-5 border border-primary/20 space-y-3">
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    {genderLabel[div.gender]} {div.name}
                    <span className="text-muted-foreground font-normal">{players.length}명 승인</span>
                  </h2>
                  <div className="space-y-2">
                    {players.map(p => (
                      <div key={p.id} className="rounded-xl bg-primary/5 px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{p.name}</div>
                          <div className="text-xs text-muted-foreground space-x-2">
                            {p.club && <span>{p.club}</span>}
                            {p.phone && <span>{p.phone}</span>}
                            {p.email && <span className="text-primary/70">{p.email}</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => revokePlayer(p)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 glass border border-white/10 rounded-lg text-xs text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors shrink-0"
                        >
                          <RotateCcw className="w-3 h-3" /> 승인 취소
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}

            {/* 단체전 승인 목록 */}
            {divisions.filter(d => d.match_type === 'team').map(div => {
              const teams = filteredApprovedTeams.filter(t => t.division_id === div.id)
              if (!teams.length) return null
              return (
                <section key={div.id} className="glass rounded-2xl p-5 border border-primary/20 space-y-3">
                  <h2 className="font-semibold text-sm flex items-center gap-2">
                    {genderLabel[div.gender]} {div.name}
                    <span className="text-muted-foreground font-normal">{teams.length}팀 승인</span>
                  </h2>
                  <div className="space-y-2">
                    {teams.map(t => (
                      <div key={t.id} className="rounded-xl bg-primary/5 px-4 py-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="font-medium text-sm">{t.name}</span>
                            {t.club && <span className="text-xs text-muted-foreground">{t.club}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 pl-5">
                            {[...(t.members)].sort((a, b) => a.player_order - b.player_order)
                              .map(m => m.player_level ? `${m.player_name}(${m.player_level}부)` : m.player_name)
                              .join(' · ')}
                            <span className="ml-1.5 text-white/30">({t.members.length}명)</span>
                          </div>
                        </div>
                        <button
                          onClick={() => revokeTeam(t)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 glass border border-white/10 rounded-lg text-xs text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors shrink-0 mt-0.5"
                        >
                          <RotateCcw className="w-3 h-3" /> 승인 취소
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </details>
      )}
    </div>
  )
}
