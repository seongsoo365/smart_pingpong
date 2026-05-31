import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function canManageTournament(supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never, tournamentId: string, userId: string) {
  const [{ data: tournament }, { data: profile }] = await Promise.all([
    supabase.from('tournaments').select('admin_id, created_by').eq('id', tournamentId).single(),
    supabase.from('user_profiles').select('role').eq('id', userId).single(),
  ])
  if (!tournament) return false
  return profile?.role === 'system_admin' ||
    tournament.admin_id === userId ||
    tournament.created_by === userId
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await req.json()
  const { tournament_id, name, gender, match_type, display_order } = body

  if (!tournament_id || !name) return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  if (!await canManageTournament(supabase, tournament_id, user.id))
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { data, error } = await supabase
    .from('divisions')
    .insert({ tournament_id, name, gender: gender ?? 'male', match_type: match_type ?? 'individual', display_order: display_order ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Auto-create main phase for the new division
  await supabase.from('tournament_phases').insert({
    division_id: data.id,
    phase_type: 'main',
    phase_order: 1,
    format: 'single_elimination',
    games_per_match: 3,
    points_per_game: 11,
  })

  return NextResponse.json(data, { status: 201 })
}
