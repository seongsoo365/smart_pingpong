import { createClientSafe } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.trim()
  if (!name) return NextResponse.json([])

  const supabase = await createClientSafe()
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  const nameLower = name.toLowerCase()

  const [
    { data: playerData, error: playerError },
    { data: teamData, error: teamError },
    { data: casualData, error: casualError },
  ] = await Promise.all([
    supabase
      .from('players')
      .select(`
        id, name, club,
        divisions(id, name, match_type,
          tournaments(id, name, start_date, status)
        )
      `)
      .ilike('name', `%${name}%`)
      .eq('confirmed', true)
      .limit(50),
    supabase
      .from('teams')
      .select(`
        id, club,
        team_members(player_name),
        divisions(id, name, match_type,
          tournaments(id, name, start_date, status)
        )
      `)
      .eq('confirmed', true)
      .limit(200),
    supabase
      .from('casual_games')
      .select('player1_name, player1_club, player2_name, player2_club')
      .or(`player1_name.ilike.%${name}%,player2_name.ilike.%${name}%`)
      .limit(100),
  ])

  if (playerError) return NextResponse.json({ error: playerError.message }, { status: 500 })
  if (teamError) return NextResponse.json({ error: teamError.message }, { status: 500 })
  if (casualError) return NextResponse.json({ error: casualError.message }, { status: 500 })

  const grouped = new Map<string, {
    name: string
    club: string | null
    player_ids: string[]
    team_ids: string[]
    registrations: { tournament_name: string; division_name: string; match_type?: string }[]
    has_casual_games: boolean
  }>()

  const upsertGroup = (
    key: string,
    opts: {
      name: string
      club: string | null
      playerId?: string
      teamId?: string
      registration?: { tournament_name: string; division_name: string; match_type?: string }
      casual?: boolean
    }
  ) => {
    if (!grouped.has(key)) {
      grouped.set(key, { name: opts.name, club: opts.club, player_ids: [], team_ids: [], registrations: [], has_casual_games: false })
    }
    const entry = grouped.get(key)!
    if (opts.playerId) entry.player_ids.push(opts.playerId)
    if (opts.teamId) entry.team_ids.push(opts.teamId)
    if (opts.registration) entry.registrations.push(opts.registration)
    if (opts.casual) entry.has_casual_games = true
    return entry
  }

  // 개인전 players
  for (const p of (playerData ?? [])) {
    const key = `${p.name}|${p.club ?? ''}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const div = p.divisions as unknown as { name: string; match_type?: string; tournaments: { name: string } | null } | null
    const tourney = div?.tournaments
    upsertGroup(key, {
      name: p.name,
      club: p.club ?? null,
      playerId: p.id,
      registration: tourney ? { tournament_name: tourney.name, division_name: div!.name, match_type: div!.match_type } : undefined,
    })
  }

  // 단체전 teams (팀원이 검색어에 포함된 팀만)
  for (const t of (teamData ?? [])) {
    const members = ((t.team_members as unknown as { player_name: string }[]) ?? [])
      .filter(m => m.player_name && m.player_name.toLowerCase().includes(nameLower))
    if (members.length === 0) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const div = t.divisions as unknown as { name: string; match_type?: string; tournaments: { name: string } | null } | null
    const tourney = div?.tournaments
    const club = t.club ?? null

    // 팀원 각 이름별로 그룹 생성 (동일 클럽 공유)
    for (const member of members) {
      const key = `${member.player_name}|${club ?? ''}`
      upsertGroup(key, {
        name: member.player_name,
        club,
        teamId: t.id,
        registration: tourney ? { tournament_name: tourney.name, division_name: div!.name, match_type: div!.match_type } : undefined,
      })
    }
  }

  // casual_games에서 이름 매칭되는 선수 추가
  for (const g of (casualData ?? [])) {
    const candidates: { n: string; c: string | null }[] = []
    if (g.player1_name.toLowerCase().includes(nameLower)) {
      candidates.push({ n: g.player1_name, c: g.player1_club ?? null })
    }
    if (g.player2_name.toLowerCase().includes(nameLower)) {
      candidates.push({ n: g.player2_name, c: g.player2_club ?? null })
    }
    for (const { n, c } of candidates) {
      const key = `${n}|${c ?? ''}`
      upsertGroup(key, { name: n, club: c, casual: true })
    }
  }

  return NextResponse.json([...grouped.values()])
}