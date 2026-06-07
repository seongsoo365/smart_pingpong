'use client'

import { useEffect, useRef, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import StandingsTable from '@/components/tournament/StandingsTable'
import BracketView from '@/components/tournament/BracketView'
import GroupMatrix from '@/components/tournament/GroupMatrix'
import { createClient } from '@/lib/supabase/client'
import { calculateStandings } from '@/lib/utils/standings'
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

  const annotatedMain = mainMatches.map(m => ({
    ...m,
    p1Name: getName(m.participant1_id),
    p1Club: getClub(m.participant1_id),
    p2Name: getName(m.participant2_id),
    p2Club: getClub(m.participant2_id),
    sets: (m.sets ?? []) as MatchSet[],
  }))

  const mainRounds = mainMatches.length > 0 ? Math.max(...mainMatches.map(m => m.round)) : 0
  const hasPrelim = groups.length > 0
  const hasMain = mainMatches.length > 0

  if (!hasPrelim && !hasMain) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1.5">
        <span className={`w-2 h-2 rounded-full transition-colors ${connected ? 'bg-green-500 animate-pulse' : 'bg-white/20'}`} />
        <span className="text-xs text-muted-foreground">
          {connected ? '실시간' : '연결 중...'}
        </span>
      </div>

      <Tabs defaultValue={hasPrelim ? 'prelim' : 'main'}>
        <TabsList className="glass border border-white/10">
          {hasPrelim && <TabsTrigger value="prelim">예선전</TabsTrigger>}
          {hasMain && <TabsTrigger value="main">본선</TabsTrigger>}
        </TabsList>

        {hasPrelim && (
          <TabsContent value="prelim" className="space-y-6 mt-4">
            {groups.map((group: Group) => {
              const groupMatches = prelimMatches.filter(m => m.group_id === group.id)
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

              return (
                <div key={group.id} className="space-y-3">
                  <h3 className="font-bold">{group.name}</h3>
                  <StandingsTable rows={rows} advanceCount={prelim?.advancement_count ?? 2} isTeam={!isIndividual} />
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
          </TabsContent>
        )}

        {hasMain && (
          <TabsContent value="main" className="mt-4">
            <BracketView matches={annotatedMain} totalRounds={mainRounds} isTeam={!isIndividual} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
