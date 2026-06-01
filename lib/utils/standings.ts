import type { Match, Standing } from '@/lib/types'

type StandingRow = Omit<Standing, 'id' | 'group_id' | 'updated_at'>

function isSameTier(a: StandingRow, b: StandingRow): boolean {
  return (
    a.wins === b.wins &&
    a.sets_won - a.sets_lost === b.sets_won - b.sets_lost &&
    a.points_won - a.points_lost === b.points_won - b.points_lost
  )
}

export function hasTieAtBoundary(standings: StandingRow[], advanceCount: number): boolean {
  if (standings.length <= advanceCount) return false
  return isSameTier(standings[advanceCount - 1], standings[advanceCount])
}

export function getTieGroups(standings: StandingRow[]): number[][] {
  const result: number[][] = []
  let i = 0
  while (i < standings.length) {
    let j = i + 1
    while (j < standings.length && isSameTier(standings[i], standings[j])) j++
    if (j > i + 1) result.push(Array.from({ length: j - i }, (_, k) => i + k))
    i = j
  }
  return result
}

export function calculateStandings(
  matches: Match[],
  participantIds: string[]
): StandingRow[] {
  const stats: Record<string, {
    participant_id: string
    wins: number
    losses: number
    sets_won: number
    sets_lost: number
    points_won: number
    points_lost: number
  }> = {}

  participantIds.forEach(id => {
    stats[id] = { participant_id: id, wins: 0, losses: 0, sets_won: 0, sets_lost: 0, points_won: 0, points_lost: 0 }
  })

  for (const match of matches) {
    if (match.status !== 'completed') continue
    const { participant1_id: p1, participant2_id: p2, score1, score2, winner_id } = match
    if (!p1 || !p2) continue

    if (stats[p1]) {
      stats[p1].sets_won += score1
      stats[p1].sets_lost += score2
      if (winner_id === p1) stats[p1].wins++
      else stats[p1].losses++
    }
    if (stats[p2]) {
      stats[p2].sets_won += score2
      stats[p2].sets_lost += score1
      if (winner_id === p2) stats[p2].wins++
      else stats[p2].losses++
    }

    // Points from sets
    match.sets?.forEach(set => {
      if (stats[p1]) { stats[p1].points_won += set.score1; stats[p1].points_lost += set.score2 }
      if (stats[p2]) { stats[p2].points_won += set.score2; stats[p2].points_lost += set.score1 }
    })
  }

  const sorted = Object.values(stats).sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    const setDiffA = a.sets_won - a.sets_lost
    const setDiffB = b.sets_won - b.sets_lost
    if (setDiffB !== setDiffA) return setDiffB - setDiffA
    const ptDiffA = a.points_won - a.points_lost
    const ptDiffB = b.points_won - b.points_lost
    return ptDiffB - ptDiffA
  })

  return sorted.map((s, i) => ({ ...s, ranking: i + 1 }))
}
