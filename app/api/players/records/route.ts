import { createClientSafe } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids')
  if (!idsParam) return NextResponse.json({ error: 'ids 필요' }, { status: 400 })

  const playerIds = idsParam.split(',').filter(id => /^[0-9a-f-]{36}$/.test(id))
  if (playerIds.length === 0) return NextResponse.json({ error: '유효한 ID 없음' }, { status: 400 })

  const supabase = await createClientSafe()
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  // Fetch player info
  const { data: players } = await supabase
    .from('players')
    .select('id, name, club')
    .in('id', playerIds)
    .limit(1)

  if (!players || players.length === 0) {
    return NextResponse.json({ error: '선수를 찾을 수 없습니다' }, { status: 404 })
  }

  const playerIdSet = new Set(playerIds)
  const playerInfo = { name: players[0].name, club: players[0].club ?? undefined }

  // Fetch all completed individual matches for these player IDs
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

  // Collect opponent IDs
  const opponentIds = [
    ...new Set(
      (matches ?? [])
        .map(m => (playerIdSet.has(m.participant1_id ?? '') ? m.participant2_id : m.participant1_id))
        .filter((id): id is string => !!id)
    ),
  ]

  // Fetch opponent names in batch
  const opponentMap = new Map<string, { id: string; name: string; club?: string }>()
  if (opponentIds.length > 0) {
    const { data: opponents } = await supabase
      .from('players')
      .select('id, name, club')
      .in('id', opponentIds)
    for (const o of opponents ?? []) opponentMap.set(o.id, o)
  }

  // Build structured match records
  const matchRecords = (matches ?? []).map(m => {
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

    return {
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
    }
  })

  // Sort by tournament date descending
  matchRecords.sort((a, b) => {
    if (!a.tournament_start) return 1
    if (!b.tournament_start) return -1
    return new Date(b.tournament_start).getTime() - new Date(a.tournament_start).getTime()
  })

  // Aggregate H2H by opponent (name + club)
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
