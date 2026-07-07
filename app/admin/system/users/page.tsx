import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/supabase/server'
import AddAdminForm from './AddAdminForm'
import UserList from './UserList'
import type { UserProfile } from '@/lib/types'

export default async function SystemUsersPage() {
  const { supabase, user } = await getAuthUser()
  if (!supabase) redirect('/login')
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('*').eq('id', user.id).single()
  if (profile?.role !== 'system_admin') redirect('/admin')

  const { data: users } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">회원 관리</h1>
        <p className="text-muted-foreground text-sm mt-1">대회 관리자 계정을 등록하고 관리합니다</p>
      </div>

      <AddAdminForm />

      <UserList
        users={(users ?? []) as UserProfile[]}
        currentUserId={user.id}
      />
    </div>
  )
}
