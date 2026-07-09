export function nextPowerOfTwo(n: number): number {
  let power = 1
  while (power < n) power *= 2
  return power
}

// 표준 토너먼트 시드 배치 순서: 슬롯 순서대로 시드 번호(1-based)를 나열한다.
// 1번 시드는 브라켓 맨 앞, 2번 시드는 맨 뒤에 배치되어 결승에서만 만나고,
// 상위 시드들이 앞뒤로 교차 분산되어 서로 결승에 가까운 라운드에서만 만난다.
// 예) 8슬롯: [1, 8, 5, 4, 3, 6, 7, 2]
function bracketSeedOrder(slots: number): number[] {
  let order = [1]
  while (order.length < slots) {
    const doubled = order.length * 2
    const next: number[] = []
    for (const s of order) next.push(s, doubled + 1 - s)
    order = next
  }
  return order
}

export function generateSeededBracket<T>(participantIds: T[]): Array<[T | null, T | null]> {
  const n = participantIds.length
  const slots = nextPowerOfTwo(n)
  const order = bracketSeedOrder(slots)

  const bracket: Array<[T | null, T | null]> = []
  for (let i = 0; i < slots; i += 2) {
    const p1 = order[i] <= n ? participantIds[order[i] - 1] : null
    const p2 = order[i + 1] <= n ? participantIds[order[i + 1] - 1] : null
    // 부전승(null)은 항상 두 번째 슬롯에 두어 기존 부전승 처리(p1만 존재)와 호환 유지.
    // 시드 배치 특성상 진출 인원 > 슬롯 절반이므로 한 경기에 부전승이 2개일 수 없음
    bracket.push(p1 === null && p2 !== null ? [p2, p1] : [p1, p2])
  }
  return bracket
}

// 예선 (조, 순위) 자리 표시자 — 본선 1라운드 슬롯 배치 계산용
export interface PrelimSlot {
  group: number  // 조 인덱스 (display_order 오름차순, 0부터)
  rank: number   // 조 내 순위 (0부터, 0 = 1위)
}

// 같은 조 몰림 비용: 경기(2슬롯) → 4슬롯 → ... → 절반 구역까지 각 구역에서
// 같은 조가 2팀 이상이면 벌점. 이른 라운드에서 만날수록(구역이 작을수록) 가중치가 크고,
// 특히 1라운드 같은 경기(2슬롯)의 같은 조 대결은 사실상 금지 수준의 벌점을 준다
function groupSpreadCost(placements: (PrelimSlot | null)[]): number {
  let cost = 0
  for (let size = 2; size <= placements.length / 2; size *= 2) {
    const weight = size === 2 ? 1_000_000 : placements.length / size
    for (let start = 0; start < placements.length; start += size) {
      const counts = new Map<number, number>()
      for (let s = start; s < start + size; s++) {
        const p = placements[s]
        if (!p) continue
        counts.set(p.group, (counts.get(p.group) ?? 0) + 1)
      }
      for (const c of counts.values()) {
        if (c > 1) cost += (c - 1) * weight
      }
    }
  }
  return cost
}

// 결정적 탐욕 보정: 동일 순위끼리만 자리를 교환하며(시드 등급·부전승 위치 불변)
// groupSpreadCost가 더 이상 줄지 않을 때까지 가장 비용을 많이 줄이는 교환을 반복한다.
// → 1라운드 같은 조 대결 제거 + 같은 조가 같은 절반/쿼터에 몰리는 것을 최대한 분산
function optimizeGroupSpread(placements: (PrelimSlot | null)[]): void {
  let current = groupSpreadCost(placements)
  while (current > 0) {
    let bestI = -1
    let bestJ = -1
    let bestCost = current
    for (let i = 0; i < placements.length; i++) {
      const a = placements[i]
      if (!a) continue
      for (let j = i + 1; j < placements.length; j++) {
        const b = placements[j]
        if (!b || b.rank !== a.rank || b.group === a.group) continue
        placements[i] = b
        placements[j] = a
        const swapped = groupSpreadCost(placements)
        placements[i] = a
        placements[j] = b
        if (swapped < bestCost) {
          bestCost = swapped
          bestI = i
          bestJ = j
        }
      }
    }
    if (bestI === -1) break // 더 이상 개선 불가 (예: 조가 1개뿐)
    const tmp = placements[bestI]
    placements[bestI] = placements[bestJ]
    placements[bestJ] = tmp
    current = bestCost
  }
}

// (G, K)별 계산 결과 캐시 — 순수 함수이므로 재사용 가능.
// 반환 배열은 공유되므로 호출부에서 변형하지 말 것 (읽기 전용)
const placementsCache = new Map<string, (PrelimSlot | null)[]>()

/**
 * 예선 조별 진출자의 본선 1라운드 슬롯 배치를 계산한다.
 * 반환 배열의 인덱스가 슬롯 번호(slotIndex = (matchNumber - 1) * 2 + (p2면 1)),
 * 값이 그 슬롯에 배정될 (조, 순위) — null이면 부전승으로 비워두는 슬롯.
 *
 * - 표준 시드 배치: 각 조 1위들이 브라켓 앞뒤로 교차 분산되어 서로 다른
 *   구역(쿼터)에 배치되고, 상위 순위끼리는 결승에 가까운 라운드에서만 만난다
 * - 진출 총원(조 수 × 진출 수)이 2의 거듭제곱이 아니면 상위 시드부터 부전승을
 *   받도록 배치한다. 부전승은 항상 실제 진출자와 짝지어지므로 양쪽이 모두 빈
 *   경기가 생기지 않는다 (빈 경기는 다음 라운드로 승자를 보낼 수 없음)
 * - 같은 조 진출자끼리는 1라운드 대결 금지 + 같은 절반/쿼터 몰림을 동일 순위
 *   교환으로 최대한 분산한다 (조가 1개뿐이면 보정 불가)
 * - 순수 함수이므로 실제 진출 배정과 예상 라벨 표시가 항상 같은 결과를 얻는다
 */
export function getPrelimSlotPlacements(groupCount: number, advanceCount: number): (PrelimSlot | null)[] {
  const cacheKey = `${groupCount}:${advanceCount}`
  const cached = placementsCache.get(cacheKey)
  if (cached) return cached

  const placeholders: PrelimSlot[] = []
  for (let r = 0; r < advanceCount; r++) {
    for (let g = 0; g < groupCount; g++) {
      placeholders.push({ group: g, rank: r })
    }
  }
  if (placeholders.length < 2) return placeholders

  const placements: (PrelimSlot | null)[] = []
  for (const [p1, p2] of generateSeededBracket(placeholders)) placements.push(p1, p2)

  optimizeGroupSpread(placements)

  placementsCache.set(cacheKey, placements)
  return placements
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
