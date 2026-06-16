const KEY = 'my_casual_games'
const MAX = 50

export function addMyGame(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const ids = getMyGameIds()
    const next = [id, ...ids.filter(i => i !== id)].slice(0, MAX)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {}
}

export function getMyGameIds(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

export function removeMyGame(id: string): void {
  if (typeof window === 'undefined') return
  try {
    const ids = getMyGameIds().filter(i => i !== id)
    localStorage.setItem(KEY, JSON.stringify(ids))
  } catch {}
}
