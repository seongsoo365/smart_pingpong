import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function getPermissions(supabase: Awaited<ReturnType<typeof createClient>>, tournamentId: string, userId: string) {
  const [{ data: tournament }, { data: profile }] = await Promise.all([
    supabase.from('tournaments').select('admin_id, created_by').eq('id', tournamentId).single(),
    supabase.from('user_profiles').select('role').eq('id', userId).single(),
  ])
  if (!tournament) return null
  const isSystemAdmin = profile?.role === 'system_admin'
  const isPrimaryAdmin = tournament.admin_id === userId || tournament.created_by === userId
  return { tournament, isSystemAdmin, isPrimaryAdmin, canManage: isSystemAdmin || isPrimaryAdmin }
}

// GET /api/tournaments/[id]/admins — 공동 관리자 목록
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data } = await supabase
    .from('tournament_admins')
    .select('*, user:user_id(id, name, email, role)')
    .eq('tournament_id', id)
    .order('added_at')

  return NextResponse.json(data ?? [])
}

// POST /api/tournaments/[id]/admins — 공동 관리자 추가
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const perms = await getPermissions(supabase, id, user.id)
  if (!perms) return NextResponse.json({ error: '대회 없음' }, { status: 404 })
  if (!perms.canManage) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { userId: targetUserId } = await req.json()
  if (!targetUserId) return NextResponse.json({ error: 'userId 필요' }, { status: 400 })

  // created_by / admin_id / system_admin은 공동 관리자로 추가 불필요
  if (targetUserId === perms.tournament.created_by || targetUserId === perms.tournament.admin_id) {
    return NextResponse.json({ error: '이미 관리자입니다' }, { status: 409 })
  }

  const { data, error } = await supabase
    .from('tournament_admins')
    .insert({ tournament_id: id, user_id: targetUserId, added_by: user.id })
    .select('*, user:user_id(id, name, email, role)')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '이미 추가된 관리자입니다' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json(data, { status: 201 })
}
