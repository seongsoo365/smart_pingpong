'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, CheckCircle, Pencil, Check, X, ChevronDown, ChevronUp, AlertTriangle, TableIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { calculateStandings, hasTieAtBoundary, getTieGroups } from '@/lib/utils/standings'
import { getRoundName } from '@/lib/utils/bracket'
import GroupMatrix from '@/components/tournament/GroupMatrix'
import { cn } from '@/lib/utils'
import type { Division, Player, TournamentPhase, Match, Group } from '@/lib/types'

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }

export default function ScoresPage() {
  const { id } = useParams<{ id: string }>()
  const [divisions, setDivisions] = useState<Division[]>([])
  const [selectedDivId, setSelectedDivId] = useState('')
  const [phases, setPhases] = useState<TournamentPhase[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  const [showPlayers, setShowPlayers] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editPlayerName, setEditPlayerName] = useState('')
  const [editPlayerClub, setEditPlayerClub] = useState('')
  const [selectedPhaseType, setSelectedPhaseType] = useState<'preliminary' | 'main'>('preliminary')
  // tieBreaks: groupId → manually-ordered participant IDs (only set when tie detected)
  const [tieBreaks, setTieBreaks] = useState<Record<string, string[]>>({})
  // showMatrix: groupId → boolean toggle
  const [showMatrix, setShowMatrix] = useState<Record<string, boolean>>({})
  const supabase = createClient()

  useEffect(() => {
    supabase.from('divisions').select('*').eq('tournament_id', id).order('display_order')
      .then(({ data }) => { setDivisions(data ?? []); if (data?.[0]) setSelectedDivId(data[0].id) })
  }, [id])

  async function loadData(divId: string) {
    const [{ data: ph }, { data: pl }] = await Promise.all([
      supabase.from('tournament_phases').select('*').eq('division_id', divId).order('phase_order'),
      supabase.from('players').select('*').eq('division_id', divId),
    ])
    setPhases(ph ?? [])
    setPlayers(pl ?? [])

    setSelectedPhaseType(prev => {
      const hasPrelim = (ph ?? []).some(p => p.phase_type === 'preliminary')
      const hasMain = (ph ?? []).some(p => p.phase_type === 'main')
      if (prev === 'preliminary' && hasPrelim) return prev
      if (prev === 'main' && hasMain) return prev
      return hasPrelim ? 'preliminary' : 'main'
    })

    const phaseIds = (ph ?? []).map(p => p.id)
    if (phaseIds.length === 0) return

    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from('groups').select('*').in('phase_id', phaseIds).order('display_order'),
      supabase.from('matches').select('*').in('phase_id', phaseIds).order('round').order('match_number'),
    ])
    setGroups(g ?? [])

    const allMatches = m ?? []
    const mainPhase = (ph ?? []).find(p => p.phase_type === 'main')
    if (mainPhase) {
      const byeMatches = allMatches.filter(x =>
        x.phase_id === mainPhase.id && x.status === 'bye' && x.winner_id && x.round === 1
      )
      const round2 = allMatches
        .filter(x => x.phase_id === mainPhase.id && x.round === 2)
        .sort((a, b) => a.match_number - b.match_number)
      for (const byeMatch of byeMatches) {
        const slot = Math.floor((byeMatch.match_number - 1) / 2)
        const next = round2[slot]
        if (!next) continue
        const isP1 = byeMatch.match_number % 2 === 1
        if (isP1 && !next.participant1_id) {
          await supabase.from('matches').update({ participant1_id: byeMatch.winner_id }).eq('id', next.id)
          next.participant1_id = byeMatch.winner_id
        } else if (!isP1 && !next.participant2_id) {
          await supabase.from('matches').update({ participant2_id: byeMatch.winner_id }).eq('id', next.id)
          next.participant2_id = byeMatch.winner_id
        }
      }
    }
    setMatches(allMatches)
  }

  useEffect(() => { if (selectedDivId) loadData(selectedDivId) }, [selectedDivId])

  // Detect completed groups with ties after every match update
  useEffect(() => {
    const prelimPhase = phases.find(p => p.phase_type === 'preliminary')
    if (!prelimPhase) return
    const groupsInPhase = groups.filter(g => g.phase_id === prelimPhase.id)

    setTieBreaks(prev => {
      const next: Record<string, string[]> = {}
      for (const group of groupsInPhase) {
        const gMatches = matches.filter(m => m.group_id === group.id)
        if (gMatches.length === 0 || !gMatches.every(m => m.status === 'completed')) continue
        const ids = [...new Set([
          ...gMatches.map(m => m.participant1_id),
          ...gMatches.map(m => m.participant2_id),
        ].filter(Boolean))] as string[]
        const standings = calculateStandings(gMatches, ids)
        if (getTieGroups(standings).length > 0) {
          // Keep existing manual ordering if already set for this group
          next[group.id] = prev[group.id] ?? standings.map(s => s.participant_id)
        }
      }
      return next
    })
  }, [matches, groups, phases])

  const pMap = new Map(players.map(p => [p.id, p]))

  async function saveScore(match: Match) {
    const gamesPerMatch = phases.find(p => p.id === match.phase_id)?.games_per_match ?? 3
    const needed = Math.ceil(gamesPerMatch / 2)
    const winner_id = score1 >= needed ? match.participant1_id : score2 >= needed ? match.participant2_id : undefined

    await supabase.from('matches').update({
      score1, score2, winner_id: winner_id ?? null, status: 'completed', ended_at: new Date().toISOString(),
    }).eq('id', match.id)

    toast.success('결과가 저장되었습니다')
    setEditing(null)

    const phase = phases.find(p => p.id === match.phase_id)
    if (winner_id && phase?.phase_type === 'main') {
      const nextRoundMatches = matches.filter(m => m.phase_id === match.phase_id && m.round === match.round + 1)
      if (nextRoundMatches.length > 0) {
        const slot = Math.floor((match.match_number - 1) / 2)
        const nextMatch = nextRoundMatches[slot]
        if (nextMatch) {
          const isP1 = match.match_number % 2 === 1
          await supabase.from('matches').update(
            isP1 ? { participant1_id: winner_id } : { participant2_id: winner_id }
          ).eq('id', nextMatch.id)
        }
      }
    }

    if (phase?.phase_type === 'preliminary' && match.group_id) {
      await checkPrelimAdvancement(match.group_id, phase)
    }

    await loadData(selectedDivId)
  }

  async function checkPrelimAdvancement(groupId: string, phase: TournamentPhase) {
    const groupMatches = matches.filter(m => m.group_id === groupId)
    const updatedMatches = groupMatches.map(m => m.id === editing
      ? { ...m, score1, score2, status: 'completed' as const, winner_id: score1 > score2 ? m.participant1_id : m.participant2_id }
      : m)
    const allDone = updatedMatches.every(m => m.status === 'completed')
    if (!allDone) return

    const participantIds = [...new Set([
      ...updatedMatches.map(m => m.participant1_id),
      ...updatedMatches.map(m => m.participant2_id),
    ].filter(Boolean))] as string[]

    const standings = calculateStandings(updatedMatches, participantIds)
    const advanceCount = phase.advancement_count ?? 2

    // If there's a tie at the advancement boundary, block auto-advancement
    if (hasTieAtBoundary(standings, advanceCount)) return

    await advanceGroup(groupId, phase, standings.map(s => s.participant_id))
  }

  async function advanceGroup(groupId: string, phase: TournamentPhase, orderedIds: string[]) {
    const advanceCount = phase.advancement_count ?? 2
    const advancers = orderedIds.slice(0, advanceCount)
    const mainPhase = phases.find(p => p.phase_type === 'main')
    if (!mainPhase || advancers.length === 0) return

    const mainMatches = matches.filter(m => m.phase_id === mainPhase.id && m.round === 1)
    const groupIndex = groups.filter(g => g.phase_id === phase.id).findIndex(g => g.id === groupId)

    for (let i = 0; i < advancers.length; i++) {
      const slotIndex = groupIndex * advanceCount + i
      const targetMatch = mainMatches[Math.floor(slotIndex / 2)]
      if (!targetMatch) continue
      const isP1 = slotIndex % 2 === 0
      await supabase.from('matches').update(
        isP1 ? { participant1_id: advancers[i] } : { participant2_id: advancers[i] }
      ).eq('id', targetMatch.id)
    }
  }

  async function confirmRanking(groupId: string) {
    const orderedIds = tieBreaks[groupId]
    if (!orderedIds) return

    const phase = phases.find(p => p.phase_type === 'preliminary')
    if (!phase) return

    const groupMatches = matches.filter(m => m.group_id === groupId)
    const participantIds = [...new Set([
      ...groupMatches.map(m => m.participant1_id),
      ...groupMatches.map(m => m.participant2_id),
    ].filter(Boolean))] as string[]

    const rawStandings = calculateStandings(groupMatches, participantIds)
    const statsMap = new Map(rawStandings.map(s => [s.participant_id, s]))

    // Save to standings table
    const upserts = orderedIds.map((pid, idx) => {
      const s = statsMap.get(pid) ?? { wins: 0, losses: 0, sets_won: 0, sets_lost: 0, points_won: 0, points_lost: 0 }
      return {
        group_id: groupId,
        participant_id: pid,
        ranking: idx + 1,
        wins: s.wins,
        losses: s.losses,
        sets_won: s.sets_won,
        sets_lost: s.sets_lost,
        points_won: s.points_won,
        points_lost: s.points_lost,
      }
    })
    const { error } = await supabase.from('standings').upsert(upserts, { onConflict: 'group_id,participant_id' })
    if (error) { toast.error('순위 저장 실패: ' + error.message); return }

    // Advance to main phase if not yet done
    await advanceGroup(groupId, phase, orderedIds)

    setTieBreaks(prev => { const n = { ...prev }; delete n[groupId]; return n })
    toast.success('순위가 확정되었습니다')
    await loadData(selectedDivId)
  }

  function moveInTie(groupId: string, fromIdx: number, dir: -1 | 1) {
    const toIdx = fromIdx + dir
    setTieBreaks(prev => {
      const arr = [...(prev[groupId] ?? [])]
      if (toIdx < 0 || toIdx >= arr.length) return prev
      // Only allow swapping within a tied group
      const gMatches = matches.filter(m => m.group_id === groupId)
      const ids = [...new Set([...gMatches.map(m => m.participant1_id), ...gMatches.map(m => m.participant2_id)].filter(Boolean))] as string[]
      const standings = calculateStandings(gMatches, ids)
      const tiedGroups = getTieGroups(standings)
      const fromOriginalIdx = standings.findIndex(s => s.participant_id === arr[fromIdx])
      const toOriginalIdx = standings.findIndex(s => s.participant_id === arr[toIdx])
      const canSwap = tiedGroups.some(g => g.includes(fromOriginalIdx) && g.includes(toOriginalIdx))
      if (!canSwap) return prev;
      [arr[fromIdx], arr[toIdx]] = [arr[toIdx], arr[fromIdx]]
      return { ...prev, [groupId]: arr }
    })
  }

  function startEditPlayer(p: Player) {
    setEditingPlayerId(p.id)
    setEditPlayerName(p.name)
    setEditPlayerClub(p.club ?? '')
  }

  async function savePlayerEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingPlayerId || !editPlayerName.trim()) return
    const { data, error } = await supabase
      .from('players')
      .update({ name: editPlayerName.trim(), club: editPlayerClub.trim() || null })
      .eq('id', editingPlayerId)
      .select()
      .single()
    if (error) { toast.error('수정 실패: ' + error.message); return }
    setPlayers(prev => prev.map(p => p.id === editingPlayerId ? data : p))
    setEditingPlayerId(null)
    toast.success('선수 이름이 수정되었습니다')
  }

  function renderMatch(m: Match) {
    const p1 = m.participant1_id ? pMap.get(m.participant1_id) : null
    const p2 = m.participant2_id ? pMap.get(m.participant2_id) : null
    const phase = phases.find(p => p.id === m.phase_id)
    const gamesNeeded = Math.ceil((phase?.games_per_match ?? 3) / 2)
    const isEditing = editing === m.id

    if (m.status === 'completed' && !isEditing) {
      return (
        <div key={m.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 text-sm">
          <span className={m.winner_id === m.participant1_id ? 'font-bold text-primary' : 'text-muted-foreground'}>
            {p1?.name ?? 'TBD'}
          </span>
          <div className="flex items-center gap-2 mx-4">
            <span className="font-bold tabular-nums">{m.score1} : {m.score2}</span>
            <button
              onClick={() => { setEditing(m.id); setScore1(m.score1); setScore2(m.score2) }}
              className="p-1 text-muted-foreground hover:text-primary transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
          <span className={m.winner_id === m.participant2_id ? 'font-bold text-primary' : 'text-muted-foreground'}>
            {p2?.name ?? 'TBD'}
          </span>
        </div>
      )
    }

    return (
      <div key={m.id} className="glass rounded-xl border border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 text-right">
            <div className="font-bold truncate">{p1?.name ?? 'TBD'}</div>
            {p1?.club && <div className="text-xs text-muted-foreground">{p1.club}</div>}
          </div>
          {isEditing ? (
            <div className="flex items-center gap-2 shrink-0">
              <input type="number" min={0} max={gamesNeeded} value={score1}
                onChange={e => setScore1(Number(e.target.value))}
                className="w-12 text-center glass border border-white/10 rounded-lg py-1.5 text-lg font-bold bg-transparent outline-none focus:border-primary" />
              <span className="text-muted-foreground font-bold">:</span>
              <input type="number" min={0} max={gamesNeeded} value={score2}
                onChange={e => setScore2(Number(e.target.value))}
                className="w-12 text-center glass border border-white/10 rounded-lg py-1.5 text-lg font-bold bg-transparent outline-none focus:border-primary" />
            </div>
          ) : (
            <div className="text-muted-foreground font-bold text-lg shrink-0">vs</div>
          )}
          <div className="flex-1">
            <div className="font-bold truncate">{p2?.name ?? 'TBD'}</div>
            {p2?.club && <div className="text-xs text-muted-foreground">{p2.club}</div>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-3">
          {isEditing ? (
            <>
              <button onClick={() => setEditing(null)}
                className="px-4 py-1.5 text-sm glass border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                취소
              </button>
              <button onClick={() => saveScore(m)}
                className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors">
                저장
              </button>
            </>
          ) : (
            <button onClick={() => { setEditing(m.id); setScore1(m.score1); setScore2(m.score2) }}
              className="px-4 py-1.5 text-sm glass border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
              결과 입력
            </button>
          )}
        </div>
      </div>
    )
  }

  const hasPrelim = phases.some(p => p.phase_type === 'preliminary')
  const hasMain = phases.some(p => p.phase_type === 'main')
  const showPhaseTabs = hasPrelim && hasMain
  const currentPhase = phases.find(p => p.phase_type === selectedPhaseType)
  const currentPhaseMatches = currentPhase ? matches.filter(m => m.phase_id === currentPhase.id) : []
  const prelimGroups = selectedPhaseType === 'preliminary'
    ? groups.filter(g => g.phase_id === currentPhase?.id)
    : []
  const totalMainRounds = currentPhaseMatches.length > 0 ? Math.max(...currentPhaseMatches.map(m => m.round)) : 0
  const mainRounds = selectedPhaseType === 'main'
    ? [...new Set(currentPhaseMatches.filter(m => m.status !== 'bye').map(m => m.round))].sort((a, b) => a - b)
    : []

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/tournaments/${id}/edit`} className="p-2 glass rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold">결과 입력</h1>
      </div>

      {/* Division tabs */}
      <div className="flex flex-wrap gap-2">
        {divisions.map(div => (
          <button key={div.id} onClick={() => { setSelectedDivId(div.id); setEditing(null) }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedDivId === div.id
                ? 'bg-primary text-primary-foreground'
                : 'glass border border-white/10 text-muted-foreground hover:bg-white/10'
            }`}>
            {genderLabel[div.gender]} {div.name}
          </button>
        ))}
      </div>

      {/* Player name editing */}
      {players.length > 0 && (
        <section className="glass rounded-xl border border-white/10">
          <button
            onClick={() => { setShowPlayers(p => !p); setEditingPlayerId(null) }}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-white/5 transition-colors rounded-xl"
          >
            <span>선수 이름 수정 ({players.length}명)</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showPlayers ? 'rotate-180' : ''}`} />
          </button>
          {showPlayers && (
            <div className="border-t border-white/10 p-3 space-y-1.5">
              {players.map(p => (
                <div key={p.id} className="rounded-lg bg-white/5 px-3 py-2">
                  {editingPlayerId === p.id ? (
                    <form onSubmit={savePlayerEdit} className="flex items-center gap-2 flex-wrap">
                      <input required value={editPlayerName} onChange={e => setEditPlayerName(e.target.value)}
                        placeholder="선수명 *"
                        className="flex-1 min-w-24 glass border border-white/10 rounded-lg px-2 py-1 text-sm bg-transparent outline-none focus:border-primary" />
                      <input value={editPlayerClub} onChange={e => setEditPlayerClub(e.target.value)}
                        placeholder="소속"
                        className="flex-1 min-w-24 glass border border-white/10 rounded-lg px-2 py-1 text-sm bg-transparent outline-none focus:border-primary" />
                      <div className="flex gap-1 shrink-0">
                        <button type="submit"
                          className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                          <Check className="w-3 h-3" />
                        </button>
                        <button type="button" onClick={() => setEditingPlayerId(null)}
                          className="p-1.5 glass border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{p.name}</span>
                        {p.club && <span className="text-xs text-muted-foreground ml-2">{p.club}</span>}
                      </div>
                      <button onClick={() => startEditPlayer(p)}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Phase tabs */}
      {showPhaseTabs && (
        <div className="flex border-b border-white/10">
          <button
            onClick={() => { setSelectedPhaseType('preliminary'); setEditing(null) }}
            className={`px-6 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              selectedPhaseType === 'preliminary'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            예선
          </button>
          <button
            onClick={() => { setSelectedPhaseType('main'); setEditing(null) }}
            className={`px-6 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
              selectedPhaseType === 'main'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            본선
          </button>
        </div>
      )}

      {/* Preliminary: grouped by 조 */}
      {selectedPhaseType === 'preliminary' && (
        <div className="space-y-8">
          {!currentPhase ? (
            <p className="text-sm text-muted-foreground text-center py-8">예선 단계가 없습니다</p>
          ) : prelimGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">예선 경기가 없습니다</p>
          ) : (
            prelimGroups.map(group => {
              const groupMatches = currentPhaseMatches.filter(m => m.group_id === group.id)
              const pending = groupMatches.filter(m => m.status === 'pending' || m.status === 'in_progress')
              const completed = groupMatches.filter(m => m.status === 'completed')
              const allDone = pending.length === 0 && completed.length > 0

              // Compute standings for this group (for tie-break UI)
              const groupIds = [...new Set([
                ...groupMatches.map(m => m.participant1_id),
                ...groupMatches.map(m => m.participant2_id),
              ].filter(Boolean))] as string[]
              const groupStandings = calculateStandings(groupMatches, groupIds)
              const tieGroups = getTieGroups(groupStandings)
              const tiedIndices = new Set(tieGroups.flat())
              const advanceCount = currentPhase.advancement_count ?? 2

              // Participants in standing order for matrix
              const rankedParticipants = groupStandings.map(s => ({
                id: s.participant_id,
                name: pMap.get(s.participant_id)?.name ?? '?',
                club: pMap.get(s.participant_id)?.club,
              }))

              return (
                <section key={group.id} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{group.name}</h2>
                    {allDone && !tieBreaks[group.id] ? (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> 완료
                      </span>
                    ) : allDone && tieBreaks[group.id] ? (
                      <span className="text-xs text-orange-400 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> 동률 — 순위 확정 필요
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">미완료 {pending.length}경기</span>
                    )}
                  </div>

                  {/* Tie-break panel */}
                  {tieBreaks[group.id] && (
                    <div className="glass rounded-xl border border-orange-500/30 p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0" />
                        <span className="text-sm font-semibold text-orange-400">
                          동률 발생 — 순위를 수동으로 조정해주세요
                        </span>
                      </div>
                      <div className="space-y-1">
                        {tieBreaks[group.id].map((pid, idx) => {
                          const player = pMap.get(pid)
                          const isAdvancing = idx < advanceCount
                          // Find this player's original index in calculated standings
                          const origIdx = groupStandings.findIndex(s => s.participant_id === pid)
                          const isTied = tiedIndices.has(origIdx)
                          const canUp = idx > 0 && (() => {
                            const prevPid = tieBreaks[group.id][idx - 1]
                            const prevOrigIdx = groupStandings.findIndex(s => s.participant_id === prevPid)
                            return tieGroups.some(g => g.includes(origIdx) && g.includes(prevOrigIdx))
                          })()
                          const canDown = idx < tieBreaks[group.id].length - 1 && (() => {
                            const nextPid = tieBreaks[group.id][idx + 1]
                            const nextOrigIdx = groupStandings.findIndex(s => s.participant_id === nextPid)
                            return tieGroups.some(g => g.includes(origIdx) && g.includes(nextOrigIdx))
                          })()
                          return (
                            <div
                              key={pid}
                              className={cn(
                                'flex items-center gap-3 px-3 py-2 rounded-lg',
                                isAdvancing ? 'bg-primary/10 border border-primary/20' : 'bg-white/5',
                                isTied && 'border-l-2 border-l-orange-400/60'
                              )}
                            >
                              <span className="w-5 text-center text-sm font-bold text-muted-foreground shrink-0">
                                {idx + 1}
                              </span>
                              <span className="flex-1 text-sm font-medium">{player?.name ?? pid}</span>
                              {player?.club && (
                                <span className="text-xs text-muted-foreground hidden sm:block">{player.club}</span>
                              )}
                              {isAdvancing && (
                                <span className="text-xs text-primary shrink-0">본선↑</span>
                              )}
                              {isTied && (
                                <div className="flex gap-0.5 shrink-0">
                                  <button
                                    disabled={!canUp}
                                    onClick={() => moveInTie(group.id, idx, -1)}
                                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    disabled={!canDown}
                                    onClick={() => moveInTie(group.id, idx, 1)}
                                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <button
                        onClick={() => confirmRanking(group.id)}
                        className="w-full py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                      >
                        순위 확정 및 본선 진출 처리
                      </button>
                    </div>
                  )}

                  {/* Matrix toggle */}
                  {completed.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowMatrix(prev => ({ ...prev, [group.id]: !prev[group.id] }))}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                      >
                        <TableIcon className="w-3.5 h-3.5" />
                        상대 전적 {showMatrix[group.id] ? '숨기기' : '보기'}
                        <ChevronDown className={cn('w-3 h-3 transition-transform', showMatrix[group.id] && 'rotate-180')} />
                      </button>
                      {showMatrix[group.id] && (
                        <div className="mt-2">
                          <GroupMatrix participants={rankedParticipants} matches={groupMatches} />
                        </div>
                      )}
                    </div>
                  )}

                  {pending.map(m => renderMatch(m))}
                  {completed.length > 0 && (
                    <div className="space-y-1.5">
                      {pending.length > 0 && (
                        <p className="text-xs text-muted-foreground font-medium pt-1">완료된 경기</p>
                      )}
                      {completed.map(m => renderMatch(m))}
                    </div>
                  )}
                </section>
              )
            })
          )}
        </div>
      )}

      {/* Main: grouped by round */}
      {selectedPhaseType === 'main' && (
        <div className="space-y-8">
          {!currentPhase ? (
            <p className="text-sm text-muted-foreground text-center py-8">본선 단계가 없습니다</p>
          ) : mainRounds.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">본선 경기가 없습니다</p>
          ) : (
            mainRounds.map(round => {
              const roundMatches = currentPhaseMatches.filter(m => m.round === round && m.status !== 'bye')
              const pending = roundMatches.filter(m => m.status === 'pending' || m.status === 'in_progress')
              const completed = roundMatches.filter(m => m.status === 'completed')
              const allTbd = roundMatches.every(m => !m.participant1_id && !m.participant2_id)
              return (
                <section key={round} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{getRoundName(round, totalMainRounds)}</h2>
                    {allTbd ? (
                      <span className="text-xs text-muted-foreground">대기 중</span>
                    ) : pending.length === 0 ? (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" /> 완료
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">미완료 {pending.length}경기</span>
                    )}
                  </div>
                  {allTbd ? (
                    <div className="text-center py-6 text-muted-foreground glass rounded-xl border border-white/10 text-sm">
                      이전 라운드 완료 후 대진이 확정됩니다
                    </div>
                  ) : (
                    <>
                      {pending.map(m => renderMatch(m))}
                      {completed.length > 0 && (
                        <div className="space-y-1.5">
                          {pending.length > 0 && (
                            <p className="text-xs text-muted-foreground font-medium pt-1">완료된 경기</p>
                          )}
                          {completed.map(m => renderMatch(m))}
                        </div>
                      )}
                    </>
                  )}
                </section>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
