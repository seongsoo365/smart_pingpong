import { createClientSafe } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.trim()
  if (!name) return NextResponse.json([])

  const supabase = await createClientSafe()
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  const { data, error } = await supabase
    .from('players')
    .select(`
      id, name, club,
      divisions(id, name, match_type,
        tournaments(id, name, start_date, status)
      )
    `)
    .ilike('name', `%${name}%`)
    .eq('confirmed', true)
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Group by (name, club) so a player who competed in multiple tournaments appears once
  const grouped = new Map<string, {
    name: string
    club: string | null
    player_ids: string[]
    registrations: { tournament_name: string; division_name: string }[]
  }>()

  for (const p of (data ?? [])) {
    const key = `${p.name}|${p.club ?? ''}`
    if (!grouped.has(key)) {
      grouped.set(key, { name: p.name, club: p.club ?? null, player_ids: [], registrations: [] })
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

  return NextResponse.json([...grouped.values()])
}
