export function nextPowerOfTwo(n: number): number {
  let power = 1
  while (power < n) power *= 2
  return power
}

export function generateSeededBracket(participantIds: string[]): Array<[string | null, string | null]> {
  const n = participantIds.length
  const slots = nextPowerOfTwo(n)
  const seeded = [...participantIds]

  // Fill with byes
  while (seeded.length < slots) seeded.push('bye')

  // Standard seeded bracket pairing: 1 vs last, 2 vs second-last...
  const bracket: Array<[string | null, string | null]> = []
  const half = slots / 2

  for (let i = 0; i < half; i++) {
    const p1 = seeded[i] === 'bye' ? null : seeded[i]
    const p2 = seeded[slots - 1 - i] === 'bye' ? null : seeded[slots - 1 - i]
    bracket.push([p1, p2])
  }

  return bracket
}

export function getBracketRounds(participantCount: number): number {
  return Math.ceil(Math.log2(nextPowerOfTwo(participantCount)))
}

export function getRoundName(round: number, totalRounds: number): string {
  const diff = totalRounds - round
  if (diff === 0) return '결승'
  if (diff === 1) return '준결승'
  if (diff === 2) return '8강'
  if (diff === 3) return '16강'
  return `${round}라운드`
}
