'use client'

import { useEffect, useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { getMyGameIds, removeMyGame } from '@/lib/utils/myGames'
import type { CasualGame } from '@/lib/types'

interface Props {
  refreshKey?: number
}

export default function MyGameHistory({ refreshKey }: Props) {
  const [games, setGames] = useState<CasualGame[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const ids = getMyGameIds()
    if (ids.length === 0) {
      setGames([])
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`/api/games?ids=${ids.join(',')}`)
      if (res.ok) {
        const data: CasualGame[] = await res.json()
        const order = new Map(ids.map((id, i) => [id, i]))
        data.sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
        setGames(data)
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load, refreshKey])

  function handleRemove(id: string) {
    removeMyGame(id)
    setGames(prev => prev.filter(g => g.id !== id))
  }

  if (!loading && games.length === 0) return null

  return (
    <div className="space-y-3 pt-2">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
        내가 등록한 기록
      </h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">불러오는 중...</p>
      ) : (
        <ul className="space-y-2">
          {games.map(g => {
            const p1Won = g.score1 > g.score2
            return (
              <li key={g.id} className="glass rounded-xl p-4 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    <span className={p1Won ? 'text-primary font-bold' : ''}>{g.player1_name}</span>
                    <span className="text-muted-foreground mx-1.5 font-mono">{g.score1}:{g.score2}</span>
                    <span className={!p1Won ? 'text-primary font-bold' : ''}>{g.player2_name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {g.played_at}{g.venue ? ` · ${g.venue}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(g.id)}
                  className="p-1 text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                  aria-label="목록에서 제거"
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
