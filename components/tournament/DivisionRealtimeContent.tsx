'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import StandingsTable from '@/components/tournament/StandingsTable'
import BracketView from '@/components/tournament/BracketView'
import GroupMatrix from '@/components/tournament/GroupMatrix'
import MatchSchedule from '@/components/tournament/MatchSchedule'
import { createClient } from '@/lib/supabase/client'
import { calculateStandings } from '@/lib/utils/standings'
import { cn } from '@/lib/utils'
import type { Group, Match, MatchSet, Player, Standing, Team, TournamentPhase } from '@/lib/types'

interface Props {
  divId: string
  prelim?: TournamentPhase | null
  main?: TournamentPhase | null
  initialPrelimMatches: Match[]
  initialMainMatches: Match[]
  groups: Group[]
  initialStandings: Standing[]
  participants: (Player | Team)[]
  isIndividual: boolean
}

const PHASE_FORMAT_LABEL: Record<string, string> = {
  round_robin: '리그',
  single_elimination: '토너먼트',
  double_elimination: '더블 토너먼트',
  group_knockout: '조별 토너먼트',
}

export default function DivisionRealtimeContent({
  divId,
  prelim,
  main,
  initialPrelimMatches,
  initialMainMatches,
  groups,
  initialStandings,
  participants,
  isIndividual,
}: Props) {
  const [prelimMatches, setPrelimMatches] = useState<Match[]>(initialPrelimMatches)
  const [mainMatches, setMainMatches] = useState<Match[]>(initialMainMatches)
  const [standings, setStandings] = useState<Standing[]>(initialStandings)
  const [connected, setConnected] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasPrelim = groups.length > 0
  const hasMain = mainMatches.length > 0

  const [activeTab, setActiveTab] = useState<'prelim' | 'main'>(
    hasPrelim ? 'prelim' : 'main'
  )

  const pMap = new Map(participants.map(p => [p.id, p]))
  const getName = (pid?: string) => pid ? (pMap.get(pid) as Player | Team | undefined)?.name : undefined
  const getClub = (pid?: string) => pid ? (pMap.get(pid) as Player | Team | undefined)?.club : undefined

  useEffect(() => {
    const supabase = createClient()
    const prelimId = prelim?.id
    const mainId = main?.id
    const gids = groups.map(g => g.id)

    const refetch = async () => {
      const [{ data: pm }, { data: mm }, { data: ss }] = await Promise.all([
        prelimId
          ? supabase.from('matches').select('*, sets:match_sets(*)').eq('phase_id', prelimId)
          : Promise.resolve({ data: [] as Match[] }),
        mainId
          ? supabase.from('matches').select('*, sets:match_sets(*)').eq('phase_id', mainId).order('round').order('match_number')
          : Promise.resolve({ data: [] as Match[] }),
        gids.length > 0
          ? supabase.from('standings').select('*').in('group_id', gids)
          : Promise.resolve({ data: [] as Standing[] }),
      ])
      if (pm) setPrelimMatches(pm)
      if (mm) setMainMatches(mm)
      if (ss) setStandings(ss)
    }

    const onEvent = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(refetch, 400)
    }

    const ch = supabase.channel(`div-${divId}`)

    if (prelimId) {
      ch.on('postgres_changes', {
        event: '*', schema: 'public', table: 'matches',
        filter: `phase_id=eq.${prelimId}`,
      }, onEvent)
    }
    if (mainId) {
      ch.on('postgres_changes', {
        event: '*', schema: 'public', table: 'matches',
        filter: `phase_id=eq.${mainId}`,
      }, onEvent)
    }
    if (gids.length > 0) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'standings' }, onEvent)
    }

    ch.subscribe(status => setConnected(status === 'SUBSCRIBED'))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      supabase.removeChannel(ch)
    }
  }, [divId]) // eslint-disable-line react-hooks/exhaustive-deps

  // 예선 연결 1라운드 TBD 슬롯에 조별 예상 배정 라벨 계산 (교차 시드 방식)
  function getProjectedLabel(matchNumber: number, isP2: boolean): string | null {
    if (!prelim || groups.length === 0) return null
    const K = prelim.advancement_count ?? 2
    const sortedGroups = [...groups].sort((a, b) => a.display_order - b.display_order)
    const G = sortedGroups.length
    const offset = Math.floor(G / 2)
    const slotIndex = (matchNumber - 1) * 2 + (isP2 ? 1 : 0)

    if (slotIndex % 2 === 0) {
      const matchIdx = slotIndex / 2
      const r = Math.floor(matchIdx / G)
      const g = matchIdx % G
      const group = sortedGroups[g]
      if (!group || r >= K) return null
      return `${group.name} ${r + 1}위`
    } else {
      const matchIdx = (slotIndex - 1) / 2
      const p = Math.floor(matchIdx / G)
      const topG = matchIdx % G
      const r = K - 1 - p
      const botG = (topG + offset) % G
      const group = sortedGroups[botG]
      if (!group || r < 0 || r >= K) return null
      return `${group.name} ${r + 1}위`
    }
  }

  const hasPrelimPhase = groups.length > 0

  const annotatedMain = mainMatches.map(m => ({
    ...m,
    p1Name: getName(m.participant1_id),
    p1Club: getClub(m.participant1_id),
    p2Name: getName(m.participant2_id),
    p2Club: getClub(m.participant2_id),
    // 1라운드 TBD 슬롯에만 예상 배정 라벨 표시
    p1Label: hasPrelimPhase && m.round === 1 && !m.participant1_id
      ? (getProjectedLabel(m.match_number, false) ?? undefined)
      : undefined,
    p2Label: hasPrelimPhase && m.round === 1 && !m.participant2_id
      ? (getProjectedLabel(m.match_number, true) ?? undefined)
      : undefined,
    sets: (m.sets ?? []) as MatchSet[],
  }))

  const mainRounds = mainMatches.length > 0 ? Math.max(...mainMatches.map(m => m.round)) : 0

  if (!hasPrelim && !hasMain) return null

  const showTabs = hasPrelim && hasMain

  return (
    <div className="space-y-4">
      {/* 실시간 연결 표시 */}
      <div className="flex items-center justify-end gap-1.5">
        <span className={`w-2 h-2 rounded-full transition-colors ${connected ? 'bg-green-500 animate-pulse' : 'bg-white/20'}`} />
        <span className="text-xs text-muted-foreground">
          {connected ? '실시간' : '연결 중...'}
        </span>
      </div>

      {/* 예선/본선 탭 선택 */}
      {showTabs && (
        <div className="glass rounded-xl border border-white/10 p-1 flex gap-1">
          <button
            onClick={() => setActiveTab('prelim')}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-3 px-4 rounded-lg transition-all',
              activeTab === 'prelim'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            )}
          >
            <span className="text-sm font-bold">예선전</span>
            {prelim && (
              <span className={cn(
                'text-xs font-normal',
                activeTab === 'prelim' ? 'text-white/70' : 'text-muted-foreground/60'
              )}>
                {PHASE_FORMAT_LABEL[prelim.format] ?? prelim.format}
                {' · '}{prelim.games_per_match}게임/{prelim.points_per_game}점
                {prelim.advancement_count ? ` · 조당 ${prelim.advancement_count}팀 진출` : ''}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('main')}
            className={cn(
              'flex-1 flex flex-col items-center gap-0.5 py-3 px-4 rounded-lg transition-all',
              activeTab === 'main'
                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
            )}
          >
            <span className="text-sm font-bold">본선</span>
            {main && (
              <span className={cn(
                'text-xs font-normal',
                activeTab === 'main' ? 'text-white/70' : 'text-muted-foreground/60'
              )}>
                {PHASE_FORMAT_LABEL[main.format] ?? main.format}
                {' · '}{main.games_per_match}게임/{main.points_per_game}점
              </span>
            )}
          </button>
        </div>
      )}

      {/* 예선전 내용 */}
      {hasPrelim && (!showTabs || activeTab === 'prelim') && (
        <div className="space-y-6">
          {groups.map((group: Group) => {
            const groupMatches = prelimMatches.filter(m => m.group_id === group.id)
            if (groupMatches.length === 0) return null
            const ids = [...new Set([
              ...groupMatches.map(m => m.participant1_id),
              ...groupMatches.map(m => m.participant2_id),
            ].filter(Boolean))] as string[]

            const groupStandings = standings.filter(s => s.group_id === group.id)

            let rows: {
              ranking: number; participant_id: string; name: string; club?: string
              wins: number; losses: number; sets_won: number; sets_lost: number
              points_won: number; points_lost: number
            }[]

            if (groupStandings.length >= ids.length && ids.length > 0) {
              rows = groupStandings
                .sort((a, b) => a.ranking - b.ranking)
                .map(s => ({ ...s, name: getName(s.participant_id) ?? '?', club: getClub(s.participant_id) }))
            } else {
              rows = calculateStandings(groupMatches, ids).map(s => ({
                ...s,
                name: getName(s.participant_id) ?? '?',
                club: getClub(s.participant_id),
              }))
            }

            const orderedParticipants = rows.map(r => ({ id: r.participant_id, name: r.name, club: r.club }))

            const sortedGroupMatches = [...groupMatches].sort(
              (a, b) => a.round - b.round || a.match_number - b.match_number
            )

            return (
              <div key={group.id} className="space-y-3">
                <h3 className="font-bold">{group.name}</h3>
                <StandingsTable rows={rows} advanceCount={prelim?.advancement_count ?? 2} isTeam={!isIndividual} />
                <details className="group/schedule">
                  <summary className="flex items-center justify-between px-1 py-1 cursor-pointer list-none select-none">
                    <p className="text-xs text-muted-foreground font-medium">경기 순서</p>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 group-open/schedule:rotate-180" />
                  </summary>
                  <div className="mt-1">
                    <MatchSchedule
                      matches={sortedGroupMatches}
                      getName={getName}
                      getClub={getClub}
                      isTeam={!isIndividual}
                    />
                  </div>
                </details>
                {groupMatches.some(m => m.status === 'completed') && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium px-1">상대 전적</p>
                    <GroupMatrix
                      participants={orderedParticipants}
                      matches={groupMatches}
                      participantLabel={isIndividual ? '선수' : '팀'}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 본선 내용 */}
      {hasMain && (!showTabs || activeTab === 'main') && (
        <BracketView matches={annotatedMain} totalRounds={mainRounds} isTeam={!isIndividual} />
      )}
    </div>
  )
}
