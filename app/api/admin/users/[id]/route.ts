import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function getCallerRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  return data?.role ?? null
}

// PATCH /api/admin/users/[id] — update role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const role = await getCallerRole(supabase)
  if (role !== 'system_admin') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { data: target } = await supabase.from('user_profiles').select('role').eq('id', id).single()
  if (target?.role === 'system_admin') {
    return NextResponse.json({ error: '시스템 관리자 계정은 변경할 수 없습니다' }, { status: 403 })
  }

  const { role: newRole } = await req.json()
  if (!['system_admin', 'tournament_admin'].includes(newRole)) {
    return NextResponse.json({ error: '유효하지 않은 역할' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ role: newRole })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/users/[id] — delete user
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const role = await getCallerRole(supabase)
  if (role !== 'system_admin') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { data: { user } } = await supabase.auth.getUser()
  if (user?.id === id) return NextResponse.json({ error: '본인 계정은 삭제할 수 없습니다' }, { status: 400 })

  const { data: target } = await supabase.from('user_profiles').select('role').eq('id', id).single()
  if (target?.role === 'system_admin') {
    return NextResponse.json({ error: '시스템 관리자 계정은 삭제할 수 없습니다' }, { status: 403 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) return NextResponse.json({ error: '서버 설정 오류' }, { status: 503 })

  const adminClient = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 삭제 전 해당 유저의 대회 admin_id / created_by를 NULL로 해제 (FK 제약 해소)
  await adminClient
    .from('tournaments')
    .update({ admin_id: null })
    .eq('admin_id', id)

  await adminClient
    .from('tournaments')
    .update({ created_by: null })
    .eq('created_by', id)

  const { error } = await adminClient.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
