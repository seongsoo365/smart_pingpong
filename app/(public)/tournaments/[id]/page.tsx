import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Calendar, MapPin, ChevronRight, ClipboardList } from 'lucide-react'
import { createClientSafe } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import type { Division } from '@/lib/types'

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }
const matchTypeLabel: Record<string, string> = { individual: '개인전', team: '단체전' }
const statusLabel: Record<string, string> = {
  draft: '준비 중', registration: '접수 중', in_progress: '진행 중', completed: '종료',
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClientSafe()
  if (!supabase) notFound()

  const { data: tournament } = await supabase
    .from('tournaments').select('*, admin:admin_id(name)').eq('id', id).single()
  if (!tournament) notFound()

  const [{ data: divisions }, { data: merges }] = await Promise.all([
    supabase.from('divisions').select('*').eq('tournament_id', id).order('display_order'),
    supabase.from('division_merges').select('*').eq('tournament_id', id),
  ])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="glass rounded-2xl p-6 border border-white/10">
        <div className="space-y-3">
          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', `status-${tournament.status}`)}>
            {statusLabel[tournament.status]}
          </span>
          <h1 className="text-2xl font-extrabold">{tournament.name}</h1>
          {tournament.description && (
            <p className="text-muted-foreground text-sm">{tournament.description}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> {tournament.start_date} ~ {tournament.end_date}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> {tournament.venue}
            </span>
          </div>
          {tournament.registration_start && (
            <p className="text-xs text-muted-foreground">
              접수 기간: {tournament.registration_start} ~ {tournament.registration_end}
            </p>
          )}
          {tournament.status === 'registration' && (
            <Link href={`/tournaments/${id}/register`}
              className="inline-flex items-center gap-2 mt-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
              <ClipboardList className="w-4 h-4" /> 참가 신청하기
            </Link>
          )}
        </div>
      </div>

      {(merges?.length ?? 0) > 0 && (
        <div className="glass rounded-xl p-4 border border-accent/20">
          <p className="text-sm font-medium text-accent mb-2">통합 부수 안내</p>
          {merges?.map(m => <p key={m.id} className="text-sm text-muted-foreground">{m.name}</p>)}
        </div>
      )}

      <section>
        <h2 className="text-lg font-bold mb-4">부수별 대진</h2>
        {(divisions?.length ?? 0) > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {divisions?.map((div: Division) => (
              <Link key={div.id} href={`/tournaments/${id}/divisions/${div.id}`}
                className="glass rounded-xl p-4 border border-white/10 hover:bg-white/10 hover:border-primary/30 transition-all group">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-base group-hover:text-primary transition-colors">
                      {genderLabel[div.gender]} {div.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{matchTypeLabel[div.match_type]}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">아직 부수가 등록되지 않았습니다.</p>
        )}
      </section>
    </div>
  )
}
