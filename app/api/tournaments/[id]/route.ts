import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('admin_id, created_by, name')
    .eq('id', id)
    .single()

  if (!tournament) return NextResponse.json({ error: '대회 없음' }, { status: 404 })

  const { data: profile } = await supabase
    .from('user_profiles').select('role').eq('id', user.id).single()

  const isAdmin = profile?.role === 'system_admin'
  const isOwner = tournament.admin_id === user.id || tournament.created_by === user.id
  if (!isAdmin && !isOwner) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !supabaseUrl) return NextResponse.json({ error: '서버 설정 오류' }, { status: 503 })

  const adminClient = createAdminClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await adminClient.from('tournaments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: tournament } = await supabase
    .from('tournaments')
    .select('admin_id, created_by')
    .eq('id', id)
    .single()

  if (!tournament) return NextResponse.json({ error: '대회 없음' }, { status: 404 })

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'system_admin'
  const isOwner = tournament.admin_id === user.id || tournament.created_by === user.id

  if (!isAdmin && !isOwner) return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const body = await req.json()
  const allowed = ['name', 'venue', 'description', 'regulations', 'start_date', 'end_date',
    'registration_start', 'registration_end', 'status']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key] || null
  }

  // admin_id 위임은 원본 생성자(created_by) 또는 system_admin만 가능
  if ('admin_id' in body) {
    const canDelegate = isAdmin || tournament.created_by === user.id
    if (!canDelegate) return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    updates.admin_id = body.admin_id
  }

  const { data, error } = await supabase
    .from('tournaments')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
