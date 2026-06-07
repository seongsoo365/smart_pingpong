import Link from 'next/link'
import { Trophy, ArrowRight, Zap } from 'lucide-react'
import { createClientSafe } from '@/lib/supabase/server'
import TournamentCard from '@/components/tournament/TournamentCard'
import type { Tournament } from '@/lib/types'

export default async function HomePage() {
  const supabase = await createClientSafe()

  const activeTournaments: Tournament[] = []
  const recentTournaments: Tournament[] = []
  const draftTournaments: Tournament[] = []

  if (supabase) {
    const [{ data: active }, { data: recent }, { data: drafts }] = await Promise.all([
      supabase.from('tournaments').select('*').in('status', ['registration', 'in_progress'])
        .order('start_date', { ascending: true }).limit(6),
      supabase.from('tournaments').select('*').eq('status', 'completed')
        .gte('end_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
        .order('end_date', { ascending: false }).limit(4),
      supabase.from('tournaments').select('*').eq('status', 'draft')
        .order('start_date', { ascending: true, nullsFirst: false }).limit(6),
    ])
    activeTournaments.push(...(active ?? []))
    recentTournaments.push(...(recent ?? []))
    draftTournaments.push(...(drafts ?? []))
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
      {/* Hero */}
      <section className="text-center py-12 space-y-6">
        <div className="inline-flex items-center gap-2 glass px-4 py-2 rounded-full text-sm text-primary font-medium mb-4">
          <Zap className="w-4 h-4" />
          탁구 대회 관리 플랫폼
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
          Smart Pingpong
        </h1>
    
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link href="/tournaments"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-semibold hover:bg-primary/90 transition-colors">
            대회 목록 보기 <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/results"
            className="inline-flex items-center gap-2 glass px-6 py-3 rounded-xl font-semibold hover:bg-white/10 transition-colors">
            결과 이력 조회
          </Link>
        </div>
      </section>

      {/* Active */}
      {activeTournaments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              진행 중 · 접수 중
            </h2>
            <Link href="/tournaments" className="text-sm text-primary hover:underline flex items-center gap-1">
              전체 보기 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTournaments.map(t => <TournamentCard key={t.id} tournament={t} />)}
          </div>
        </section>
      )}

      {/* Recent */}
      {recentTournaments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold">최근 종료된 대회</h2>
            <Link href="/results" className="text-sm text-primary hover:underline flex items-center gap-1">
              전체 이력 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recentTournaments.map(t => <TournamentCard key={t.id} tournament={t} />)}
          </div>
        </section>
      )}

      {/* Draft / upcoming */}
      {draftTournaments.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              준비 중
            </h2>
            <Link href="/tournaments?status=draft" className="text-sm text-primary hover:underline flex items-center gap-1">
              전체 보기 <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {draftTournaments.map(t => <TournamentCard key={t.id} tournament={t} />)}
          </div>
        </section>
      )}

      {activeTournaments.length === 0 && recentTournaments.length === 0 && draftTournaments.length === 0 && supabase && (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">아직 등록된 대회가 없습니다</p>
          <p className="text-sm mt-1">관리자 로그인 후 첫 대회를 등록해보세요</p>
        </div>
      )}
    </div>
  )
}
