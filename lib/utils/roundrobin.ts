// Circle method for round-robin scheduling
export function generateRoundRobin(participantIds: string[]): Array<[string, string][]> {
  const ids = [...participantIds]
  if (ids.length % 2 !== 0) ids.push('bye')
  const n = ids.length
  const rounds: Array<[string, string][]> = []

  for (let round = 0; round < n - 1; round++) {
    const matches: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const p1 = ids[i]
      const p2 = ids[n - 1 - i]
      if (p1 !== 'bye' && p2 !== 'bye') {
        matches.push([p1, p2])
      }
    }
    rounds.push(matches)

    // Rotate: fix position 0, rotate rest
    const last = ids[n - 1]
    for (let i = n - 1; i > 1; i--) {
      ids[i] = ids[i - 1]
    }
    ids[1] = last
  }

  return rounds
}

export function distributeIntoGroups<T>(participants: T[], groupCount: number): T[][] {
  const groups: T[][] = Array.from({ length: groupCount }, () => [])
  // Snake seeding: 1→A, 2→B, 3→C, 4→C, 5→B, 6→A ...
  participants.forEach((p, i) => {
    const row = Math.floor(i / groupCount)
    const col = i % groupCount
    const groupIndex = row % 2 === 0 ? col : groupCount - 1 - col
    groups[groupIndex].push(p)
  })
  return groups
}
