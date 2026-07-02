import { cn } from '@/lib/utils'
import type { Match } from '@/lib/types'

interface Participant {
  id: string
  name: string
  club?: string
}

interface Props {
  participants: Participant[]
  matches: Match[]
  participantLabel?: string
}

export default function GroupMatrix({ participants, matches, participantLabel = '선수' }: Props) {
  if (participants.length === 0) return null

  type Cell = { rowScore: number; colScore: number; rowWon: boolean }
  const grid: Record<string, Record<string, Cell>> = {}
  for (const p of participants) grid[p.id] = {}

  for (const m of matches) {
    if (m.status !== 'completed' || !m.participant1_id || !m.participant2_id) continue
    const { participant1_id: p1, participant2_id: p2, score1, score2 } = m
    grid[p1][p2] = { rowScore: score1, colScore: score2, rowWon: m.winner_id === p1 }
    grid[p2][p1] = { rowScore: score2, colScore: score1, rowWon: m.winner_id === p2 }
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-white/10">
            <th className="py-2.5 px-3 text-left text-foreground font-semibold bg-white/[0.04] min-w-[120px]">
              {participantLabel}
            </th>
            {participants.map((p) => (
              <th key={p.id} className="py-2.5 px-2 text-center text-foreground font-semibold bg-white/[0.04] min-w-[72px]">
                <span className="text-xs leading-tight break-keep">{p.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {participants.map((row, ri) => (
            <tr key={row.id} className="border-t border-white/10 hover:bg-white/[0.03] transition-colors">
              <td className="py-2.5 px-3">
                <span className="font-medium">{row.name}</span>
                {row.club && (
                  <span className="text-muted-foreground ml-1 hidden sm:inline text-xs">
                    {row.club}
                  </span>
                )}
              </td>
              {participants.map((col, ci) => {
                if (ri === ci) {
                  return (
                    <td key={col.id} className="py-2.5 px-2 text-center bg-white/[0.05]">
                      <span className="text-muted-foreground">―</span>
                    </td>
                  )
                }
                const cell = grid[row.id]?.[col.id]
                if (!cell) {
                  return (
                    <td key={col.id} className="py-2.5 px-2 text-center text-muted-foreground/50">·</td>
                  )
                }
                return (
                  <td key={col.id} className="py-2.5 px-2 text-center tabular-nums">
                    <span className={cn(
                      'font-semibold',
                      cell.rowWon ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {cell.rowScore}:{cell.colScore}
                    </span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
