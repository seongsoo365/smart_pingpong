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
import type { Division, Player, Team, TournamentPhase, Match, Group, MatchSet, TeamMatchFormat } from '@/lib/types'

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }

// ─── 단체전 방식별 경기 구성 ──────────────────────────────────────────────────

type GameType = 'singles' | 'doubles'
interface GameDef { type: GameType; label: string }

const TEAM_FORMAT_GAMES: Record<TeamMatchFormat, number> = {
  olympic: 5,
  traditional_4s1d: 5,
  swaythling: 9,
  singles_2_doubles_1: 3,
  three_doubles: 3,
  three_singles: 3,
}

const TEAM_MATCH_GAMES: Record<TeamMatchFormat, GameDef[]> = {
  olympic: [
    { type: 'doubles', label: '복식' },
    { type: 'singles', label: '단식 1' },
    { type: 'singles', label: '단식 2' },
    { type: 'singles', label: '단식 3' },
    { type: 'singles', label: '단식 4' },
  ],
  traditional_4s1d: [
    { type: 'singles', label: '단식 1' },
    { type: 'singles', label: '단식 2' },
    { type: 'doubles', label: '복식' },
    { type: 'singles', label: '단식 3' },
    { type: 'singles', label: '단식 4' },
  ],
  swaythling: [
    { type: 'singles', label: '단식 1' },
    { type: 'singles', label: '단식 2' },
    { type: 'singles', label: '단식 3' },
    { type: 'singles', label: '단식 4' },
    { type: 'singles', label: '단식 5' },
    { type: 'singles', label: '단식 6' },
    { type: 'singles', label: '단식 7' },
    { type: 'singles', label: '단식 8' },
    { type: 'singles', label: '단식 9' },
  ],
  singles_2_doubles_1: [
    { type: 'singles', label: '단식 1' },
    { type: 'doubles', label: '복식' },
    { type: 'singles', label: '단식 2' },
  ],
  three_doubles: [
    { type: 'doubles', label: '복식 1' },
    { type: 'doubles', label: '복식 2' },
    { type: 'doubles', label: '복식 3' },
  ],
  three_singles: [
    { type: 'singles', label: '단식 1' },
    { type: 'singles', label: '단식 2' },
    { type: 'singles', label: '단식 3' },
  ],
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export default function ScoresPage() {
  const { id } = useParams<{ id: string }>()
  const [divisions, setDivisions] = useState<Division[]>([])
  const [selectedDivId, setSelectedDivId] = useState('')
  const [phases, setPhases] = useState<TournamentPhase[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [score1, setScore1] = useState(0)
  const [score2, setScore2] = useState(0)
  // sets: 개인전 = 세트별 점수, 단체전 = 개인경기별 승패 (score1=1/score2=0)
  const [sets, setSets] = useState<{ score1: number; score2: number }[]>([])
  const [matchSetsMap, setMatchSetsMap] = useState<Record<string, MatchSet[]>>({})
  const [showPlayers, setShowPlayers] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editPlayerName, setEditPlayerName] = useState('')
  const [editPlayerClub, setEditPlayerClub] = useState('')
  const [selectedPhaseType, setSelectedPhaseType] = useState<'preliminary' | 'main'>('preliminary')
  const [tieBreaks, setTieBreaks] = useState<Record<string, string[]>>({})
  const [showMatrix, setShowMatrix] = useState<Record<string, boolean>>({})
  const supabase = createClient()

  useEffect(() => {
    supabase.from('divisions').select('*').eq('tournament_id', id).order('display_order')
      .then(({ data }) => { setDivisions(data ?? []); if (data?.[0]) setSelectedDivId(data[0].id) })
  }, [id])

  const selectedDiv = divisions.find(d => d.id === selectedDivId)
  const isTeamDiv = selectedDiv?.match_type === 'team'

  async function loadData(divId: string) {
    const div = divisions.find(d => d.id === divId)
    const isTeam = div?.match_type === 'team'

    const { data: ph } = await supabase
      .from('tournament_phases').select('*').eq('division_id', divId).order('phase_order')
    setPhases(ph ?? [])

    if (isTeam) {
      const { data: t } = await supabase.from('teams').select('*').eq('division_id', divId)
      setTeams(t ?? [])
      setPlayers([])
    } else {
      const { data: pl } = await supabase.from('players').select('*').eq('division_id', divId)
      setPlayers(pl ?? [])
      setTeams([])
    }

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
      const round2 = allMatches
        .filter(x => x.phase_id === mainPhase.id && x.round === 2)
        .sort((a, b) => a.match_number - b.match_number)

      // Direct bracket byes (status='bye' set at draw time)
      const byeMatches = allMatches.filter(x =>
        x.phase_id === mainPhase.id && x.status === 'bye' && x.winner_id && x.round === 1
      )
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

      // Preliminary-path byes: round 1 matches with exactly one participant
      // (occurs when totalAdvancing is not a power of 2 — the last slot is unpaired)
      const singleSlotMatches = allMatches.filter(x =>
        x.phase_id === mainPhase.id &&
        x.round === 1 &&
        x.status === 'pending' &&
        !x.winner_id &&
        ((x.participant1_id && !x.participant2_id) || (!x.participant1_id && x.participant2_id))
      )
      for (const match of singleSlotMatches) {
        const participantId = match.participant1_id ?? match.participant2_id
        if (!participantId) continue
        await supabase.from('matches').update({ status: 'bye', winner_id: participantId }).eq('id', match.id)
        match.status = 'bye'
        match.winner_id = participantId
        const slot = Math.floor((match.match_number - 1) / 2)
        const next = round2[slot]
        if (!next) continue
        const isP1Slot = match.match_number % 2 === 1
        if (isP1Slot && !next.participant1_id) {
          await supabase.from('matches').update({ participant1_id: participantId }).eq('id', next.id)
          next.participant1_id = participantId
        } else if (!isP1Slot && !next.participant2_id) {
          await supabase.from('matches').update({ participant2_id: participantId }).eq('id', next.id)
          next.participant2_id = participantId
        }
      }
    }
    setMatches(allMatches)

    if (allMatches.length > 0) {
      const { data: ms } = await supabase
        .from('match_sets').select('*').in('match_id', allMatches.map(x => x.id)).order('set_number')
      const setsMap: Record<string, MatchSet[]> = {}
      for (const s of ms ?? []) {
        if (!setsMap[s.match_id]) setsMap[s.match_id] = []
        setsMap[s.match_id].push(s)
      }
      setMatchSetsMap(setsMap)
    }
  }

  useEffect(() => { if (selectedDivId && divisions.length > 0) loadData(selectedDivId) }, [selectedDivId, divisions])

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
          next[group.id] = prev[group.id] ?? standings.map(s => s.participant_id)
        }
      }
      return next
    })
  }, [matches, groups, phases])

  const pMap = new Map(players.map(p => [p.id, p]))
  const tMap = new Map(teams.map(t => [t.id, t]))

  // ─── 편집 시작 ──────────────────────────────────────────────────────────────

  function startEditing(match: Match) {
    const div = divisions.find(d => d.id === selectedDivId)
    const existing = matchSetsMap[match.id] ?? []

    if (div?.match_type === 'team') {
      const fmt = div.team_match_format
      const gameList = fmt ? TEAM_MATCH_GAMES[fmt] : []
      const initSets = gameList.map((_, i) => {
        const s = existing.find(e => e.set_number === i + 1)
        return s ? { score1: s.score1, score2: s.score2 } : { score1: 0, score2: 0 }
      })
      setSets(initSets)
      setScore1(initSets.filter(s => s.score1 > s.score2).length)
      setScore2(initSets.filter(s => s.score2 > s.score1).length)
    } else {
      const phase = phases.find(p => p.id === match.phase_id)
      const gamesPerMatch = phase?.games_per_match ?? 3
      const initSets = Array.from({ length: gamesPerMatch }, (_, i) => {
        const s = existing.find(e => e.set_number === i + 1)
        return s ? { score1: s.score1, score2: s.score2 } : { score1: 0, score2: 0 }
      })
      setSets(initSets)
      setScore1(initSets.filter(s => s.score1 > s.score2).length)
      setScore2(initSets.filter(s => s.score2 > s.score1).length)
    }
    setEditing(match.id)
  }

  // ─── 점수 업데이트 헬퍼 ─────────────────────────────────────────────────────

  function updateSet(idx: number, field: 'score1' | 'score2', value: number) {
    setSets(prev => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: Math.max(0, value) }
      setScore1(next.filter(s => s.score1 > s.score2).length)
      setScore2(next.filter(s => s.score2 > s.score1).length)
      return next
    })
  }

  // 단체전: 개인경기 결과 토글 (1=팀1승, 2=팀2승, 0=미정)
  function toggleGameResult(idx: number, winner: 1 | 2) {
    setSets(prev => {
      const next = [...prev]
      const cur = next[idx]
      const alreadySet = winner === 1 ? cur.score1 > cur.score2 : cur.score2 > cur.score1
      next[idx] = alreadySet ? { score1: 0, score2: 0 } : winner === 1 ? { score1: 1, score2: 0 } : { score1: 0, score2: 1 }
      setScore1(next.filter(s => s.score1 > s.score2).length)
      setScore2(next.filter(s => s.score2 > s.score1).length)
      return next
    })
  }

  // ─── 저장 ───────────────────────────────────────────────────────────────────

  async function saveScore(match: Match) {
    const div = divisions.find(d => d.id === selectedDivId)
    const isTeam = div?.match_type === 'team'

    let finalScore1: number
    let finalScore2: number
    let winner_id: string | undefined

    if (isTeam) {
      const fmt = div?.team_match_format
      const totalGames = fmt ? TEAM_FORMAT_GAMES[fmt] : 3
      const needed = Math.ceil(totalGames / 2)
      finalScore1 = sets.filter(s => s.score1 > s.score2).length
      finalScore2 = sets.filter(s => s.score2 > s.score1).length
      winner_id = finalScore1 >= needed ? match.participant1_id
        : finalScore2 >= needed ? match.participant2_id
        : undefined
    } else {
      const gamesPerMatch = phases.find(p => p.id === match.phase_id)?.games_per_match ?? 3
      const needed = Math.ceil(gamesPerMatch / 2)
      finalScore1 = score1
      finalScore2 = score2
      winner_id = score1 >= needed ? match.participant1_id
        : score2 >= needed ? match.participant2_id
        : undefined
    }

    const validSets = sets
      .map((s, i) => ({ match_id: match.id, set_number: i + 1, score1: s.score1, score2: s.score2 }))
      .filter(s => s.score1 > 0 || s.score2 > 0)

    await supabase.from('match_sets').delete().eq('match_id', match.id)
    if (validSets.length > 0) {
      await supabase.from('match_sets').insert(validSets)
    }

    await supabase.from('matches').update({
      score1: finalScore1, score2: finalScore2,
      winner_id: winner_id ?? null, status: 'completed', ended_at: new Date().toISOString(),
    }).eq('id', match.id)

    toast.success('결과가 저장되었습니다')
    setEditing(null)

    const phase = phases.find(p => p.id === match.phase_id)
    if (winner_id && phase?.phase_type === 'main') {
      const nextRoundMatches = matches
        .filter(m => m.phase_id === match.phase_id && m.round === match.round + 1)
        .sort((a, b) => a.match_number - b.match_number)
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
      await checkPrelimAdvancement(match.group_id, phase, winner_id, finalScore1, finalScore2)
    }

    await loadData(selectedDivId)
  }

  async function checkPrelimAdvancement(
    groupId: string, phase: TournamentPhase,
    winnerId: string | undefined, s1: number, s2: number
  ) {
    const groupMatches = matches.filter(m => m.group_id === groupId)
    const updatedMatches = groupMatches.map(m => m.id === editing
      ? { ...m, score1: s1, score2: s2, status: 'completed' as const, winner_id: winnerId ?? undefined }
      : m)
    if (!updatedMatches.every(m => m.status === 'completed')) return

    const participantIds = [...new Set([
      ...updatedMatches.map(m => m.participant1_id),
      ...updatedMatches.map(m => m.participant2_id),
    ].filter(Boolean))] as string[]

    const standings = calculateStandings(updatedMatches, participantIds)
    const advanceCount = phase.advancement_count ?? 2
    if (hasTieAtBoundary(standings, advanceCount)) return
    await advanceGroup(groupId, phase, standings.map(s => s.participant_id))
  }

  async function advanceGroup(groupId: string, phase: TournamentPhase, orderedIds: string[]) {
    const advanceCount = phase.advancement_count ?? 2
    const advancers = orderedIds.slice(0, advanceCount)
    const mainPhase = phases.find(p => p.phase_type === 'main')
    if (!mainPhase || advancers.length === 0) return

    const mainMatches = matches
      .filter(m => m.phase_id === mainPhase.id && m.round === 1)
      .sort((a, b) => a.match_number - b.match_number)
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

    const upserts = orderedIds.map((pid, idx) => {
      const s = statsMap.get(pid) ?? { wins: 0, losses: 0, sets_won: 0, sets_lost: 0, points_won: 0, points_lost: 0 }
      return { group_id: groupId, participant_id: pid, ranking: idx + 1, ...s }
    })
    const { error } = await supabase.from('standings').upsert(upserts, { onConflict: 'group_id,participant_id' })
    if (error) { toast.error('순위 저장 실패: ' + error.message); return }

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
      .eq('id', editingPlayerId).select().single()
    if (error) { toast.error('수정 실패: ' + error.message); return }
    setPlayers(prev => prev.map(p => p.id === editingPlayerId ? data : p))
    setEditingPlayerId(null)
    toast.success('선수 이름이 수정되었습니다')
  }

  // ─── 렌더링 ─────────────────────────────────────────────────────────────────

  function renderMatch(m: Match) {
    const div = divisions.find(d => d.id === selectedDivId)
    if (div?.match_type === 'team') return renderTeamMatch(m, div)
    return renderIndividualMatch(m)
  }

  function renderIndividualMatch(m: Match) {
    const p1 = m.participant1_id ? pMap.get(m.participant1_id) : null
    const p2 = m.participant2_id ? pMap.get(m.participant2_id) : null
    const phase = phases.find(p => p.id === m.phase_id)
    const gamesPerMatch = phase?.games_per_match ?? 3
    const isEditing = editing === m.id
    const mSets = matchSetsMap[m.id] ?? []

    if (m.status === 'completed' && !isEditing) {
      return (
        <div key={m.id} className="px-4 py-3 rounded-xl bg-white/5 text-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className={m.winner_id === m.participant1_id ? 'font-bold text-primary' : 'text-muted-foreground'}>
              {p1?.name ?? 'TBD'}
            </span>
            <div className="flex items-center gap-2 mx-4">
              <span className="font-bold tabular-nums">{m.score1} : {m.score2}</span>
              <button onClick={() => startEditing(m)} className="p-1 text-muted-foreground hover:text-primary transition-colors">
                <Pencil className="w-3 h-3" />
              </button>
            </div>
            <span className={m.winner_id === m.participant2_id ? 'font-bold text-primary' : 'text-muted-foreground'}>
              {p2?.name ?? 'TBD'}
            </span>
          </div>
          {mSets.length > 0 && (
            <div className="text-center text-xs text-muted-foreground">
              {mSets.map(s => `${s.score1}-${s.score2}`).join(', ')}
            </div>
          )}
        </div>
      )
    }

    return (
      <div key={m.id} className="glass rounded-xl border border-white/10 p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 text-right">
            <div className="font-bold truncate">{p1?.name ?? 'TBD'}</div>
            {p1?.club && <div className="text-xs text-muted-foreground">{p1.club}</div>}
          </div>
          <div className="text-muted-foreground font-bold text-lg shrink-0">vs</div>
          <div className="flex-1">
            <div className="font-bold truncate">{p2?.name ?? 'TBD'}</div>
            {p2?.club && <div className="text-xs text-muted-foreground">{p2.club}</div>}
          </div>
        </div>

        {isEditing ? (
          <>
            <div className="space-y-2 mb-4">
              {sets.map((s, idx) => {
                const setDone = s.score1 > 0 || s.score2 > 0
                const p1Wins = s.score1 > s.score2
                const p2Wins = s.score2 > s.score1
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-10 text-right shrink-0">{idx + 1}세트</span>
                    <input type="number" min={0} value={s.score1}
                      onChange={e => updateSet(idx, 'score1', Number(e.target.value))}
                      className={cn(
                        'w-14 text-center glass border rounded-lg py-1.5 text-sm font-bold bg-transparent outline-none transition-colors',
                        setDone && p1Wins ? 'border-primary text-primary' : 'border-white/10 focus:border-primary'
                      )} />
                    <span className="text-muted-foreground text-sm shrink-0">:</span>
                    <input type="number" min={0} value={s.score2}
                      onChange={e => updateSet(idx, 'score2', Number(e.target.value))}
                      className={cn(
                        'w-14 text-center glass border rounded-lg py-1.5 text-sm font-bold bg-transparent outline-none transition-colors',
                        setDone && p2Wins ? 'border-primary text-primary' : 'border-white/10 focus:border-primary'
                      )} />
                  </div>
                )
              })}
              <div className="flex items-center gap-2 pt-1 pl-12 text-xs text-muted-foreground">
                <span>세트 합계:</span>
                <span className={score1 >= Math.ceil(gamesPerMatch / 2) ? 'text-primary font-bold' : ''}>{score1}</span>
                <span>:</span>
                <span className={score2 >= Math.ceil(gamesPerMatch / 2) ? 'text-primary font-bold' : ''}>{score2}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)}
                className="px-4 py-1.5 text-sm glass border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                취소
              </button>
              <button onClick={() => saveScore(m)}
                className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors">
                저장
              </button>
            </div>
          </>
        ) : (
          <div className="flex justify-center">
            <button onClick={() => startEditing(m)}
              className="px-4 py-1.5 text-sm glass border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
              결과 입력
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderTeamMatch(m: Match, div: Division) {
    const t1 = m.participant1_id ? tMap.get(m.participant1_id) : null
    const t2 = m.participant2_id ? tMap.get(m.participant2_id) : null
    const fmt = div.team_match_format
    const gameList = fmt ? TEAM_MATCH_GAMES[fmt] : []
    const totalGames = fmt ? TEAM_FORMAT_GAMES[fmt] : 3
    const needed = Math.ceil(totalGames / 2)
    const isEditing = editing === m.id
    const mSets = matchSetsMap[m.id] ?? []

    if (m.status === 'completed' && !isEditing) {
      return (
        <div key={m.id} className="px-4 py-3 rounded-xl bg-white/5 text-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <span className={m.winner_id === m.participant1_id ? 'font-bold text-primary' : 'text-muted-foreground'}>
              {t1?.name ?? 'TBD'}
            </span>
            <div className="flex items-center gap-2 mx-4">
              <span className="font-bold tabular-nums">{m.score1} : {m.score2}</span>
              <button onClick={() => startEditing(m)} className="p-1 text-muted-foreground hover:text-primary transition-colors">
                <Pencil className="w-3 h-3" />
              </button>
            </div>
            <span className={m.winner_id === m.participant2_id ? 'font-bold text-primary' : 'text-muted-foreground'}>
              {t2?.name ?? 'TBD'}
            </span>
          </div>
          {mSets.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1.5 text-xs text-muted-foreground">
              {gameList.slice(0, mSets.length).map((game, idx) => {
                const s = mSets.find(ms => ms.set_number === idx + 1)
                if (!s) return null
                const t1Won = s.score1 > s.score2
                return (
                  <span key={idx} className={cn(
                    'px-1.5 py-0.5 rounded bg-white/5',
                    t1Won ? 'text-primary' : 'text-accent'
                  )}>
                    {game.label}: {t1Won ? (t1?.name ?? '팀1') : (t2?.name ?? '팀2')}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    // 편집 중: 현재 세트 승수 계산 (편집 상태)
    const curS1 = isEditing ? sets.filter(s => s.score1 > s.score2).length : m.score1
    const curS2 = isEditing ? sets.filter(s => s.score2 > s.score1).length : m.score2
    const t1Done = curS1 >= needed
    const t2Done = curS2 >= needed

    return (
      <div key={m.id} className="glass rounded-xl border border-white/10 p-4">
        {/* 팀 헤더 */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 text-right">
            <div className="font-bold truncate">{t1?.name ?? 'TBD'}</div>
            {t1?.club && <div className="text-xs text-muted-foreground">{t1.club}</div>}
          </div>
          <div className="shrink-0 text-center">
            {isEditing ? (
              <span className="text-lg font-bold tabular-nums">
                <span className={t1Done ? 'text-primary' : ''}>{curS1}</span>
                <span className="text-muted-foreground mx-1">:</span>
                <span className={t2Done ? 'text-primary' : ''}>{curS2}</span>
              </span>
            ) : (
              <span className="text-muted-foreground font-bold text-lg">vs</span>
            )}
          </div>
          <div className="flex-1">
            <div className="font-bold truncate">{t2?.name ?? 'TBD'}</div>
            {t2?.club && <div className="text-xs text-muted-foreground">{t2.club}</div>}
          </div>
        </div>

        {/* 개인 경기별 입력 */}
        {isEditing ? (
          <>
            <div className="space-y-1.5 mb-4">
              {gameList.map((game, idx) => {
                const s = sets[idx] ?? { score1: 0, score2: 0 }
                const t1Won = s.score1 > s.score2
                const t2Won = s.score2 > s.score1
                // 이미 승패가 결정된 후 경기는 시각적으로 구분
                const gamesDone = sets.slice(0, idx).filter(x => x.score1 > 0 || x.score2 > 0)
                const s1so = gamesDone.filter(x => x.score1 > x.score2).length
                const s2so = gamesDone.filter(x => x.score2 > x.score1).length
                const alreadyDecided = s1so >= needed || s2so >= needed

                return (
                  <div key={idx} className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg',
                    alreadyDecided ? 'opacity-40' : 'bg-white/5'
                  )}>
                    <div className="flex items-center gap-1 w-16 shrink-0">
                      <span className={cn('text-xs font-medium', game.type === 'doubles' ? 'text-accent' : 'text-muted-foreground')}>
                        {game.type === 'doubles' ? '복' : '단'}
                      </span>
                      <span className="text-xs text-muted-foreground">{game.label}</span>
                    </div>
                    <div className="flex-1 flex gap-2">
                      <button
                        disabled={alreadyDecided}
                        onClick={() => toggleGameResult(idx, 1)}
                        className={cn(
                          'flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                          t1Won
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'glass border-white/10 text-muted-foreground hover:bg-white/10 disabled:opacity-50'
                        )}
                      >
                        {t1?.name ?? '팀1'}
                      </button>
                      <button
                        disabled={alreadyDecided}
                        onClick={() => toggleGameResult(idx, 2)}
                        className={cn(
                          'flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors',
                          t2Won
                            ? 'bg-accent text-white border-accent'
                            : 'glass border-white/10 text-muted-foreground hover:bg-white/10 disabled:opacity-50'
                        )}
                      >
                        {t2?.name ?? '팀2'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="text-center text-xs text-muted-foreground mb-3">
              {needed}승 선취 시 팀 승리 ({totalGames}전 {needed}선승)
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditing(null)}
                className="px-4 py-1.5 text-sm glass border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                취소
              </button>
              <button onClick={() => saveScore(m)}
                className="px-4 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors">
                저장
              </button>
            </div>
          </>
        ) : (
          <div className="flex justify-center">
            <button onClick={() => startEditing(m)}
              className="px-4 py-1.5 text-sm glass border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
              결과 입력
            </button>
          </div>
        )}
      </div>
    )
  }

  // ─── 레이아웃 계산 ───────────────────────────────────────────────────────────

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
            {div.match_type === 'team' && <span className="ml-1.5 text-xs opacity-70">단체</span>}
          </button>
        ))}
      </div>

      {/* 개인전 선수 이름 수정 (단체전에서는 숨김) */}
      {!isTeamDiv && players.length > 0 && (
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

      {/* Preliminary */}
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

              const groupIds = [...new Set([
                ...groupMatches.map(m => m.participant1_id),
                ...groupMatches.map(m => m.participant2_id),
              ].filter(Boolean))] as string[]
              const groupStandings = calculateStandings(groupMatches, groupIds)
              const tieGroups = getTieGroups(groupStandings)
              const tiedIndices = new Set(tieGroups.flat())
              const advanceCount = currentPhase.advancement_count ?? 2

              const getName = (pid: string) => isTeamDiv
                ? (tMap.get(pid)?.name ?? '?')
                : (pMap.get(pid)?.name ?? '?')
              const getClub = (pid: string) => isTeamDiv
                ? tMap.get(pid)?.club
                : pMap.get(pid)?.club

              const rankedParticipants = groupStandings.map(s => ({
                id: s.participant_id,
                name: getName(s.participant_id),
                club: getClub(s.participant_id),
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
                          const isAdvancing = idx < advanceCount
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
                            <div key={pid} className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg',
                              isAdvancing ? 'bg-primary/10 border border-primary/20' : 'bg-white/5',
                              isTied && 'border-l-2 border-l-orange-400/60'
                            )}>
                              <span className="w-5 text-center text-sm font-bold text-muted-foreground shrink-0">{idx + 1}</span>
                              <span className="flex-1 text-sm font-medium">{getName(pid)}</span>
                              {getClub(pid) && (
                                <span className="text-xs text-muted-foreground hidden sm:block">{getClub(pid)}</span>
                              )}
                              {isAdvancing && <span className="text-xs text-primary shrink-0">본선↑</span>}
                              {isTied && (
                                <div className="flex gap-0.5 shrink-0">
                                  <button disabled={!canUp} onClick={() => moveInTie(group.id, idx, -1)}
                                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors">
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button disabled={!canDown} onClick={() => moveInTie(group.id, idx, 1)}
                                    className="p-1 rounded hover:bg-white/10 disabled:opacity-30 transition-colors">
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                      <button onClick={() => confirmRanking(group.id)}
                        className="w-full py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
                        순위 확정 및 본선 진출 처리
                      </button>
                    </div>
                  )}

                  {!isTeamDiv && completed.length > 0 && (
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

      {/* Main */}
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
