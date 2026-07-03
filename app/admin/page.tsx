import Link from 'next/link'
import { Plus, Trophy, ArrowRight, MessageCircle, Clock } from 'lucide-react'
import { createClientSafe } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TournamentDashboardList from '@/components/admin/TournamentDashboardList'
import type { Tournament } from '@/lib/types'

export default async function AdminDashboard() {
  const supabase = await createClientSafe()
  if (!supabase) redirect('/login')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles').select('*').eq('id', user.id).single()

  const isSystemAdmin = profile?.role === 'system_admin'

  const tournaments = await (async () => {
    if (isSystemAdmin) {
      const { data } = await supabase.from('tournaments').select('*').order('created_at', { ascending: false }).limit(20)
      return data
    }
    const { data: coAdminRows } = await supabase
      .from('tournament_admins').select('tournament_id').eq('user_id', user.id)
    const coAdminIds = (coAdminRows ?? []).map((r: { tournament_id: string }) => r.tournament_id)
    const orParts = [`admin_id.eq.${user.id}`, `created_by.eq.${user.id}`]
    if (coAdminIds.length > 0) orParts.push(`id.in.(${coAdminIds.join(',')})`)
    const { data } = await supabase
      .from('tournaments').select('*').or(orParts.join(',')).order('created_at', { ascending: false }).limit(20)
    return data
  })()

  const counts = {
    draft:       tournaments?.filter(t => t.status === 'draft').length ?? 0,
    registration: tournaments?.filter(t => t.status === 'registration').length ?? 0,
    in_progress: tournaments?.filter(t => t.status === 'in_progress').length ?? 0,
    completed:   tournaments?.filter(t => t.status === 'completed').length ?? 0,
  }

  const { count: unansweredQnaCount } = await supabase
    .from('main_questions')
    .select('*', { count: 'exact', head: true })
    .is('answer', null)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">대시보드</h1>
          <p className="text-muted-foreground text-sm mt-1">안녕하세요, {profile?.name ?? user.email}님</p>
        </div>
        <Link href="/admin/tournaments/new"
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> 대회 등록
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '준비 중',  value: counts.draft,        color: 'text-gray-400' },
          { label: '접수 중',  value: counts.registration, color: 'text-blue-400' },
          { label: '진행 중',  value: counts.in_progress,  color: 'text-orange-400' },
          { label: '종료',     value: counts.completed,    color: 'text-emerald-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass rounded-xl p-4 border border-white/10 text-center">
            <div className={`text-3xl font-extrabold tabular-nums ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* 메인 Q&A */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" /> 메인 Q&amp;A
          </h2>
        </div>
        <Link
          href="/admin/qna"
          className="glass rounded-xl border border-white/10 p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="font-medium">Q&amp;A 관리하기</span>
            {(unansweredQnaCount ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-sm text-accent font-semibold">
                <Clock className="w-3.5 h-3.5" />
                미답변 {unansweredQnaCount}개
              </span>
            )}
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">내 대회 목록</h2>
          {isSystemAdmin && (
            <Link href="/admin/system/users" className="text-sm text-primary hover:underline flex items-center gap-1">
              사용자 관리 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>

        {(tournaments?.length ?? 0) > 0 ? (
          <TournamentDashboardList tournaments={tournaments as Tournament[]} />
        ) : (
          <div className="text-center py-12 text-muted-foreground glass rounded-xl border border-white/10">
            <Trophy className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">등록된 대회가 없습니다</p>
            <Link href="/admin/tournaments/new" className="text-sm text-primary hover:underline mt-2 inline-block">
              첫 대회 등록하기
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
