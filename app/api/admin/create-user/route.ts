import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

  const { data: profile } = await supabase.from('user_profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') return NextResponse.json({ error: '권한 없음' }, { status: 403 })

  const { email, name } = await req.json()
  if (!email || !name) return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 초대 이메일 발송 — 수신자가 링크를 클릭해 비밀번호 직접 설정
  const origin = new URL(req.url).origin
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // 초대 계정은 첫 로그인(비밀번호 설정) 완료 전까지 password_changed = false
  if (data.user) {
    await admin.from('user_profiles').update({ name, password_changed: false }).eq('id', data.user.id)
  }

  return NextResponse.json({ ok: true })
}
