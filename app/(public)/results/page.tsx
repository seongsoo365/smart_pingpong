import { createClientSafe } from '@/lib/supabase/server'
import TournamentCard from '@/components/tournament/TournamentCard'
import type { Tournament } from '@/lib/types'

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; year?: string }>
}) {
  const sp = await searchParams
  const q = sp.q
  const currentYear = new Date().getFullYear()
  // year 파라미터 없으면 올해를 기본값으로 사용
  const year = sp.year ?? String(currentYear)
  const isAllYears = sp.year === 'all'

  const supabase = await createClientSafe()
  let tournaments: Tournament[] = []

  if (supabase) {
    let query = supabase.from('tournaments').select('*').eq('status', 'completed')
      .order('end_date', { ascending: false })
    if (q) query = query.ilike('name', `%${q}%`)
    if (!isAllYears) query = query.gte('start_date', `${year}-01-01`).lte('start_date', `${year}-12-31`)
    const { data } = await query.limit(50)
    tournaments = data ?? []
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1">결과 이력</h1>
        <p className="text-muted-foreground text-sm">종료된 대회의 결과를 조회합니다</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <form className="flex-1 min-w-48">
          <input name="q" defaultValue={q} placeholder="대회명 검색..."
            className="glass border border-white/10 rounded-xl px-4 py-2 text-sm bg-transparent outline-none focus:border-primary transition-colors w-full" />
        </form>
        <div className="flex gap-2 flex-wrap">
          {years.map(y => (
            <a key={y} href={`/results?year=${y}${q ? `&q=${q}` : ''}`}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                !isAllYears && String(year) === String(y)
                  ? 'bg-primary text-primary-foreground'
                  : 'glass text-muted-foreground hover:text-foreground hover:bg-white/10'
              }`}>
              {y}
            </a>
          ))}
          <a href={`/results?year=all${q ? `&q=${q}` : ''}`}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              isAllYears
                ? 'bg-primary text-primary-foreground'
                : 'glass text-muted-foreground hover:text-foreground hover:bg-white/10'
            }`}>
            전체
          </a>
        </div>
      </div>

      {tournaments.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tournaments.map(t => <TournamentCard key={t.id} tournament={t} />)}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <p>종료된 대회가 없습니다</p>
        </div>
      )}
    </div>
  )
}
