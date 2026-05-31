import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
