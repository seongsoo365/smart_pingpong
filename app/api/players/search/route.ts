import { createClientSafe } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.trim()
  if (!name) return NextResponse.json([])

  const supabase = await createClientSafe()
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  const [{ data: playerData, error: playerError }, { data: casualData, error: casualError }] =
    await Promise.all([
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
        .from('casual_games')
        .select('player1_name, player1_club, player2_name, player2_club')
        .or(`player1_name.ilike.%${name}%,player2_name.ilike.%${name}%`)
        .limit(100),
    ])

  if (playerError) return NextResponse.json({ error: playerError.message }, { status: 500 })
  if (casualError) return NextResponse.json({ error: casualError.message }, { status: 500 })

  const grouped = new Map<string, {
    name: string
    club: string | null
    player_ids: string[]
    registrations: { tournament_name: string; division_name: string }[]
    has_casual_games: boolean
  }>()

  for (const p of (playerData ?? [])) {
    const key = `${p.name}|${p.club ?? ''}`
    if (!grouped.has(key)) {
      grouped.set(key, { name: p.name, club: p.club ?? null, player_ids: [], registrations: [], has_casual_games: false })
    }
    const entry = grouped.get(key)!
    entry.player_ids.push(p.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const div = p.divisions as unknown as { name: string; tournaments: { name: string } | null } | null
    const tourney = div?.tournaments
    if (tourney) {
      entry.registrations.push({ tournament_name: tourney.name, division_name: div!.name })
    }
  }

  // casual_games에서 이름 매칭되는 선수 추가
  for (const g of (casualData ?? [])) {
    const nameLower = name.toLowerCase()
    const candidates: { n: string; c: string | null }[] = []
    if (g.player1_name.toLowerCase().includes(nameLower)) {
      candidates.push({ n: g.player1_name, c: g.player1_club ?? null })
    }
    if (g.player2_name.toLowerCase().includes(nameLower)) {
      candidates.push({ n: g.player2_name, c: g.player2_club ?? null })
    }
    for (const { n, c } of candidates) {
      const key = `${n}|${c ?? ''}`
      if (!grouped.has(key)) {
        grouped.set(key, { name: n, club: c, player_ids: [], registrations: [], has_casual_games: true })
      } else {
        grouped.get(key)!.has_casual_games = true
      }
    }
  }

  return NextResponse.json([...grouped.values()])
}
