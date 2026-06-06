import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const body = await req.json()
  const { name, gender, match_type, team_match_format, max_teams } = body

  const { data: division } = await supabase
    .from('divisions')
    .select('tournament_id')
    .eq('id', id)
    .single()

  if (!division) return NextResponse.json({ error: '부수 없음' }, { status: 404 })

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('admin_id, created_by')
    .eq('id', division.tournament_id)
    .single()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const allowed = profile?.role === 'system_admin' ||
    tournament?.admin_id === user.id ||
    tournament?.created_by === user.id

  if (!allowed) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { data, error } = await supabase
    .from('divisions')
    .update({ name, gender, match_type, team_match_format: team_match_format ?? null, max_teams: max_teams ?? null })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
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

  const { data: division } = await supabase
    .from('divisions')
    .select('tournament_id')
    .eq('id', id)
    .single()

  if (!division) return NextResponse.json({ error: '부수 없음' }, { status: 404 })

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('admin_id, created_by')
    .eq('id', division.tournament_id)
    .single()

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const allowed = profile?.role === 'system_admin' ||
    tournament?.admin_id === user.id ||
    tournament?.created_by === user.id

  if (!allowed) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  // Check if matches already exist
  const { data: phases } = await supabase
    .from('tournament_phases')
    .select('id')
    .eq('division_id', id)

  if (phases && phases.length > 0) {
    const phaseIds = phases.map(p => p.id)
    const { count } = await supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .in('phase_id', phaseIds)

    if ((count ?? 0) > 0) {
      return NextResponse.json({ error: '이미 경기가 생성된 부수는 삭제할 수 없습니다' }, { status: 409 })
    }
  }

  const { error } = await supabase.from('divisions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
