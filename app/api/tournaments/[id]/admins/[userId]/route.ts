import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// DELETE /api/tournaments/[id]/admins/[userId] — 공동 관리자 제거
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  const { id, userId: targetUserId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const [{ data: tournament }, { data: profile }] = await Promise.all([
    supabase.from('tournaments').select('admin_id, created_by').eq('id', id).single(),
    supabase.from('user_profiles').select('role').eq('id', user.id).single(),
  ])
  if (!tournament) return NextResponse.json({ error: '대회 없음' }, { status: 404 })

  const isSystemAdmin = profile?.role === 'system_admin'
  const isPrimaryAdmin = tournament.admin_id === user.id || tournament.created_by === user.id
  if (!isSystemAdmin && !isPrimaryAdmin) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { error } = await supabase
    .from('tournament_admins')
    .delete()
    .eq('tournament_id', id)
    .eq('user_id', targetUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
