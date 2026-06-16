import { cn } from '@/lib/utils'
import type { Match } from '@/lib/types'

interface Props {
  matches: Match[]
  getName: (id?: string) => string | undefined
  getClub: (id?: string) => string | undefined
  isTeam: boolean
}

export default function MatchSchedule({ matches, getName, getClub }: Props) {
  // round로 그룹화
  const roundMap = new Map<number, Match[]>()
  for (const m of matches) {
    const list = roundMap.get(m.round) ?? []
    list.push(m)
    roundMap.set(m.round, list)
  }
  const rounds = [...roundMap.keys()].sort((a, b) => a - b)

  if (rounds.length === 0) return null

  return (
    <div className="glass rounded-xl border border-white/10 overflow-hidden">
      {rounds.map((round, ri) => {
        const roundMatches = (roundMap.get(round) ?? []).sort((a, b) => a.match_number - b.match_number)
        const completedCount = roundMatches.filter(m => m.status === 'completed').length
        const hasInProgress = roundMatches.some(m => m.status === 'in_progress')

        return (
          <div key={round} className={cn(ri > 0 && 'border-t border-white/10')}>
            {/* 라운드 헤더 */}
            <div className="flex items-center justify-between px-3 py-2 bg-white/[0.03]">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                라운드 {round}
              </span>
              <div className="flex items-center gap-2">
                {hasInProgress && (
                  <span className="flex items-center gap-1 text-xs text-blue-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    진행중
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {completedCount}/{roundMatches.length}
                </span>
              </div>
            </div>

            {/* 경기 목록 */}
            {roundMatches.map((m, mi) => {
              const p1Name = getName(m.participant1_id) ?? '?'
              const p1Club = getClub(m.participant1_id)
              const p2Name = getName(m.participant2_id) ?? '?'
              const p2Club = getClub(m.participant2_id)
              const p1Won = m.winner_id === m.participant1_id
              const p2Won = m.winner_id === m.participant2_id
              const isCompleted = m.status === 'completed'
              const isInProgress = m.status === 'in_progress'

              return (
                <div
                  key={m.id}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 text-sm',
                    mi > 0 && 'border-t border-white/5',
                    isInProgress && 'bg-blue-500/5 border-l-2 border-l-blue-500/60',
                    isCompleted && 'opacity-70'
                  )}
                >
                  {/* 경기 번호 */}
                  <span className="text-xs text-muted-foreground/50 w-4 shrink-0 text-right">
                    {m.match_number}
                  </span>

                  {/* 참가자 1 */}
                  <div className={cn(
                    'flex-1 min-w-0 text-right',
                    isCompleted && p1Won ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  )}>
                    <div className="truncate">{p1Name}</div>
                    {p1Club && (
                      <div className="text-xs text-muted-foreground/60 truncate">{p1Club}</div>
                    )}
                  </div>

                  {/* 가운데: 점수 또는 상태 */}
                  <div className="shrink-0 flex flex-col items-center gap-0.5 min-w-[56px]">
                    {isCompleted ? (
                      <span className="text-sm font-bold tabular-nums text-foreground">
                        {m.score1} : {m.score2}
                      </span>
                    ) : isInProgress ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium animate-pulse">
                        진행중
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground/50">
                        대기
                      </span>
                    )}
                  </div>

                  {/* 참가자 2 */}
                  <div className={cn(
                    'flex-1 min-w-0',
                    isCompleted && p2Won ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  )}>
                    <div className="truncate">{p2Name}</div>
                    {p2Club && (
                      <div className="text-xs text-muted-foreground/60 truncate">{p2Club}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
