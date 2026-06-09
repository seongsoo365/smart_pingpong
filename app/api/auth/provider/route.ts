import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')
  if (!email || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ provider: null })
  }

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data } = await admin
    .from('user_profiles')
    .select('provider')
    .eq('email', email)
    .maybeSingle()

  return NextResponse.json({ provider: data?.provider ?? null })
}
