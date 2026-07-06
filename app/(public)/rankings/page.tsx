import { createClientSafe } from '@/lib/supabase/server'
import { getMatchRatingPoints } from '@/lib/utils/rating'
import type { PlayerRanking } from '@/lib/types'

export const revalidate = 60

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim() ?? ''

  const supabase = await createClientSafe()
  const rankings: PlayerRanking[] = []

  if (supabase) {
    type TeamWithMembers = { id: string; club: string | null; team_members: { player_name: string }[] }
    type MatchRow = { id: string; phase_id: string; round: number; participant1_id: string | null; participant2_id: string | null; winner_id: string | null; tournament_phases: { phase_type: string; format: string } | null }

    const [
      { data: indivMatches },
      { data: teamMatches },
      { data: casualGames },
    ] = await Promise.all([
      supabase
        .from('matches')
        .select('id, phase_id, round, participant1_id, participant2_id, winner_id, tournament_phases(phase_type, format)')
        .eq('status', 'completed')
        .eq('participant1_type', 'player')
        .not('winner_id', 'is', null),
      supabase
        .from('matches')
        .select('id, phase_id, round, participant1_id, participant2_id, winner_id, tournament_phases(phase_type, format)')
        .eq('status', 'completed')
        .eq('participant1_type', 'team')
        .not('winner_id', 'is', null),
      supabase
        .from('casual_games')
        .select('player1_name, player1_club, player2_name, player2_club, score1, score2'),
    ])

    const phaseMaxRound = new Map<string, number>()
    for (const m of [...(indivMatches ?? []), ...(teamMatches ?? [])] as unknown as MatchRow[]) {
      const prev = phaseMaxRound.get(m.phase_id) ?? 0
      phaseMaxRound.set(m.phase_id, Math.max(prev, m.round))
    }

    const indivPlayerIds = [...new Set((indivMatches ?? []).flatMap(m => [m.participant1_id, m.participant2_id]).filter((id): id is string => !!id))]
    const teamIds = [...new Set((teamMatches ?? []).flatMap(m => [m.participant1_id, m.participant2_id]).filter((id): id is string => !!id))]

    const [{ data: players }, { data: teams }] = await Promise.all([
      indivPlayerIds.length > 0
        ? supabase.from('players').select('id, name, club').in('id', indivPlayerIds)
        : Promise.resolve({ data: [] as { id: string; name: string; club: string | null }[] }),
      teamIds.length > 0
        ? supabase.from('teams').select('id, club, team_members(player_name)').in('id', teamIds)
        : Promise.resolve({ data: [] as TeamWithMembers[] }),
    ])

    const playerMap = new Map<string, { name: string; club: string | null }>()
    for (const p of players ?? []) playerMap.set(p.id, { name: p.name, club: p.club ?? null })

    const teamMap = new Map<string, TeamWithMembers>()
    for (const t of (teams ?? []) as TeamWithMembers[]) teamMap.set(t.id, t)

    type Acc = { name: string; club: string | null; pts: number; wins: number; games: number; casual: number; prelim: number; main: number }
    const acc = new Map<string, Acc>()

    const key = (name: string, club: string | null | undefined) => `${name}|${club ?? ''}`
    const get = (name: string, club: string | null | undefined): Acc => {
      const k = key(name, club)
      if (!acc.has(k)) acc.set(k, { name, club: club ?? null, pts: 0, wins: 0, games: 0, casual: 0, prelim: 0, main: 0 })
      return acc.get(k)!
    }

    for (const m of (indivMatches ?? []) as unknown as MatchRow[]) {
      const phase = m.tournament_phases
      if (!phase) continue
      const totalRounds = phaseMaxRound.get(m.phase_id) ?? m.round
      const phaseType = phase.phase_type as 'preliminary' | 'main'

      for (const [pid, side] of [[m.participant1_id, 1], [m.participant2_id, 2]] as [string | null, number][]) {
        if (!pid) continue
        const p = playerMap.get(pid)
        if (!p) continue
        const e = get(p.name, p.club)
        e.games++
        const won = m.winner_id === pid
        if (won) e.wins++
        const pts = getMatchRatingPoints({ phase_type: phaseType, format: phase.format, round: m.round, total_rounds: totalRounds, won })
        e.pts += pts
        if (phaseType === 'preliminary') e.prelim += pts
        else e.main += pts
        void side
      }
    }

    for (const m of (teamMatches ?? []) as unknown as MatchRow[]) {
      const phase = m.tournament_phases
      if (!phase) continue
      const totalRounds = phaseMaxRound.get(m.phase_id) ?? m.round
      const phaseType = phase.phase_type as 'preliminary' | 'main'

      for (const [tid] of [[m.participant1_id], [m.participant2_id]] as [string | null][]) {
        if (!tid) continue
        const team = teamMap.get(tid)
        if (!team) continue
        const won = m.winner_id === tid
        const pts = getMatchRatingPoints({ phase_type: phaseType, format: phase.format, round: m.round, total_rounds: totalRounds, won })
        for (const member of team.team_members) {
          const e = get(member.player_name, team.club)
          e.games++
          if (won) e.wins++
          e.pts += pts
          if (phaseType === 'preliminary') e.prelim += pts
          else e.main += pts
        }
      }
    }

    for (const g of casualGames ?? []) {
      if (g.score1 === g.score2) continue
      const p1Won = g.score1 > g.score2
      const e1 = get(g.player1_name, g.player1_club)
      e1.games++
      if (p1Won) { e1.wins++; e1.pts += 10; e1.casual += 10 }
      const e2 = get(g.player2_name, g.player2_club)
      e2.games++
      if (!p1Won) { e2.wins++; e2.pts += 10; e2.casual += 10 }
    }

    let sorted = [...acc.values()].filter(p => p.games > 0).sort((a, b) => b.pts - a.pts || b.wins - a.wins)
    if (query) sorted = sorted.filter(p => p.name.includes(query) || (p.club ?? '').includes(query))

    sorted.forEach((p, i) => {
      rankings.push({
        rank: i + 1,
        name: p.name,
        club: p.club,
        total_points: p.pts,
        total_wins: p.wins,
        total_games: p.games,
        breakdown: { casual: p.casual, preliminary: p.prelim, main: p.main },
      })
    })
  }

  const rankBadge = (rank: number) => {
    if (rank === 1) return <span className="text-yellow-400 font-bold text-base">🥇</span>
    if (rank === 2) return <span className="text-slate-300 font-bold text-base">🥈</span>
    if (rank === 3) return <span className="text-amber-600 font-bold text-base">🥉</span>
    return <span className="text-muted-foreground text-sm font-medium">{rank}</span>
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">랭킹</h1>
        <p className="text-sm text-muted-foreground mt-1">대회 경기 및 숏게임 결과를 기반으로 산출된 개인 포인트 순위입니다.</p>
      </div>

      {/* 검색 */}
      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="이름 또는 소속으로 검색"
          className="flex-1 glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors"
        />
        <button type="submit" className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
          검색
        </button>
        {query && (
          <a href="/rankings" className="px-4 py-2.5 glass border border-white/10 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors">
            초기화
          </a>
        )}
      </form>

      {/* 포인트 규칙 안내 */}
      <details className="glass rounded-xl border border-white/10 px-4 py-3">
        <summary className="text-sm font-medium cursor-pointer select-none">포인트 부여 기준 보기</summary>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <span>숏게임 승리</span><span className="text-foreground font-medium text-right">+10</span>
          <span>대회 예선 매치 승리</span><span className="text-foreground font-medium text-right">+15</span>
          <span>본선 16강 승리</span><span className="text-foreground font-medium text-right">+30</span>
          <span>본선 8강 승리</span><span className="text-foreground font-medium text-right">+50</span>
          <span>본선 준결승 승리</span><span className="text-foreground font-medium text-right">+80</span>
          <span>준우승 (결승 진출)</span><span className="text-foreground font-medium text-right">+100</span>
          <span>우승</span><span className="text-primary font-bold text-right">+150</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">패배 시 포인트 차감 없음. 단체전은 팀원 전원에게 동일 포인트 부여.</p>
      </details>

      {/* 순위표 */}
      {rankings.length === 0 ? (
        <div className="glass rounded-2xl border border-white/10 p-12 text-center text-muted-foreground">
          {query ? `"${query}"에 해당하는 선수가 없습니다.` : '아직 경기 기록이 없습니다.'}
        </div>
      ) : (
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          {/* 헤더 */}
          <div className="grid grid-cols-[32px_1fr_80px] sm:grid-cols-[40px_1fr_80px_80px_80px] gap-2 px-4 py-3 border-b border-white/10 text-xs text-muted-foreground font-medium">
            <span className="text-center">순위</span>
            <span>선수</span>
            <span className="text-right">포인트</span>
            <span className="text-right hidden sm:block">승/전</span>
            <span className="text-right hidden sm:block">내역</span>
          </div>

          {rankings.map((r) => (
            <div key={`${r.name}|${r.club}`} className="grid grid-cols-[32px_1fr_80px] sm:grid-cols-[40px_1fr_80px_80px_80px] gap-2 px-4 py-3.5 border-b border-white/10 last:border-0 hover:bg-white/[0.03] transition-colors items-center">
              <div className="flex justify-center">{rankBadge(r.rank)}</div>

              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{r.name}</p>
                {r.club && <p className="text-xs text-muted-foreground truncate">{r.club}</p>}
              </div>

              <div className="text-right">
                <span className="text-primary font-bold text-base">{r.total_points.toLocaleString()}</span>
                <span className="text-xs text-muted-foreground ml-0.5">pt</span>
              </div>

              <div className="text-right hidden sm:block">
                <span className="text-sm">{r.total_wins}</span>
                <span className="text-xs text-muted-foreground">/{r.total_games}</span>
              </div>

              <div className="text-right hidden sm:block space-y-0.5">
                {r.breakdown.main > 0 && (
                  <p className="text-xs text-primary">대회 {r.breakdown.main}pt</p>
                )}
                {r.breakdown.preliminary > 0 && (
                  <p className="text-xs text-foreground/60">예선 {r.breakdown.preliminary}pt</p>
                )}
                {r.breakdown.casual > 0 && (
                  <p className="text-xs text-muted-foreground">숏게임 {r.breakdown.casual}pt</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">* 60초마다 갱신됩니다.</p>
    </div>
  )
}
