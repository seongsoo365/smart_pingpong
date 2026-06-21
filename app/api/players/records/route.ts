import { createClientSafe } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids') ?? ''
  const nameParam = req.nextUrl.searchParams.get('name')?.trim() ?? ''
  const clubParam = req.nextUrl.searchParams.get('club')?.trim() ?? ''
  const includeTournament = req.nextUrl.searchParams.get('include_tournament') !== 'false'
  const includeCasual = req.nextUrl.searchParams.get('include_casual') !== 'false'

  const playerIds = idsParam.split(',').filter(id => /^[0-9a-f-]{36}$/.test(id))
  const hasIds = playerIds.length > 0
  const hasName = !!nameParam

  if (!hasIds && !hasName) {
    return NextResponse.json({ error: 'ids 또는 name 필요' }, { status: 400 })
  }

  const supabase = await createClientSafe()
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  type MatchRecord = {
    id: string
    tournament_id: string | null
    tournament_name: string
    tournament_start: string | null
    division_name: string
    phase_type: string
    round: number
    opponent_id: string | null
    opponent_name: string
    opponent_club?: string
    my_score: number
    opp_score: number
    won: boolean
    sets: { set_number: number; my_score: number; opp_score: number }[]
  }

  const matchRecords: MatchRecord[] = []
  let playerInfo: { name: string; club?: string } | null = null

  // ── 대회 전적 ──
  if (hasIds && includeTournament) {
    const { data: players } = await supabase
      .from('players')
      .select('id, name, club')
      .in('id', playerIds)
      .limit(1)

    if (players && players.length > 0) {
      playerInfo = { name: players[0].name, club: players[0].club ?? undefined }
    }

    const playerIdSet = new Set(playerIds)
    const orFilter = `participant1_id.in.(${playerIds.join(',')}),participant2_id.in.(${playerIds.join(',')})`
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select(`
        id, round, match_number, participant1_id, participant2_id,
        score1, score2, winner_id, status, participant1_type,
        match_sets(set_number, score1, score2),
        tournament_phases(
          phase_type, format,
          divisions(name,
            tournaments(id, name, start_date)
          )
        )
      `)
      .or(orFilter)
      .eq('status', 'completed')
      .eq('participant1_type', 'player')

    if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 })

    const opponentIds = [
      ...new Set(
        (matches ?? [])
          .map(m => (playerIdSet.has(m.participant1_id ?? '') ? m.participant2_id : m.participant1_id))
          .filter((id): id is string => !!id)
      ),
    ]

    const opponentMap = new Map<string, { id: string; name: string; club?: string }>()
    if (opponentIds.length > 0) {
      const { data: opponents } = await supabase
        .from('players')
        .select('id, name, club')
        .in('id', opponentIds)
      for (const o of opponents ?? []) opponentMap.set(o.id, o)
    }

    for (const m of matches ?? []) {
      const isP1 = playerIdSet.has(m.participant1_id ?? '')
      const opponentId = isP1 ? m.participant2_id : m.participant1_id
      const opponent = opponentId ? opponentMap.get(opponentId) : null
      const myScore = (isP1 ? m.score1 : m.score2) ?? 0
      const oppScore = (isP1 ? m.score2 : m.score1) ?? 0
      const won = playerIdSet.has(m.winner_id ?? '')

      const sets = [...(m.match_sets ?? [])].sort((a, b) => a.set_number - b.set_number).map(s => ({
        set_number: s.set_number,
        my_score: isP1 ? s.score1 : s.score2,
        opp_score: isP1 ? s.score2 : s.score1,
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const phase = m.tournament_phases as unknown as {
        phase_type: string
        format: string
        divisions: { name: string; tournaments: { id: string; name: string; start_date: string } | null } | null
      } | null
      const division = phase?.divisions
      const tournament = division?.tournaments

      matchRecords.push({
        id: m.id,
        tournament_id: tournament?.id ?? null,
        tournament_name: tournament?.name ?? '(알 수 없음)',
        tournament_start: tournament?.start_date ?? null,
        division_name: division?.name ?? '(알 수 없음)',
        phase_type: phase?.phase_type ?? 'main',
        round: m.round,
        opponent_id: opponentId ?? null,
        opponent_name: opponent?.name ?? '(상대 미상)',
        opponent_club: opponent?.club ?? undefined,
        my_score: myScore,
        opp_score: oppScore,
        won,
        sets,
      })
    }
  }

  // ── 일회성 게임 전적 ──
  if (hasName && includeCasual) {
    if (!playerInfo) {
      playerInfo = { name: nameParam, club: clubParam || undefined }
    }

    const { data: casualGames, error: casualError } = await supabase
      .from('casual_games')
      .select('*')
      .or(`player1_name.eq.${nameParam},player2_name.eq.${nameParam}`)
      .order('played_at', { ascending: false })

    if (casualError) return NextResponse.json({ error: casualError.message }, { status: 500 })

    for (const g of casualGames ?? []) {
      const isP1 = g.player1_name === nameParam &&
        (clubParam ? (g.player1_club ?? '') === clubParam : true)
      const isP2 = g.player2_name === nameParam &&
        (clubParam ? (g.player2_club ?? '') === clubParam : true)

      if (!isP1 && !isP2) continue

      const myScore = isP1 ? g.score1 : g.score2
      const oppScore = isP1 ? g.score2 : g.score1
      const won = myScore > oppScore

      const rawSets: { score1: number; score2: number }[] = Array.isArray(g.sets) ? g.sets : []
      const sets = rawSets.map((s, i) => ({
        set_number: i + 1,
        my_score: isP1 ? s.score1 : s.score2,
        opp_score: isP1 ? s.score2 : s.score1,
      }))

      matchRecords.push({
        id: g.id,
        tournament_id: null,
        tournament_name: '일회성 게임',
        tournament_start: g.played_at,
        division_name: g.venue ?? '',
        phase_type: 'casual',
        round: 0,
        opponent_id: null,
        opponent_name: isP1 ? g.player2_name : g.player1_name,
        opponent_club: (isP1 ? g.player2_club : g.player1_club) ?? undefined,
        my_score: myScore,
        opp_score: oppScore,
        won,
        sets,
      })
    }
  }

  // casual 블록이 스킵됐을 때도 name 파라미터로 playerInfo 구성
  if (!playerInfo && hasName) {
    playerInfo = { name: nameParam, club: clubParam || undefined }
  }

  if (!playerInfo) {
    return NextResponse.json({ error: '선수를 찾을 수 없습니다' }, { status: 404 })
  }

  matchRecords.sort((a, b) => {
    if (!a.tournament_start) return 1
    if (!b.tournament_start) return -1
    return new Date(b.tournament_start).getTime() - new Date(a.tournament_start).getTime()
  })

  const h2hMap = new Map<string, {
    opponent_key: string
    opponent_name: string
    opponent_club?: string
    wins: number
    losses: number
    matches: typeof matchRecords
  }>()

  for (const m of matchRecords) {
    const key = `${m.opponent_name}|${m.opponent_club ?? ''}`
    if (!h2hMap.has(key)) {
      h2hMap.set(key, { opponent_key: key, opponent_name: m.opponent_name, opponent_club: m.opponent_club, wins: 0, losses: 0, matches: [] })
    }
    const entry = h2hMap.get(key)!
    if (m.won) entry.wins++
    else entry.losses++
    entry.matches.push(m)
  }

  const h2h = [...h2hMap.values()].sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))

  return NextResponse.json({
    player: playerInfo,
    total_wins: matchRecords.filter(m => m.won).length,
    total_losses: matchRecords.filter(m => !m.won).length,
    h2h,
    matches: matchRecords,
  })
}
