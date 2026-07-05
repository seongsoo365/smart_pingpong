import { createClientSafe } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getMatchRatingPoints } from '@/lib/utils/rating'
import type { PlayerRanking } from '@/lib/types'

type PlayerAccumulator = {
  name: string
  club: string | null
  total_points: number
  total_wins: number
  total_games: number
  casual: number
  preliminary: number
  main: number
}

function getKey(name: string, club: string | null | undefined) {
  return `${name}|${club ?? ''}`
}

function getOrCreate(acc: Map<string, PlayerAccumulator>, name: string, club: string | null | undefined): PlayerAccumulator {
  const key = getKey(name, club)
  if (!acc.has(key)) {
    acc.set(key, { name, club: club ?? null, total_points: 0, total_wins: 0, total_games: 0, casual: 0, preliminary: 0, main: 0 })
  }
  return acc.get(key)!
}

function addPoints(entry: PlayerAccumulator, points: number, phase_type: 'casual' | 'preliminary' | 'main') {
  entry.total_points += points
  if (phase_type === 'casual') entry.casual += points
  else if (phase_type === 'preliminary') entry.preliminary += points
  else entry.main += points
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''

  const supabase = await createClientSafe()
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  // 1차 병렬 쿼리: 개인전 매치, 단체전 매치, 일회성 게임
  const [
    { data: indivMatches },
    { data: teamMatches },
    { data: casualGames },
  ] = await Promise.all([
    supabase
      .from('matches')
      .select('id, phase_id, round, participant1_id, participant2_id, winner_id, tournament_phases(phase_type, format)')
      .eq('status', 'completed')
      .eq('participant1_type', 'player')
      .not('winner_id', 'is', null),
    supabase
      .from('matches')
      .select('id, phase_id, round, participant1_id, participant2_id, winner_id, tournament_phases(phase_type, format)')
      .eq('status', 'completed')
      .eq('participant1_type', 'team')
      .not('winner_id', 'is', null),
    supabase
      .from('casual_games')
      .select('player1_name, player1_club, player2_name, player2_club, score1, score2'),
  ])

  // phase별 max(round) 계산
  const phaseMaxRound = new Map<string, number>()
  for (const m of [...(indivMatches ?? []), ...(teamMatches ?? [])]) {
    const prev = phaseMaxRound.get(m.phase_id) ?? 0
    phaseMaxRound.set(m.phase_id, Math.max(prev, m.round))
  }

  // 2차 병렬 쿼리: 선수/팀 정보
  const indivPlayerIds = [
    ...new Set(
      (indivMatches ?? []).flatMap(m => [m.participant1_id, m.participant2_id]).filter((id): id is string => !!id)
    ),
  ]
  const teamIds = [
    ...new Set(
      (teamMatches ?? []).flatMap(m => [m.participant1_id, m.participant2_id]).filter((id): id is string => !!id)
    ),
  ]

  const [{ data: players }, { data: teams }] = await Promise.all([
    indivPlayerIds.length > 0
      ? supabase.from('players').select('id, name, club').in('id', indivPlayerIds)
      : Promise.resolve({ data: [] }),
    teamIds.length > 0
      ? supabase.from('teams').select('id, club, team_members(player_name)').in('id', teamIds)
      : Promise.resolve({ data: [] }),
  ])

  const playerMap = new Map<string, { name: string; club: string | null }>()
  for (const p of players ?? []) playerMap.set(p.id, { name: p.name, club: p.club ?? null })

  type TeamWithMembers = { id: string; club: string | null; team_members: { player_name: string }[] }
  const teamMap = new Map<string, TeamWithMembers>()
  for (const t of (teams ?? []) as TeamWithMembers[]) teamMap.set(t.id, t)

  // 집계
  const acc = new Map<string, PlayerAccumulator>()

  // 개인전 집계
  for (const m of indivMatches ?? []) {
    const phase = m.tournament_phases as unknown as { phase_type: string; format: string } | null
    if (!phase) continue
    const totalRounds = phaseMaxRound.get(m.phase_id) ?? m.round
    const phaseType = phase.phase_type as 'preliminary' | 'main'

    const p1 = m.participant1_id ? playerMap.get(m.participant1_id) : null
    const p2 = m.participant2_id ? playerMap.get(m.participant2_id) : null

    if (p1) {
      const entry = getOrCreate(acc, p1.name, p1.club)
      entry.total_games++
      const won = m.winner_id === m.participant1_id
      if (won) entry.total_wins++
      const pts = getMatchRatingPoints({ phase_type: phaseType, format: phase.format, round: m.round, total_rounds: totalRounds, won })
      addPoints(entry, pts, phaseType)
    }
    if (p2) {
      const entry = getOrCreate(acc, p2.name, p2.club)
      entry.total_games++
      const won = m.winner_id === m.participant2_id
      if (won) entry.total_wins++
      const pts = getMatchRatingPoints({ phase_type: phaseType, format: phase.format, round: m.round, total_rounds: totalRounds, won })
      addPoints(entry, pts, phaseType)
    }
  }

  // 단체전 집계
  for (const m of teamMatches ?? []) {
    const phase = m.tournament_phases as unknown as { phase_type: string; format: string } | null
    if (!phase) continue
    const totalRounds = phaseMaxRound.get(m.phase_id) ?? m.round
    const phaseType = phase.phase_type as 'preliminary' | 'main'

    const team1 = m.participant1_id ? teamMap.get(m.participant1_id) : null
    const team2 = m.participant2_id ? teamMap.get(m.participant2_id) : null

    for (const [team, isWinner] of [[team1, m.winner_id === m.participant1_id], [team2, m.winner_id === m.participant2_id]] as [TeamWithMembers | null, boolean][]) {
      if (!team) continue
      const won = isWinner
      const pts = getMatchRatingPoints({ phase_type: phaseType, format: phase.format, round: m.round, total_rounds: totalRounds, won })
      for (const member of team.team_members) {
        const entry = getOrCreate(acc, member.player_name, team.club)
        entry.total_games++
        if (won) entry.total_wins++
        addPoints(entry, pts, phaseType)
      }
    }
  }

  // 일회성 게임 집계
  for (const g of casualGames ?? []) {
    if (g.score1 === g.score2) continue
    const p1Won = g.score1 > g.score2

    const e1 = getOrCreate(acc, g.player1_name, g.player1_club)
    e1.total_games++
    if (p1Won) { e1.total_wins++; addPoints(e1, 10, 'casual') }

    const e2 = getOrCreate(acc, g.player2_name, g.player2_club)
    e2.total_games++
    if (!p1Won) { e2.total_wins++; addPoints(e2, 10, 'casual') }
  }

  // 정렬 및 랭킹 부여
  let sorted = [...acc.values()]
    .filter(p => p.total_games > 0)
    .sort((a, b) => b.total_points - a.total_points || b.total_wins - a.total_wins)

  if (q) {
    sorted = sorted.filter(p => p.name.includes(q) || (p.club ?? '').includes(q))
  }

  const total = sorted.length
  const rankings: PlayerRanking[] = sorted.map((p, i) => ({
    rank: i + 1,
    name: p.name,
    club: p.club,
    total_points: p.total_points,
    total_wins: p.total_wins,
    total_games: p.total_games,
    breakdown: { casual: p.casual, preliminary: p.preliminary, main: p.main },
  }))

  return NextResponse.json({ rankings, total }, {
    headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=120' },
  })
}
