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
const phaseFormatLabel: Record<string, string> = {
  round_robin: '리그',
  single_elimination: '단일 토너먼트',
  double_elimination: '더블 토너먼트',
  group_knockout: '조별 토너먼트',
}
const teamMatchFormatLabel: Record<string, string> = {
  olympic: '올림픽 공식 (3인, 5전3선)',
  traditional_4s1d: '4단 1복 (최소4인, 5전3선)',
  swaythling: '스웨이틀링 컵 (3명, 9전5선)',
  singles_2_doubles_1: '2단 1복 (2-3명, 3전2선)',
  three_doubles: '3복식 (6명, 3전2선)',
  three_singles: '3단식 (3명, 3전2선)',
}

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
  const getName = (pid?: string) => pid ? (pMap.get(pid) as Player | Team | undefined)?.name : undefined
  const getClub = (pid?: string) => pid ? (pMap.get(pid) as Player | Team | undefined)?.club : undefined

  const annotatedMain = (mainMatches ?? []).map((m: Match) => ({
    ...m,
    p1Name: getName(m.participant1_id),
    p1Club: getClub(m.participant1_id),
    p2Name: getName(m.participant2_id),
    p2Club: getClub(m.participant2_id),
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
        <p className="text-muted-foreground text-sm">
          {matchTypeLabel[division.match_type]}
          {division.match_type === 'team' && division.team_match_format && (
            <span className="ml-2 text-accent">{teamMatchFormatLabel[division.team_match_format]}</span>
          )}
        </p>
        {(phases?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {phases?.map(ph => (
              <div key={ph.id} className="flex items-center gap-1.5 text-xs px-3 py-1.5 glass rounded-lg border border-white/10">
                <span className="font-medium text-muted-foreground">
                  {ph.phase_type === 'preliminary' ? '예선' : '본선'}
                </span>
                <span className="text-white/20">|</span>
                <span>{phaseFormatLabel[ph.format] ?? ph.format}</span>
                <span className="text-white/30">·</span>
                <span>{ph.games_per_match}게임/{ph.points_per_game}점</span>
                {ph.phase_type === 'preliminary' && ph.advancement_count && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className="text-primary font-medium">조당 {ph.advancement_count}팀 진출</span>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <section className="glass rounded-2xl p-5 border border-white/10">
        <h2 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">
          {isIndividual ? `참가 선수 (${participants.length}명)` : `참가 팀 (${participants.length}팀)`}
        </h2>
        {isIndividual ? (
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
        ) : (
          <div className="space-y-2">
            {(participants as Team[]).map((team, i) => (
              <details key={team.id} className="group">
                <summary className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors list-none">
                  <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
                  <span className="font-medium flex-1">{team.name}</span>
                  {team.club && <span className="text-xs text-muted-foreground">{team.club}</span>}
                  <span className="text-xs text-muted-foreground shrink-0">{team.members?.length ?? 0}명</span>
                </summary>
                {(team.members?.length ?? 0) > 0 && (
                  <div className="px-4 pt-1 pb-2 space-y-0.5">
                    {[...(team.members ?? [])].sort((a, b) => a.player_order - b.player_order).map(m => (
                      <div key={m.id} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <span className="w-4 text-right text-xs shrink-0">{m.player_order}</span>
                        <span className="text-foreground/80">{m.player_name}</span>
                        {m.player_level && <span className="text-xs text-muted-foreground">({m.player_level}부)</span>}
                      </div>
                    ))}
                  </div>
                )}
              </details>
            ))}
          </div>
        )}
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
                      name: getName(s.participant_id) ?? '?',
                      club: getClub(s.participant_id),
                    }))
                } else {
                  rows = calculateStandings(groupMatches as Match[], ids).map(s => ({
                    ...s,
                    name: getName(s.participant_id) ?? '?',
                    club: getClub(s.participant_id),
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
                    <StandingsTable
                      rows={rows}
                      advanceCount={prelim?.advancement_count ?? 2}
                      isTeam={!isIndividual}
                    />
                    {groupMatches.some((m: Match) => m.status === 'completed') && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium px-1">상대 전적</p>
                        <GroupMatrix
                          participants={orderedParticipants}
                          matches={groupMatches as Match[]}
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
      )}
    </div>
  )
}
