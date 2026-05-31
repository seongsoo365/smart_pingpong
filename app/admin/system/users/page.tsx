import { redirect } from 'next/navigation'
import { createClientSafe } from '@/lib/supabase/server'
import AddAdminForm from './AddAdminForm'
import type { UserProfile } from '@/lib/types'

export default async function SystemUsersPage() {
  const supabase = await createClientSafe()
  if (!supabase) redirect('/login')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') redirect('/admin')

  const { data: users } = await supabase
    .from('user_profiles').select('*').order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">사용자 관리</h1>
        <p className="text-muted-foreground text-sm mt-1">대회 관리자 계정을 등록하고 관리합니다</p>
      </div>

      <AddAdminForm />

      <section className="glass rounded-2xl p-5 border border-white/10 space-y-3">
        <h2 className="font-semibold">등록된 사용자 ({users?.length ?? 0}명)</h2>
        <div className="space-y-2">
          {users?.map((u: UserProfile) => (
            <div key={u.id} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
              <div>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                u.role === 'system_admin'
                  ? 'bg-primary/20 text-primary'
                  : 'bg-white/10 text-muted-foreground'
              }`}>
                {u.role === 'system_admin' ? '시스템 관리자' : '대회 관리자'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
