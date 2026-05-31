import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { email, name, password } = await req.json()
  if (!email || !name || !password) return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })

  // Use service role client to create user
  const adminClient = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    user_metadata: { name },
    email_confirm: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Update profile name (trigger creates profile, but name might default to email)
  await adminClient.from('user_profiles').update({ name }).eq('id', data.user.id)

  return NextResponse.json({ ok: true })
}
