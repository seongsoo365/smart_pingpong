import type { TeamMember } from '@/lib/types'

/**
 * 단체전 팀원 부수(player_level) 합계를 "(07)" 형식으로 반환.
 * 팀원이 없거나 부수 미입력 팀원이 하나라도 있으면 "(--)".
 */
export function formatTeamLevelSum(members?: Pick<TeamMember, 'player_level'>[] | null): string {
  if (!members || members.length === 0) return '(--)'
  let sum = 0
  for (const m of members) {
    const level = m.player_level
    if (typeof level !== 'number' || !Number.isFinite(level)) return '(--)'
    sum += level
  }
  return `(${String(sum).padStart(2, '0')})`
}
