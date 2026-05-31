import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface StandingRow {
  ranking: number
  name: string
  club?: string
  wins: number
  losses: number
  sets_won: number
  sets_lost: number
  points_won: number
  points_lost: number
  advanceCount?: number
}

export default function StandingsTable({
  rows,
  advanceCount,
}: {
  rows: StandingRow[]
  advanceCount?: number
}) {
  return (
    <div className="rounded-xl overflow-hidden border border-white/10">
      <Table>
        <TableHeader>
          <TableRow className="border-white/10 hover:bg-transparent">
            <TableHead className="w-10 text-center text-muted-foreground">순위</TableHead>
            <TableHead className="text-muted-foreground">선수/팀</TableHead>
            <TableHead className="text-center text-muted-foreground">승</TableHead>
            <TableHead className="text-center text-muted-foreground">패</TableHead>
            <TableHead className="text-center text-muted-foreground hidden sm:table-cell">세트</TableHead>
            <TableHead className="text-center text-muted-foreground hidden md:table-cell">점수</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isAdvancing = advanceCount !== undefined && row.ranking <= advanceCount
            return (
              <TableRow
                key={row.ranking}
                className={cn(
                  'border-white/5 transition-colors',
                  isAdvancing && 'bg-primary/5'
                )}
              >
                <TableCell className="text-center font-bold">
                  {row.ranking <= 3 ? (
                    <span className={cn(
                      'inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold',
                      row.ranking === 1 && 'bg-yellow-500/20 text-yellow-400',
                      row.ranking === 2 && 'bg-gray-400/20 text-gray-300',
                      row.ranking === 3 && 'bg-orange-700/20 text-orange-400',
                    )}>
                      {row.ranking}
                    </span>
                  ) : row.ranking}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-foreground">{row.name}</div>
                  {row.club && <div className="text-xs text-muted-foreground">{row.club}</div>}
                </TableCell>
                <TableCell className="text-center font-semibold text-primary">{row.wins}</TableCell>
                <TableCell className="text-center text-muted-foreground">{row.losses}</TableCell>
                <TableCell className="text-center text-sm hidden sm:table-cell">
                  {row.sets_won}<span className="text-muted-foreground">/{row.sets_lost}</span>
                </TableCell>
                <TableCell className="text-center text-sm hidden md:table-cell">
                  {row.points_won}<span className="text-muted-foreground">/{row.points_lost}</span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
