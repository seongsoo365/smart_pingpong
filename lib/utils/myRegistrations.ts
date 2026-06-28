const KEY = 'my_registrations'
const MAX = 20

export interface MyRegistration {
  id: string
  type: 'player' | 'team'
  tournament_id: string
}

export function addMyRegistration(reg: MyRegistration): void {
  if (typeof window === 'undefined') return
  try {
    const regs = getMyRegistrations()
    const next = [reg, ...regs.filter(r => r.id !== reg.id)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
}

export function getMyRegistrations(): MyRegistration[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as MyRegistration[]) : []
  } catch {
    return []
  }
}

export function getMyRegistrationsByTournament(tournamentId: string): MyRegistration[] {
  return getMyRegistrations().filter(r => r.tournament_id === tournamentId)
}

export function removeMyRegistration(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const regs = getMyRegistrations().filter(r => r.id !== id)
    localStorage.setItem(KEY, JSON.stringify(regs))
  } catch {}
}
