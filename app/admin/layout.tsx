import { redirect } from 'next/navigation'
import { createClientSafe } from '@/lib/supabase/server'
import AdminSidebar from '@/components/layout/AdminSidebar'
import MobileBottomNav from '@/components/layout/MobileBottomNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClientSafe()
  if (!supabase) redirect('/login')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-dvh">
      <AdminSidebar />
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-auto">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  )
}
