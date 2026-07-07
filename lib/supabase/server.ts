import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { cache } from 'react'
import type { User } from '@supabase/supabase-js'

export const supabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
  process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('https://')

export async function createClient() {
  if (!supabaseConfigured) throw new Error('SUPABASE_NOT_CONFIGURED')
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

// Supabase 미설정 시 null 반환 — 공개 페이지용
export async function createClientSafe() {
  if (!supabaseConfigured) return null
  return createClient()
}

// admin 레이아웃/페이지가 같은 요청 내에서 각자 auth.getUser()를 호출하면
// Supabase Auth 서버로 매번 네트워크 왕복이 발생함 — React cache()로 요청 단위 dedupe
export const getAuthUser = cache(async (): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>> | null
  user: User | null
}> => {
  const supabase = await createClientSafe()
  if (!supabase) return { supabase: null, user: null }
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
})
