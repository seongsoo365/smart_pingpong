import { createClientSafe } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClientSafe()
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  const { data, error } = await supabase
    .from('casual_games')
    .select('*')
    .order('played_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClientSafe()
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  const body = await req.json()
  const {
    player1_name, player2_name,
    player1_club, player2_club,
    sets, games_per_match, points_per_game,
    played_at, venue, notes,
  } = body

  if (!player1_name?.trim() || !player2_name?.trim()) {
    return NextResponse.json({ error: '선수 이름은 필수입니다' }, { status: 400 })
  }

  const hasSets = Array.isArray(sets) && sets.length > 0
  const hasDirectScore = typeof body.score1 === 'number' && typeof body.score2 === 'number'

  if (!hasSets && !hasDirectScore) {
    return NextResponse.json({ error: '세트 점수 또는 최종 스코어를 입력해주세요' }, { status: 400 })
  }

  const score1 = hasSets
    ? sets.filter((s: { score1: number; score2: number }) => s.score1 > s.score2).length
    : (body.score1 as number)
  const score2 = hasSets
    ? sets.filter((s: { score1: number; score2: number }) => s.score2 > s.score1).length
    : (body.score2 as number)

  const { data, error } = await supabase
    .from('casual_games')
    .insert({
      player1_name: player1_name.trim(),
      player2_name: player2_name.trim(),
      player1_club: player1_club?.trim() || null,
      player2_club: player2_club?.trim() || null,
      score1,
      score2,
      sets,
      games_per_match: games_per_match ?? 5,
      points_per_game: points_per_game ?? 11,
      played_at: played_at || new Date().toISOString().slice(0, 10),
      venue: venue?.trim() || null,
      notes: notes?.trim() || null,
      created_by: null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
