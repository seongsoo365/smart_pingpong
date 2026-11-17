import { createClientSafe } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getMatchRatingPoints } from '@/lib/utils/rating'

const UUID_RE = /^[0-9a-f-]{36}$/

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids') ?? ''
  const teamIdsParam = req.nextUrl.searchParams.get('team_ids') ?? ''
  const nameParam = req.nextUrl.searchParams.get('name')?.trim() ?? ''
  const clubParam = req.nextUrl.searchParams.get('club')?.trim() ?? ''
  const includeTournament = req.nextUrl.searchParams.get('include_tournament') !== 'false'
  const includeCasual = req.nextUrl.searchParams.get('include_casual') !== 'false'
  const casualGameIdsParam = req.nextUrl.searchParams.get('casual_game_ids')
  const hasCasualGameFilter = casualGameIdsParam !== null
  const casualGameIds: string[] = casualGameIdsParam
    ? casualGameIdsParam.split(',').filter((id: string) => UUID_RE.test(id))
    : []

  const playerIds: string[] = idsParam.split(',').filter((id: string) => UUID_RE.test(id))
  const teamIds: string[] = teamIdsParam.split(',').filter((id: string) => UUID_RE.test(id))
  const hasIds = playerIds.length > 0
  const hasTeamIds = teamIds.length > 0
  const hasName = !!nameParam

  if (!hasIds && !hasTeamIds && !hasName) {
    return NextResponse.json({ error: 'ids, team_ids 또는 name 필요' }, { status: 400 })
  }

  const supabase = await createClientSafe()
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  type MatchRecord = {
    id: string
    phase_id: string | null
    tournament_id: string | null
    tournament_name: string
    tournament_start: string | null
    division_name: string
    phase_type: string
    format: string
    round: number
    total_rounds: number
    opponent_id: string | null
    opponent_name: string
    opponent_club?: string
    opponent_members?: string[]
    my_score: number
    opp_score: number
    won: boolean
    points_earned: number
    sets: { set_number: number; my_score: number; opp_score: number }[]
  }

  const matchRecords: MatchRecord[] = []
  let playerInfo: { name: string; club?: string } | null = null

  // ── 대회 전적 (개인전 + 단체전 통합) ──
  if ((hasIds || hasTeamIds) && includeTournament) {
    // 본인 정보 (이름/클럽) — 개인전 우선, 없으면 name 파라미터
    if (hasIds) {
      const { data: players } = await supabase
        .from('players')
        .select('id, name, club')
        .in('id', playerIds)
        .limit(1)
      if (players && players.length > 0) {
        playerInfo = { name: players[0].name, club: players[0].club ?? undefined }
      }
    }
    if (!playerInfo && hasName) {
      playerInfo = { name: nameParam, club: clubParam || undefined }
    }

    const orParts: string[] = []
    if (hasIds) orParts.push(`participant1_id.in.(${playerIds.join(',')}),participant2_id.in.(${playerIds.join(',')})`)
    if (hasTeamIds) orParts.push(`participant1_id.in.(${teamIds.join(',')}),participant2_id.in.(${teamIds.join(',')})`)
    const orFilter = orParts.join(',')

    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select(`
        id, phase_id, round, match_number, participant1_id, participant2_id,
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

    if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 })
    if (!matches || matches.length === 0) {
      // 대회 전적이 없으면 개인전/단체전 관련 로직 없이 넘어감
    } else {
      // phase별 max(round) 계산
      const phaseMaxRound = new Map<string, number>()
      for (const m of matches) {
        if (!m.phase_id) continue
        const prev = phaseMaxRound.get(m.phase_id) ?? 0
        phaseMaxRound.set(m.phase_id, Math.max(prev, m.round))
      }

      // 개인전 참가자 ID 모음 (participant1_type='player')
      const indivIds = new Set<string>()
      // 단체전 참가자 ID 모음 (participant1_type='team')
      const teamSideIds = new Set<string>()
      for (const m of matches) {
        const type = m.participant1_type as 'player' | 'team'
        if (type === 'player') {
          if (m.participant1_id) indivIds.add(m.participant1_id)
          if (m.participant2_id) indivIds.add(m.participant2_id)
        } else {
          if (m.participant1_id) teamSideIds.add(m.participant1_id)
          if (m.participant2_id) teamSideIds.add(m.participant2_id)
        }
      }

      const [
        { data: players },
        { data: teams },
      ] = await Promise.all([
        indivIds.size > 0
          ? supabase.from('players').select('id, name, club').in('id', [...indivIds])
          : Promise.resolve({ data: [] }),
        teamSideIds.size > 0
          ? supabase.from('teams').select('id, name, club, team_members(player_name, player_order)').in('id', [...teamSideIds])
          : Promise.resolve({ data: [] }),
      ])

      const playerMap = new Map<string, { id: string; name: string; club?: string }>()
      for (const p of players ?? []) playerMap.set(p.id, p)

      type TeamInfo = { id: string; name: string; club?: string; members: string[] }
      const teamMap = new Map<string, TeamInfo>()
      for (const t of teams ?? []) {
        const members = ((t.team_members as unknown as { player_name: string; player_order: number }[]) ?? [])
          .sort((a, b) => a.player_order - b.player_order)
          .map(m => m.player_name)
        teamMap.set(t.id, { id: t.id, name: t.name, club: t.club ?? undefined, members })
      }

      // "내 팀" ID: teamIds 중 teamMap에 있는 것
      const myTeamIdSet = new Set(teamIds.filter((id: string) => teamMap.has(id)))
      const myPlayerIdSet = new Set(playerIds)
      const myName = playerInfo?.name ?? nameParam

      for (const m of matches) {
        const type = m.participant1_type as 'player' | 'team'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const phase = m.tournament_phases as unknown as {
          phase_type: string
          format: string
          divisions: { name: string; tournaments: { id: string; name: string; start_date: string } | null } | null
        } | null
        const division = phase?.divisions
        const tournament = division?.tournaments
        const phaseType = (phase?.phase_type ?? 'main') as 'preliminary' | 'main'
        const totalRounds = m.phase_id ? (phaseMaxRound.get(m.phase_id) ?? m.round) : m.round

        let myScore = 0
        let oppScore = 0
        let won = false
        let opponentName = '(상대 미상)'
        let opponentClub: string | undefined
        let opponentMembers: string[] | undefined
        let opponentId: string | null = null

        if (type === 'player') {
          const p1 = m.participant1_id ? playerMap.get(m.participant1_id) : null
          const p2 = m.participant2_id ? playerMap.get(m.participant2_id) : null
          const isP1 = p1 ? myPlayerIdSet.has(p1.id) : false
          const isP2 = p2 ? myPlayerIdSet.has(p2.id) : false
          if (!isP1 && !isP2) continue
          const my = isP1 ? p1 : p2
          const opp = isP1 ? p2 : p1
          if (!my) continue
          myScore = isP1 ? (m.score1 ?? 0) : (m.score2 ?? 0)
          oppScore = isP1 ? (m.score2 ?? 0) : (m.score1 ?? 0)
          won = myPlayerIdSet.has(m.winner_id ?? '')
          if (opp) {
            opponentName = opp.name
            opponentClub = opp.club
            opponentId = opp.id
          }
        } else {
          const t1 = m.participant1_id ? teamMap.get(m.participant1_id) : null
          const t2 = m.participant2_id ? teamMap.get(m.participant2_id) : null
          // 내 팀인지 판별: teamIds 또는 (playerInfo.name으로 이름 매칭 폴백)
          const isT1 = t1 ? (myTeamIdSet.has(t1.id) || (myName ? t1.members.includes(myName) : false)) : false
          const isT2 = t2 ? (myTeamIdSet.has(t2.id) || (myName ? t2.members.includes(myName) : false)) : false
          if (!isT1 && !isT2) continue
          const my = isT1 ? t1 : t2
          const opp = isT1 ? t2 : t1
          if (!my) continue
          myScore = isT1 ? (m.score1 ?? 0) : (m.score2 ?? 0)
          oppScore = isT1 ? (m.score2 ?? 0) : (m.score1 ?? 0)
          won = myTeamIdSet.has(m.winner_id ?? '') ||
            (myName ? (m.winner_id === (isT1 ? m.participant1_id : m.participant2_id)) : false)
          if (opp) {
            opponentName = opp.name
            opponentClub = opp.club
            opponentMembers = opp.members
            opponentId = opp.id
          }
        }

        const setsRaw = (m.match_sets ?? []) as unknown as { set_number: number; score1: number; score2: number }[]
        const isP1Side = (type === 'player')
          ? (m.participant1_id ? myPlayerIdSet.has(m.participant1_id) : false)
          : (m.participant1_id ? (myTeamIdSet.has(m.participant1_id) || (myName ? (teamMap.get(m.participant1_id)?.members ?? []).includes(myName) : false)) : false)
        const sets = [...setsRaw].sort((a, b) => a.set_number - b.set_number).map(s => ({
          set_number: s.set_number,
          my_score: isP1Side ? s.score1 : s.score2,
          opp_score: isP1Side ? s.score2 : s.score1,
        }))

        const pointsEarned = getMatchRatingPoints({
          phase_type: phaseType,
          format: phase?.format ?? 'single_elimination',
          round: m.round,
          total_rounds: totalRounds,
          won,
        })

        matchRecords.push({
          id: m.id,
          phase_id: m.phase_id ?? null,
          tournament_id: tournament?.id ?? null,
          tournament_name: tournament?.name ?? '(알 수 없음)',
          tournament_start: tournament?.start_date ?? null,
          division_name: division?.name ?? '(알 수 없음)',
          phase_type: phaseType,
          format: phase?.format ?? 'single_elimination',
          round: m.round,
          total_rounds: totalRounds,
          opponent_id: opponentId,
          opponent_name: opponentName,
          opponent_club: opponentClub,
          opponent_members: opponentMembers,
          my_score: myScore,
          opp_score: oppScore,
          won,
          points_earned: pointsEarned,
          sets,
        })
      }
    }
  }

  // ── 일회성 게임 전적 ──
  if (hasName && includeCasual) {
    if (!playerInfo) {
      playerInfo = { name: nameParam, club: clubParam || undefined }
    }

    if (hasCasualGameFilter && casualGameIds.length === 0) {
      // skip
    } else {
      let casualQuery = supabase.from('casual_games').select('*')
      if (hasCasualGameFilter) {
        casualQuery = casualQuery.in('id', casualGameIds)
      } else {
        casualQuery = casualQuery.or(`player1_name.eq.${nameParam},player2_name.eq.${nameParam}`)
      }
      const { data: casualGames, error: casualError } = await casualQuery
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
          phase_id: null,
          tournament_id: null,
          tournament_name: '숏게임',
          tournament_start: g.played_at,
          division_name: g.venue ?? '',
          phase_type: 'casual',
          format: 'casual',
          round: 0,
          total_rounds: 0,
          opponent_id: null,
          opponent_name: isP1 ? g.player2_name : g.player1_name,
          opponent_club: (isP1 ? g.player2_club : g.player1_club) ?? undefined,
          my_score: myScore,
          opp_score: oppScore,
          won,
          points_earned: won ? 10 : 0,
          sets,
        })
      }
    }
  }

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
    opponent_members?: string[]
    wins: number
    losses: number
    matches: typeof matchRecords
  }>()

  for (const m of matchRecords) {
    const key = `${m.opponent_name}|${m.opponent_club ?? ''}`
    if (!h2hMap.has(key)) {
      h2hMap.set(key, {
        opponent_key: key,
        opponent_name: m.opponent_name,
        opponent_club: m.opponent_club,
        opponent_members: m.opponent_members,
        wins: 0,
        losses: 0,
        matches: [],
      })
    }
    const entry = h2hMap.get(key)!
    if (m.won) entry.wins++
    else entry.losses++
    entry.matches.push(m)
  }

  const h2h = [...h2hMap.values()].sort((a, b) => (b.wins + b.losses) - (a.wins + a.losses))

  const totalPoints = matchRecords.reduce((s, m) => s + m.points_earned, 0)
  const breakdown = {
    casual: matchRecords.filter(m => m.phase_type === 'casual').reduce((s, m) => s + m.points_earned, 0),
    preliminary: matchRecords.filter(m => m.phase_type === 'preliminary').reduce((s, m) => s + m.points_earned, 0),
    main: matchRecords.filter(m => m.phase_type === 'main').reduce((s, m) => s + m.points_earned, 0),
  }

  return NextResponse.json({
    player: playerInfo,
    total_wins: matchRecords.filter(m => m.won).length,
    total_losses: matchRecords.filter(m => !m.won).length,
    rating_points: totalPoints,
    rating_breakdown: breakdown,
    h2h,
    matches: matchRecords,
  })
}