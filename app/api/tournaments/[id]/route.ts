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

  const { data, error } = await supabase
    .from('tournaments')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
