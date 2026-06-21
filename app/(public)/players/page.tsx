'use client'

import { useState, useCallback, useEffect } from 'react'
import { Search, ChevronRight, Users, User, Trophy, Gamepad2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface GroupedPlayer {
  name: string
  club: string | null
  player_ids: string[]
  registrations: { tournament_name: string; division_name: string }[]
  has_casual_games: boolean
}

interface MatchRecord {
  id: string
  tournament_id: string | null
  tournament_name: string
  tournament_start: string | null
  division_name: string
  phase_type: string
  round: number
  opponent_id: string | null
  opponent_name: string
  opponent_club?: string
  my_score: number
  opp_score: number
  won: boolean
  sets: { set_number: number; my_score: number; opp_score: number }[]
}

interface H2HEntry {
  opponent_key: string
  opponent_name: string
  opponent_club?: string
  wins: number
  losses: number
  matches: MatchRecord[]
}

interface PlayerRecords {
  player: { name: string; club?: string }
  total_wins: number
  total_losses: number
  h2h: H2HEntry[]
  matches: MatchRecord[]
}

function formatPhaseRound(phaseType: string, round: number, divisionName: string) {
  if (phaseType === 'casual') return divisionName || '일회성 게임'
  return phaseType === 'preliminary' ? `예선 ${round}R` : `본선 ${round}R`
}

function formatSets(sets: { my_score: number; opp_score: number }[]) {
  return sets.map(s => `${s.my_score}-${s.opp_score}`).join('  ')
}

export default function PlayersPage() {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<GroupedPlayer[] | null>(null)
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [records, setRecords] = useState<PlayerRecords | null>(null)
  const [expandedH2H, setExpandedH2H] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [includeTournament, setIncludeTournament] = useState(true)
  const [includeCasual, setIncludeCasual] = useState(true)
  const [lastSearchState, setLastSearchState] = useState<{ playerIds: string[]; name: string; club: string | null } | null>(null)

  const loadRecords = useCallback(async (
    playerIds: string[],
    name: string,
    club: string | null,
    opts?: { tournament?: boolean; casual?: boolean }
  ) => {
    setLoadingRecords(true)
    setError('')
    setExpandedH2H(null)
    const useTournament = opts?.tournament ?? includeTournament
    const useCasual = opts?.casual ?? includeCasual
    try {
      const params = new URLSearchParams()
      if (playerIds.length > 0) params.set('ids', playerIds.join(','))
      if (name) params.set('name', name)
      if (club) params.set('club', club)
      if (!useTournament) params.set('include_tournament', 'false')
      if (!useCasual) params.set('include_casual', 'false')
      const res = await fetch(`/api/players/records?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data: PlayerRecords = await res.json()
      setRecords(data)
    } catch {
      setError('전적 조회 중 오류가 발생했습니다.')
    } finally {
      setLoadingRecords(false)
    }
  }, [includeTournament, includeCasual])

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim()
    if (!trimmed) return
    setSearching(true)
    setError('')
    setSearchResults(null)
    setRecords(null)
    setExpandedH2H(null)
    try {
      const res = await fetch(`/api/players/search?name=${encodeURIComponent(trimmed)}`)
      if (!res.ok) throw new Error()
      const data: GroupedPlayer[] = await res.json()
      setSearchResults(data)
      if (data.length > 0) {
        const allIds = data.flatMap(p => p.player_ids)
        setLastSearchState({ playerIds: allIds, name: trimmed, club: null })
        await loadRecords(allIds, trimmed, null)
      }
    } catch {
      setError('검색 중 오류가 발생했습니다.')
    } finally {
      setSearching(false)
    }
  }, [query, loadRecords])

  const handleToggleTournament = useCallback(() => {
    const next = !includeTournament
    setIncludeTournament(next)
    if (lastSearchState) {
      loadRecords(lastSearchState.playerIds, lastSearchState.name, lastSearchState.club, { tournament: next, casual: includeCasual })
    }
  }, [includeTournament, includeCasual, lastSearchState, loadRecords])

  const handleToggleCasual = useCallback(() => {
    const next = !includeCasual
    setIncludeCasual(next)
    if (lastSearchState) {
      loadRecords(lastSearchState.playerIds, lastSearchState.name, lastSearchState.club, { tournament: includeTournament, casual: next })
    }
  }, [includeTournament, includeCasual, lastSearchState, loadRecords])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('name')
        .eq('id', user.id)
        .single()
      if (!profile?.name) return
      const name = profile.name
      setQuery(name)
      setSearching(true)
      setError('')
      try {
        const res = await fetch(`/api/players/search?name=${encodeURIComponent(name)}`)
        if (!res.ok) throw new Error()
        const data: GroupedPlayer[] = await res.json()
        setSearchResults(data)
        if (data.length > 0) {
          const allIds = data.flatMap(p => p.player_ids)
          setLastSearchState({ playerIds: allIds, name, club: null })
          await loadRecords(allIds, name, null)
        }
      } catch {
        // 자동 조회 실패는 무시
      } finally {
        setSearching(false)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalGames = records ? records.total_wins + records.total_losses : 0
  const winRate = records && totalGames > 0 ? Math.round((records.total_wins / totalGames) * 100) : 0
  const loading = searching || loadingRecords

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">전적 조회</h1>
      <p className="text-muted-foreground text-sm mb-6">선수명을 검색하여 상대별 전적을 확인하세요.</p>

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !loading && handleSearch()}
            placeholder="선수명 입력..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <Button onClick={handleSearch} disabled={loading || !query.trim()}>
          {searching ? '검색 중...' : '검색'}
        </Button>
      </div>

      {/* Filter Toggles */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-xs text-muted-foreground mr-1">포함:</span>
        <button
          onClick={handleToggleTournament}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
            includeTournament
              ? 'bg-primary/20 border-primary/50 text-primary'
              : 'bg-transparent border-white/10 text-muted-foreground'
          }`}
        >
          <Trophy className="w-3 h-3" />
          대회등록
        </button>
        <button
          onClick={handleToggleCasual}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
            includeCasual
              ? 'bg-accent/20 border-accent/50 text-accent'
              : 'bg-transparent border-white/10 text-muted-foreground'
          }`}
        >
          <Gamepad2 className="w-3 h-3" />
          게임기록
        </button>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading && (
        <div className="text-center py-16 text-muted-foreground text-sm">불러오는 중...</div>
      )}

      {/* Player Records */}
      {!loading && records && (
        <div className="space-y-4">
    
          {/* Player Info */}
          <div className="glass rounded-xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <User className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{records.player.name}</h2>
              {records.player.club && (
                <p className="text-sm text-muted-foreground">{records.player.club}</p>
              )}
            </div>
          </div>

          {/* Win/Loss Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{records.total_wins}</p>
              <p className="text-xs text-muted-foreground mt-1">승</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{records.total_losses}</p>
              <p className="text-xs text-muted-foreground mt-1">패</p>
            </div>
            <div className="glass rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{winRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">승률</p>
            </div>
          </div>

          {/* H2H Records */}
          {records.h2h.length > 0 && (
            <div className="glass rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h3 className="font-semibold">상대 전적</h3>
              </div>
              <div className="divide-y divide-white/5">
                {records.h2h.map(h => {
                  const rate = Math.round((h.wins / (h.wins + h.losses)) * 100)
                  const isExpanded = expandedH2H === h.opponent_key
                  return (
                    <div key={h.opponent_key}>
                      <button
                        onClick={() => setExpandedH2H(isExpanded ? null : h.opponent_key)}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium">{h.opponent_name}</span>
                          {h.opponent_club && (
                            <span className="text-xs text-muted-foreground ml-2">{h.opponent_club}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm shrink-0">
                          <span className="text-primary font-semibold">{h.wins}승</span>
                          <span className="text-red-400 font-semibold">{h.losses}패</span>
                          <span className="text-muted-foreground w-10 text-right">{rate}%</span>
                          <ChevronRight
                            className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="bg-white/[0.02] px-5 pb-3 pt-1 space-y-1">
                          {h.matches.map(m => (
                            <div key={m.id} className="flex items-center gap-2 py-1 text-xs text-muted-foreground">
                              <span className={`font-semibold w-4 ${m.won ? 'text-primary' : 'text-red-400'}`}>
                                {m.won ? '승' : '패'}
                              </span>
                              <span className="font-mono text-white/70">{m.my_score}:{m.opp_score}</span>
                              <span className="text-white/30">·</span>
                              <span>{formatPhaseRound(m.phase_type, m.round, m.division_name)}</span>
                              {m.phase_type !== 'casual' && (
                                <>
                                  <span className="text-white/30">·</span>
                                  <span className="truncate">{m.tournament_name} / {m.division_name}</span>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Match History */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-semibold">경기 이력</h3>
              <span className="text-sm text-muted-foreground">{records.matches.length}경기</span>
            </div>
            {records.matches.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">완료된 경기 기록이 없습니다.</p>
            ) : (
              <div className="divide-y divide-white/5">
                {records.matches.map(m => (
                  <div key={m.id} className="flex items-start gap-3 px-5 py-3">
                    <span
                      className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded mt-0.5 ${
                        m.won ? 'bg-primary/20 text-primary' : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {m.won ? '승' : '패'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-medium text-sm">{m.opponent_name}</span>
                        {m.opponent_club && (
                          <span className="text-xs text-muted-foreground">{m.opponent_club}</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {m.phase_type === 'casual' ? (
                          <>
                            <span className="text-accent font-medium">일회성 게임</span>
                            {m.division_name && ` · ${m.division_name}`}
                            {m.tournament_start && ` · ${m.tournament_start}`}
                          </>
                        ) : (
                          `${m.tournament_name} · ${m.division_name} · ${formatPhaseRound(m.phase_type, m.round, m.division_name)}`
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-sm font-semibold">{m.my_score}:{m.opp_score}</p>
                      {m.sets.length > 0 && (
                        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{formatSets(m.sets)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 검색 결과 없음 */}
      {!loading && !records && searchResults && searchResults.length === 0 && (
        <div className="glass rounded-xl p-10 text-center">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">"{query}"</span> 이름의 선수를 찾을 수 없습니다.
          </p>
        </div>
      )}

      {/* Initial empty state */}
      {!loading && !searchResults && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-muted-foreground text-sm">선수 이름을 입력하고 검색하세요.</p>
        </div>
      )}
    </div>
  )
}
