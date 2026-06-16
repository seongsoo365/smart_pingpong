'use client'

import { useState } from 'react'
import { Plus, Minus, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type EntryMode = 'simple' | 'detail'

const GAMES_PER_MATCH_OPTIONS = [3, 5, 7]
const POINTS_PER_GAME_OPTIONS = [11, 21]

interface SetScore { score1: number; score2: number }

function buildInitialSets(n: number): SetScore[] {
  return Array.from({ length: n }, () => ({ score1: 0, score2: 0 }))
}

function computeDetailScores(sets: SetScore[]) {
  return {
    score1: sets.filter(s => s.score1 > s.score2).length,
    score2: sets.filter(s => s.score2 > s.score1).length,
  }
}

const defaultForm = {
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

export default function NewGamePage() {
  const [mode, setMode] = useState<EntryMode>('simple')
  const [form, setForm] = useState(defaultForm)

  // 약식 모드 상태
  const [simpleScore1, setSimpleScore1] = useState<number | ''>('')
  const [simpleScore2, setSimpleScore2] = useState<number | ''>('')

  // 상세 모드 상태
  const [sets, setSets] = useState<SetScore[]>(buildInitialSets(5))

  const [saving, setSaving] = useState(false)
  const [finalScore, setFinalScore] = useState<{ s1: number; s2: number } | null>(null)
  const [error, setError] = useState('')

  function handleModeChange(next: EntryMode) {
    setMode(next)
    setError('')
  }

  function handleGamesPerMatchChange(n: number) {
    setForm(f => ({ ...f, games_per_match: n }))
    setSets(buildInitialSets(n))
  }

  function updateSet(idx: number, field: 'score1' | 'score2', raw: string) {
    const val = parseInt(raw, 10)
    setSets(prev => prev.map((s, i) => i === idx ? { ...s, [field]: isNaN(val) ? 0 : val } : s))
  }

  function addSet() { setSets(prev => [...prev, { score1: 0, score2: 0 }]) }
  function removeSet(idx: number) { setSets(prev => prev.filter((_, i) => i !== idx)) }

  async function handleSubmit() {
    setError('')
    if (!form.player1_name.trim() || !form.player2_name.trim()) {
      setError('두 선수의 이름을 모두 입력해주세요.')
      return
    }

    let payload: Record<string, unknown>

    if (mode === 'simple') {
      const s1 = Number(simpleScore1)
      const s2 = Number(simpleScore2)
      if (simpleScore1 === '' || simpleScore2 === '') {
        setError('세트 점수를 입력해주세요.')
        return
      }
      if (s1 < 0 || s2 < 0 || (s1 === 0 && s2 === 0)) {
        setError('올바른 세트 점수를 입력해주세요.')
        return
      }
      payload = { ...form, sets: [], score1: s1, score2: s2 }
      setFinalScore({ s1, s2 })
    } else {
      const validSets = sets.filter(s => s.score1 > 0 || s.score2 > 0)
      if (validSets.length === 0) {
        setError('세트 점수를 최소 1세트 입력해주세요.')
        return
      }
      const { score1, score2 } = computeDetailScores(validSets)
      payload = { ...form, sets: validSets }
      setFinalScore({ s1: score1, s2: score2 })
    }

    setSaving(true)
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? '등록 실패')
      }
    } catch (e) {
      setFinalScore(null)
      setError(e instanceof Error ? e.message : '등록 중 오류가 발생했습니다.')
      setSaving(false)
      return
    }
    setSaving(false)
  }

  function handleReset() {
    setForm(defaultForm)
    setSimpleScore1('')
    setSimpleScore2('')
    setSets(buildInitialSets(5))
    setFinalScore(null)
    setError('')
  }

  const detailScore = computeDetailScores(sets)

  // 등록 완료 화면
  if (finalScore) {
    const p1Won = finalScore.s1 > finalScore.s2
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-6">
        <CheckCircle className="w-16 h-16 text-primary mx-auto" />
        <div>
          <h1 className="text-2xl font-bold">게임이 등록됐습니다!</h1>
          <p className="text-muted-foreground text-sm mt-2">
            {form.player1_name} vs {form.player2_name} · {finalScore.s1}:{finalScore.s2}
            {' '}({p1Won ? form.player1_name : form.player2_name} 승)
          </p>
        </div>
        <div className="flex gap-3 justify-center">
          <Button onClick={handleReset} variant="outline">한 게임 더 등록</Button>
          <a
            href="/players"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            전적 조회
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">게임 기록 등록</h1>
        <p className="text-muted-foreground text-sm mt-1">
          1:1 단식 경기 결과를 기록합니다. 로그인 없이 등록할 수 있습니다.
        </p>
      </div>

      {/* 선수 정보 */}
      <div className="glass rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">선수 정보</h2>
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
            <Label>소속</Label>
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
            <Label>소속</Label>
            <Input
              value={form.player2_club}
              onChange={e => setForm(f => ({ ...f, player2_club: e.target.value }))}
              placeholder="소속 (선택)"
            />
          </div>
        </div>
      </div>

      {/* 세트 점수 입력 */}
      <div className="glass rounded-xl p-5 space-y-4">
        {/* 모드 탭 */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">세트 점수 입력</h2>
          <div className="flex rounded-lg overflow-hidden border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => handleModeChange('simple')}
              className={`px-3 py-1.5 font-medium transition-colors ${
                mode === 'simple'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              약식 등록
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('detail')}
              className={`px-3 py-1.5 font-medium transition-colors border-l border-white/10 ${
                mode === 'detail'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              세트별 등록
            </button>
          </div>
        </div>

        {/* 약식 모드 */}
        {mode === 'simple' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">최종 세트 점수만 입력합니다. (예: 3:1)</p>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground mb-1.5 truncate">
                  {form.player1_name || '선수 1'}
                </p>
                <Input
                  type="number"
                  min={0}
                  value={simpleScore1}
                  onChange={e => setSimpleScore1(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className={`text-center text-2xl font-bold h-14 ${
                    Number(simpleScore1) > Number(simpleScore2) && simpleScore1 !== '' && simpleScore2 !== ''
                      ? 'border-primary text-primary'
                      : ''
                  }`}
                  placeholder="0"
                />
              </div>
              <span className="text-2xl font-bold text-muted-foreground shrink-0 mt-5">:</span>
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground mb-1.5 truncate">
                  {form.player2_name || '선수 2'}
                </p>
                <Input
                  type="number"
                  min={0}
                  value={simpleScore2}
                  onChange={e => setSimpleScore2(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                  className={`text-center text-2xl font-bold h-14 ${
                    Number(simpleScore2) > Number(simpleScore1) && simpleScore1 !== '' && simpleScore2 !== ''
                      ? 'border-primary text-primary'
                      : ''
                  }`}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* 세트별 상세 모드 */}
        {mode === 'detail' && (
          <div className="space-y-4">
            {/* 경기 형식 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">세트 수</Label>
                <div className="flex gap-1">
                  {GAMES_PER_MATCH_OPTIONS.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => handleGamesPerMatchChange(n)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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
                <Label className="text-xs">세트당 점수</Label>
                <div className="flex gap-1">
                  {POINTS_PER_GAME_OPTIONS.map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, points_per_game: n }))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
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

            {/* 세트별 점수 입력 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">세트별 점수</span>
                {(detailScore.score1 > 0 || detailScore.score2 > 0) && (
                  <span className="text-xs font-mono font-semibold">
                    <span className={detailScore.score1 > detailScore.score2 ? 'text-primary' : 'text-muted-foreground'}>
                      {form.player1_name || '선수1'} {detailScore.score1}
                    </span>
                    <span className="text-muted-foreground mx-1">:</span>
                    <span className={detailScore.score2 > detailScore.score1 ? 'text-primary' : 'text-muted-foreground'}>
                      {detailScore.score2} {form.player2_name || '선수2'}
                    </span>
                  </span>
                )}
              </div>
              {sets.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-10 shrink-0 text-right">{i + 1}세트</span>
                  <Input
                    type="number"
                    min={0}
                    value={s.score1 || ''}
                    onChange={e => updateSet(i, 'score1', e.target.value)}
                    className="text-center"
                    placeholder="0"
                  />
                  <span className="text-muted-foreground shrink-0">:</span>
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
                      className="p-1 text-muted-foreground hover:text-red-400 transition-colors shrink-0"
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
        )}
      </div>

      {/* 기타 정보 */}
      <div className="glass rounded-xl p-5 space-y-3">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">기타 정보</h2>
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
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <Button onClick={handleSubmit} disabled={saving} className="w-full" size="lg">
        {saving ? '등록 중...' : '게임 등록'}
      </Button>
    </div>
  )
}
