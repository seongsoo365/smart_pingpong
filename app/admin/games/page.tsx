'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { CasualGame } from '@/lib/types'

const GAMES_PER_MATCH_OPTIONS = [3, 5, 7]
const POINTS_PER_GAME_OPTIONS = [11, 21]

interface SetScore { score1: number; score2: number }

function buildInitialSets(gamesPerMatch: number): SetScore[] {
  return Array.from({ length: gamesPerMatch }, () => ({ score1: 0, score2: 0 }))
}

function computeScores(sets: SetScore[]) {
  const s1 = sets.filter(s => s.score1 > s.score2).length
  const s2 = sets.filter(s => s.score2 > s.score1).length
  return { score1: s1, score2: s2 }
}

const emptyForm = {
  player1_name: '',
  player1_club: '',
  player2_name: '',
  player2_club: '',
  games_per_match: 5,
  points_per_game: 11,
  played_at: new Date().toISOString().slice(0, 10),
  venue: '',
  notes: '',
}

export default function GamesPage() {
  const [games, setGames] = useState<CasualGame[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [sets, setSets] = useState<SetScore[]>(buildInitialSets(5))

  const loadGames = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/games')
      if (!res.ok) throw new Error()
      setGames(await res.json())
    } catch {
      toast.error('숏게임 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadGames() }, [loadGames])

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setSets(buildInitialSets(5))
    setDialogOpen(true)
  }

  function openEdit(game: CasualGame) {
    setEditingId(game.id)
    setForm({
      player1_name: game.player1_name,
      player1_club: game.player1_club ?? '',
      player2_name: game.player2_name,
      player2_club: game.player2_club ?? '',
      games_per_match: game.games_per_match,
      points_per_game: game.points_per_game,
      played_at: game.played_at,
      venue: game.venue ?? '',
      notes: game.notes ?? '',
    })
    setSets(game.sets.length > 0 ? game.sets : buildInitialSets(game.games_per_match))
    setDialogOpen(true)
  }

  function handleGamesPerMatchChange(value: number) {
    setForm(f => ({ ...f, games_per_match: value }))
    setSets(buildInitialSets(value))
  }

  function updateSet(idx: number, field: 'score1' | 'score2', raw: string) {
    const val = parseInt(raw, 10)
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: isNaN(val) ? 0 : val } : s))
  }

  function addSet() {
    setSets(prev => [...prev, { score1: 0, score2: 0 }])
  }

  function removeSet(idx: number) {
    setSets(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    if (!form.player1_name.trim() || !form.player2_name.trim()) {
      toast.error('선수 이름을 입력해주세요.')
      return
    }
    const validSets = sets.filter(s => s.score1 > 0 || s.score2 > 0)
    if (validSets.length === 0) {
      toast.error('세트 점수를 최소 1세트 입력해주세요.')
      return
    }
    setSaving(true)
    try {
      const payload = { ...form, sets: validSets }
      const url = editingId ? `/api/games/${editingId}` : '/api/games'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? '저장 실패')
      }
      toast.success(editingId ? '숏게임을 수정했습니다.' : '숏게임을 등록했습니다.')
      setDialogOpen(false)
      loadGames()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('이 숏게임 기록을 삭제하시겠습니까?')) return
    try {
      const res = await fetch(`/api/games/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('삭제했습니다.')
      setGames(prev => prev.filter(g => g.id !== id))
    } catch {
      toast.error('삭제 중 오류가 발생했습니다.')
    }
  }

  const { score1: previewScore1, score2: previewScore2 } = computeScores(sets)

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">숏게임</h1>
          <p className="text-muted-foreground text-sm mt-1">대회 외 1:1 단식 경기를 기록합니다.</p>
        </div>
        <Button onClick={openNew} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> 숏게임 등록
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">불러오는 중...</div>
      ) : games.length === 0 ? (
        <div className="glass rounded-xl p-16 text-center text-muted-foreground text-sm">
          등록된 숏게임이 없습니다.
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-muted-foreground text-xs">
                <th className="text-left px-4 py-3">날짜</th>
                <th className="text-left px-4 py-3">대결</th>
                <th className="text-center px-4 py-3">스코어</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">세트 상세</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">장소</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {games.map(g => {
                const p1Won = g.score1 > g.score2
                const p2Won = g.score2 > g.score1
                return (
                  <tr key={g.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {g.played_at}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className={p1Won ? 'font-semibold text-primary' : 'text-muted-foreground'}>
                          {g.player1_name}
                          {g.player1_club && <span className="text-xs ml-1 text-muted-foreground">({g.player1_club})</span>}
                        </span>
                        <span className={p2Won ? 'font-semibold text-primary' : 'text-muted-foreground'}>
                          {g.player2_name}
                          {g.player2_club && <span className="text-xs ml-1 text-muted-foreground">({g.player2_club})</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center font-mono font-bold whitespace-nowrap">
                      <span className={p1Won ? 'text-primary' : ''}>{g.score1}</span>
                      <span className="text-muted-foreground mx-1">:</span>
                      <span className={p2Won ? 'text-primary' : ''}>{g.score2}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground font-mono">
                      {g.sets.map((s, i) => (
                        <span key={i} className="mr-2">{s.score1}-{s.score2}</span>
                      ))}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground text-xs">
                      {g.venue ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => openEdit(g)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(g.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '숏게임 수정' : '숏게임 등록'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* 선수 정보 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>선수 1 이름 *</Label>
                <Input
                  value={form.player1_name}
                  onChange={e => setForm(f => ({ ...f, player1_name: e.target.value }))}
                  placeholder="이름"
                />
              </div>
              <div className="space-y-1.5">
                <Label>선수 1 소속</Label>
                <Input
                  value={form.player1_club}
                  onChange={e => setForm(f => ({ ...f, player1_club: e.target.value }))}
                  placeholder="소속 (선택)"
                />
              </div>
              <div className="space-y-1.5">
                <Label>선수 2 이름 *</Label>
                <Input
                  value={form.player2_name}
                  onChange={e => setForm(f => ({ ...f, player2_name: e.target.value }))}
                  placeholder="이름"
                />
              </div>
              <div className="space-y-1.5">
                <Label>선수 2 소속</Label>
                <Input
                  value={form.player2_club}
                  onChange={e => setForm(f => ({ ...f, player2_club: e.target.value }))}
                  placeholder="소속 (선택)"
                />
              </div>
            </div>

            {/* 경기 형식 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>세트 수</Label>
                <div className="flex gap-1">
                  {GAMES_PER_MATCH_OPTIONS.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleGamesPerMatchChange(n)}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        form.games_per_match === n
                          ? 'bg-primary text-primary-foreground'
                          : 'glass text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {n}세트
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>세트당 점수</Label>
                <div className="flex gap-1">
                  {POINTS_PER_GAME_OPTIONS.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, points_per_game: n }))}
                      className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        form.points_per_game === n
                          ? 'bg-primary text-primary-foreground'
                          : 'glass text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {n}점
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 세트별 점수 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>세트별 점수</Label>
                <span className="text-xs text-muted-foreground font-mono">
                  현재: {form.player1_name || '선수1'} {previewScore1} : {previewScore2} {form.player2_name || '선수2'}
                </span>
              </div>
              <div className="space-y-1.5">
                {sets.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-10 shrink-0">{i + 1}세트</span>
                    <Input
                      type="number"
                      min={0}
                      value={s.score1 || ''}
                      onChange={e => updateSet(i, 'score1', e.target.value)}
                      className="text-center"
                      placeholder="0"
                    />
                    <span className="text-muted-foreground">:</span>
                    <Input
                      type="number"
                      min={0}
                      value={s.score2 || ''}
                      onChange={e => updateSet(i, 'score2', e.target.value)}
                      className="text-center"
                      placeholder="0"
                    />
                    {sets.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSet(i)}
                        className="p-1 text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addSet}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 pt-1"
                >
                  <Plus className="w-3 h-3" /> 세트 추가
                </button>
              </div>
            </div>

            {/* 날짜 / 장소 / 메모 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>경기 날짜</Label>
                <Input
                  type="date"
                  value={form.played_at}
                  onChange={e => setForm(f => ({ ...f, played_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>장소 (선택)</Label>
                <Input
                  value={form.venue}
                  onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                  placeholder="경기 장소"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>메모 (선택)</Label>
              <Input
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="비고"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? '저장 중...' : editingId ? '수정' : '등록'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
