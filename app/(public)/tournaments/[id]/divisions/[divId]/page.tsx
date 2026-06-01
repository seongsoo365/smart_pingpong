import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { createClientSafe } from '@/lib/supabase/server'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import StandingsTable from '@/components/tournament/StandingsTable'
import BracketView from '@/components/tournament/BracketView'
import GroupMatrix from '@/components/tournament/GroupMatrix'

import { calculateStandings } from '@/lib/utils/standings'
import type { Player, Team, Match, MatchSet, Group, Standing } from '@/lib/types'

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }
const matchTypeLabel: Record<string, string> = { individual: '개인전', team: '단체전' }

export default async function DivisionDetailPage({
  params,
}: {
  params: Promise<{ id: string; divId: string }>
}) {
  const { id: tournamentId, divId } = await params
  const supabase = await createClientSafe()
  if (!supabase) notFound()

  const [{ data: division }, { data: tournament }] = await Promise.all([
    supabase.from('divisions').select('*').eq('id', divId).single(),
    supabase.from('tournaments').select('name').eq('id', tournamentId).single(),
  ])
  if (!division || !tournament) notFound()

  const { data: phases } = await supabase
    .from('tournament_phases').select('*').eq('division_id', divId).order('phase_order')

  const isIndividual = division.match_type === 'individual'

  const [{ data: players }, { data: teams }] = await Promise.all([
    isIndividual
      ? supabase.from('players').select('*').eq('division_id', divId).order('seed', { nullsFirst: false })
      : Promise.resolve({ data: [] as Player[] }),
    !isIndividual
      ? supabase.from('teams').select('*, members:team_members(*)').eq('division_id', divId)
      : Promise.resolve({ data: [] as Team[] }),
  ])

  const participants: (Player | Team)[] = isIndividual ? (players ?? []) : (teams ?? [])
  const prelim = phases?.find(p => p.phase_type === 'preliminary')
  const main = phases?.find(p => p.phase_type === 'main')

  const [{ data: groups }, { data: prelimMatches }, { data: mainMatches }] = await Promise.all([
    prelim
      ? supabase.from('groups').select('*').eq('phase_id', prelim.id).order('display_order')
      : Promise.resolve({ data: [] as Group[] }),
    prelim
      ? supabase.from('matches').select('*, sets:match_sets(*)').eq('phase_id', prelim.id)
      : Promise.resolve({ data: [] as Match[] }),
    main
      ? supabase.from('matches').select('*, sets:match_sets(*)').eq('phase_id', main.id).order('round').order('match_number')
      : Promise.resolve({ data: [] as Match[] }),
  ])

  const groupIds = (groups ?? []).map(g => g.id)
  const { data: storedStandings } = groupIds.length > 0
    ? await supabase.from('standings').select('*').in('group_id', groupIds)
    : { data: [] as Standing[] }

  const pMap = new Map(participants.map(p => [p.id, p]))
  const annotatedMain = (mainMatches ?? []).map((m: Match) => ({
    ...m,
    p1Name: m.participant1_id ? (pMap.get(m.participant1_id) as Player)?.name : undefined,
    p1Club: m.participant1_id ? (pMap.get(m.participant1_id) as Player)?.club : undefined,
    p2Name: m.participant2_id ? (pMap.get(m.participant2_id) as Player)?.name : undefined,
    p2Club: m.participant2_id ? (pMap.get(m.participant2_id) as Player)?.club : undefined,
    sets: m.sets as MatchSet[],
  }))

  const mainRounds = mainMatches && mainMatches.length > 0
    ? Math.max(...(mainMatches as Match[]).map(m => m.round))
    : 0
  const hasPrelim = (groups?.length ?? 0) > 0
  const hasMain = (mainMatches?.length ?? 0) > 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <Link href={`/tournaments/${tournamentId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="w-4 h-4" /> {tournament.name}
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold">
          {genderLabel[division.gender]} {division.name}
        </h1>
        <p className="text-muted-foreground text-sm">{matchTypeLabel[division.match_type]}</p>
      </div>

      <section className="glass rounded-2xl p-5 border border-white/10">
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
          참가자 ({participants.length}명{!isIndividual ? '/팀' : ''})
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {participants.map(p => (
            <div key={p.id} className="text-sm px-3 py-2 rounded-lg bg-white/5">
              <div className="font-medium">{(p as Player).name}</div>
              {(p as Player).club && (
                <div className="text-xs text-muted-foreground truncate">{(p as Player).club}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {(hasPrelim || hasMain) && (
        <Tabs defaultValue={hasPrelim ? 'prelim' : 'main'}>
          <TabsList className="glass border border-white/10">
            {hasPrelim && <TabsTrigger value="prelim">예선전</TabsTrigger>}
            {hasMain && <TabsTrigger value="main">본선</TabsTrigger>}
          </TabsList>

          {hasPrelim && (
            <TabsContent value="prelim" className="space-y-6 mt-4">
              {(groups ?? []).map((group: Group) => {
                const groupMatches = (prelimMatches ?? []).filter((m: Match) => m.group_id === group.id)
                const ids = [...new Set([
                  ...groupMatches.map((m: Match) => m.participant1_id),
                  ...groupMatches.map((m: Match) => m.participant2_id),
                ].filter(Boolean))] as string[]

                const groupStoredStandings = (storedStandings ?? []).filter(
                  (s: Standing) => s.group_id === group.id
                )

                let rows: { ranking: number; participant_id: string; name: string; club?: string; wins: number; losses: number; sets_won: number; sets_lost: number; points_won: number; points_lost: number }[]

                if (groupStoredStandings.length >= ids.length && ids.length > 0) {
                  rows = groupStoredStandings
                    .sort((a: Standing, b: Standing) => a.ranking - b.ranking)
                    .map((s: Standing) => ({
                      ...s,
                      name: (pMap.get(s.participant_id) as Player)?.name ?? '?',
                      club: (pMap.get(s.participant_id) as Player)?.club,
                    }))
                } else {
                  rows = calculateStandings(groupMatches as Match[], ids).map(s => ({
                    ...s,
                    name: (pMap.get(s.participant_id) as Player)?.name ?? '?',
                    club: (pMap.get(s.participant_id) as Player)?.club,
                  }))
                }

                const orderedParticipants = rows.map(r => ({
                  id: r.participant_id,
                  name: r.name,
                  club: r.club,
                }))

                return (
                  <div key={group.id} className="space-y-3">
                    <h3 className="font-bold">{group.name}</h3>
                    <StandingsTable rows={rows} advanceCount={prelim?.advancement_count ?? 2} />
                    {groupMatches.some((m: Match) => m.status === 'completed') && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium px-1">상대 전적</p>
                        <GroupMatrix
                          participants={orderedParticipants}
                          matches={groupMatches as Match[]}
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
              <BracketView matches={annotatedMain} totalRounds={mainRounds} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  )
}
