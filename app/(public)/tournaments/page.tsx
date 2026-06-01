import { createClientSafe } from '@/lib/supabase/server'
import TournamentCard from '@/components/tournament/TournamentCard'
import type { Tournament, TournamentStatus } from '@/lib/types'

const STATUS_FILTER: { value: TournamentStatus | 'all'; label: string }[] = [
  { value: 'all',          label: '전체' },
  { value: 'registration', label: '접수 중' },
  { value: 'in_progress',  label: '진행 중' },
  { value: 'completed',    label: '종료' },
  { value: 'draft',        label: '준비 중' },
]

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; year?: string; q?: string }>
}) {
  const sp = await searchParams
  const status = sp.status as (TournamentStatus | 'all') | undefined
  const year = sp.year
  const q = sp.q

  const supabase = await createClientSafe()
  let tournaments: Tournament[] = []

  if (supabase) {
    let query = supabase.from('tournaments').select('*')
      .order('start_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (status && status !== 'all') query = query.eq('status', status as TournamentStatus)
    if (year) query = query.gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`)
    if (q) query = query.ilike('name', `%${q}%`)
    const { data, error } = await query.limit(50)
    if (error) console.error('[tournaments] query error:', error.message)
    tournaments = data ?? []
  }

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear + 1 - i)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">대회 목록</h1>
        <p className="text-muted-foreground text-sm">전체 탁구 대회를 검색하고 조회하세요</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <form className="flex-1 min-w-48">
          <input name="q" defaultValue={q} placeholder="대회명 검색..."
            className="glass border border-white/10 rounded-xl px-4 py-2 text-sm bg-transparent outline-none focus:border-primary transition-colors w-full" />
        </form>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTER.map(({ value, label }) => (
            <a key={value}
              href={`/tournaments?status=${value}${year ? `&year=${year}` : ''}${q ? `&q=${q}` : ''}`}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                (status ?? 'all') === value
                  ? 'bg-primary text-primary-foreground'
                  : 'glass text-muted-foreground hover:text-foreground hover:bg-white/10'
              }`}>
              {label}
            </a>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap">
          {years.map(y => (
            <a key={y}
              href={`/tournaments?${status ? `status=${status}&` : ''}year=${y}${q ? `&q=${q}` : ''}`}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                String(year) === String(y)
                  ? 'bg-accent text-accent-foreground'
                  : 'glass text-muted-foreground hover:text-foreground hover:bg-white/10'
              }`}>
              {y}
            </a>
          ))}
        </div>
      </div>

      {tournaments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournaments.map(t => <TournamentCard key={t.id} tournament={t} />)}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <p>검색 결과가 없습니다</p>
        </div>
      )}
    </div>
  )
}
