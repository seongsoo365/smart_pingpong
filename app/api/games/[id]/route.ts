import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: existing } = await supabase
    .from('casual_games')
    .select('created_by')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: '존재하지 않는 게임' }, { status: 404 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'system_admin'
  if (!isAdmin && existing.created_by !== user.id) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await req.json()
  const {
    player1_name, player2_name,
    player1_club, player2_club,
    sets, games_per_match, points_per_game,
    played_at, venue, notes,
  } = body

  const score1 = (sets as { score1: number; score2: number }[])
    .filter(s => s.score1 > s.score2).length
  const score2 = (sets as { score1: number; score2: number }[])
    .filter(s => s.score2 > s.score1).length

  const { data, error } = await supabase
    .from('casual_games')
    .update({
      player1_name: player1_name?.trim(),
      player2_name: player2_name?.trim(),
      player1_club: player1_club?.trim() || null,
      player2_club: player2_club?.trim() || null,
      score1,
      score2,
      sets,
      games_per_match,
      points_per_game,
      played_at,
      venue: venue?.trim() || null,
      notes: notes?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: existing } = await supabase
    .from('casual_games')
    .select('created_by')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: '존재하지 않는 게임' }, { status: 404 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'system_admin'
  if (!isAdmin && existing.created_by !== user.id) {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const { error } = await supabase.from('casual_games').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
