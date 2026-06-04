'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Gender, MatchType, TeamMatchFormat } from '@/lib/types'

interface DivisionForm {
  name: string
  gender: Gender
  match_type: MatchType
  team_match_format: TeamMatchFormat | ''
  display_order: number
  has_preliminary: boolean
  prelim_format: 'round_robin' | 'group_knockout'
  main_format: 'single_elimination'
  games_per_match: number
  advancement_count: number
}

const TEAM_FORMAT_GAMES: Record<TeamMatchFormat, number> = {
  olympic: 5,
  traditional_4s1d: 5,
  swaythling: 9,
  singles_2_doubles_1: 3,
  three_doubles: 3,
  three_singles: 3,
}

const TEAM_FORMAT_LABEL: Record<TeamMatchFormat, string> = {
  olympic: '올림픽 공식 — 3인, 5전3선(복·단·단·단)',
  traditional_4s1d: '4단 1복 — 최소4인, 5전3선(단·단·복·단·단)',
  swaythling: '스웨이틀링 컵 — 3명, 9전5선',
  singles_2_doubles_1: '2단 1복 — 2-3명, 3전2선(단·복·단)',
  three_doubles: '3복식 — 6명, 3전2선(복·복·복)',
  three_singles: '3단식 — 3명, 3전2선(단·단·단)',
}

const defaultDivision = (): DivisionForm => ({
  name: '1부',
  gender: 'male',
  match_type: 'individual',
  team_match_format: '',
  display_order: 0,
  has_preliminary: false,
  prelim_format: 'round_robin',
  main_format: 'single_elimination',
  games_per_match: 3,
  advancement_count: 2,
})

export default function NewTournamentPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: '',
    venue: '',
    description: '',
    start_date: '',
    end_date: '',
    registration_start: '',
    registration_end: '',
    status: 'draft' as const,
  })
  const [divisions, setDivisions] = useState<DivisionForm[]>([defaultDivision()])

  function updateField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function updateDivision(idx: number, key: keyof DivisionForm, value: string | boolean | number) {
    setDivisions(prev => prev.map((d, i) => {
      if (i !== idx) return d
      const updated = { ...d, [key]: value }
      if (key === 'team_match_format' && typeof value === 'string' && value in TEAM_FORMAT_GAMES) {
        updated.games_per_match = TEAM_FORMAT_GAMES[value as TeamMatchFormat]
      }
      if (key === 'match_type' && value === 'individual') {
        updated.team_match_format = ''
        updated.games_per_match = 3
      }
      return updated
    }))
  }

  function addDivision() {
    setDivisions(prev => [...prev, { ...defaultDivision(), display_order: prev.length }])
  }

  function removeDivision(idx: number) {
    setDivisions(prev => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (divisions.length === 0) { toast.error('부수를 최소 1개 추가하세요'); return }

    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: tournament, error: tErr } = await supabase
      .from('tournaments')
      .insert({ ...form, created_by: user!.id, admin_id: user!.id })
      .select()
      .single()

    if (tErr || !tournament) {
      toast.error('대회 생성 실패: ' + tErr?.message)
      setLoading(false)
      return
    }

    for (const [i, div] of divisions.entries()) {
      const { data: dbDiv, error: dErr } = await supabase
        .from('divisions')
        .insert({
          tournament_id: tournament.id,
          name: div.name,
          gender: div.gender,
          match_type: div.match_type,
          team_match_format: div.team_match_format || null,
          display_order: i,
        })
        .select()
        .single()

      if (dErr || !dbDiv) continue

      if (div.has_preliminary) {
        await supabase.from('tournament_phases').insert({
          division_id: dbDiv.id,
          phase_type: 'preliminary',
          phase_order: 1,
          format: div.prelim_format,
          games_per_match: div.games_per_match,
          points_per_game: 11,
          advancement_count: div.advancement_count,
        })
      }

      await supabase.from('tournament_phases').insert({
        division_id: dbDiv.id,
        phase_type: 'main',
        phase_order: div.has_preliminary ? 2 : 1,
        format: div.main_format,
        games_per_match: div.games_per_match,
        points_per_game: 11,
      })
    }

    toast.success('대회가 생성되었습니다')
    router.push(`/admin/tournaments/${tournament.id}/edit`)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 glass rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-2xl font-bold">대회 등록</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <section className="glass rounded-2xl p-6 border border-white/10 space-y-4">
          <h2 className="font-semibold">기본 정보</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm font-medium">대회명 *</label>
              <input required value={form.name} onChange={e => updateField('name', e.target.value)}
                placeholder="예) 2026 춘계 탁구 대회"
                className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm font-medium">장소 *</label>
              <input required value={form.venue} onChange={e => updateField('venue', e.target.value)}
                placeholder="예) 서울 탁구 체육관"
                className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">시작일 *</label>
              <input required type="date" value={form.start_date} onChange={e => updateField('start_date', e.target.value)}
                className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">종료일 *</label>
              <input required type="date" value={form.end_date} onChange={e => updateField('end_date', e.target.value)}
                className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">접수 시작</label>
              <input type="date" value={form.registration_start} onChange={e => updateField('registration_start', e.target.value)}
                className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">접수 마감</label>
              <input type="date" value={form.registration_end} onChange={e => updateField('registration_end', e.target.value)}
                className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm font-medium">상태</label>
              <select value={form.status} onChange={e => updateField('status', e.target.value)}
                className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:border-primary">
                <option value="draft">준비 중</option>
                <option value="registration">접수 중</option>
                <option value="in_progress">진행 중</option>
                <option value="completed">종료</option>
              </select>
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-sm font-medium">대회 소개</label>
              <textarea value={form.description} onChange={e => updateField('description', e.target.value)}
                rows={3} placeholder="대회에 대한 간단한 설명"
                className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary resize-none" />
            </div>
          </div>
        </section>

        {/* Divisions */}
        <section className="glass rounded-2xl p-6 border border-white/10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">부수 설정</h2>
            <button type="button" onClick={addDivision}
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Plus className="w-4 h-4" /> 부수 추가
            </button>
          </div>

          {divisions.map((div, idx) => (
            <div key={idx} className="rounded-xl border border-white/10 p-4 space-y-4 bg-white/5">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">부수 {idx + 1}</span>
                {divisions.length > 1 && (
                  <button type="button" onClick={() => removeDivision(idx)}
                    className="text-destructive hover:opacity-80 transition-opacity">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">부수명</label>
                  <input value={div.name} onChange={e => updateDivision(idx, 'name', e.target.value)}
                    placeholder="1부" className="w-full glass border border-white/10 rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-primary" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">성별</label>
                  <select value={div.gender} onChange={e => updateDivision(idx, 'gender', e.target.value)}
                    className="w-full glass border border-white/10 rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary">
                    <option value="male">남자</option>
                    <option value="female">여자</option>
                    <option value="mixed">혼합</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">경기 유형</label>
                  <select value={div.match_type} onChange={e => updateDivision(idx, 'match_type', e.target.value)}
                    className="w-full glass border border-white/10 rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary">
                    <option value="individual">개인전</option>
                    <option value="team">단체전</option>
                  </select>
                </div>
                {div.match_type === 'individual' ? (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">경기 방식 (게임 수)</label>
                    <select value={div.games_per_match} onChange={e => updateDivision(idx, 'games_per_match', Number(e.target.value))}
                      className="w-full glass border border-white/10 rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary">
                      <option value={3}>3판 2선</option>
                      <option value={5}>5판 3선</option>
                      <option value={7}>7판 4선</option>
                    </select>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">단체전 방식</label>
                    <select value={div.team_match_format} onChange={e => updateDivision(idx, 'team_match_format', e.target.value)}
                      className="w-full glass border border-white/10 rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary">
                      <option value="">-- 방식 선택 --</option>
                      {(Object.entries(TEAM_FORMAT_LABEL) as [TeamMatchFormat, string][]).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="col-span-2 sm:col-span-1 flex items-center gap-2 pt-6">
                  <input type="checkbox" id={`prelim-${idx}`} checked={div.has_preliminary}
                    onChange={e => updateDivision(idx, 'has_preliminary', e.target.checked)}
                    className="w-4 h-4 accent-primary" />
                  <label htmlFor={`prelim-${idx}`} className="text-sm font-medium">예선전 있음</label>
                </div>
              </div>

              {div.has_preliminary && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">예선 방식</label>
                    <select value={div.prelim_format} onChange={e => updateDivision(idx, 'prelim_format', e.target.value)}
                      className="w-full glass border border-white/10 rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary">
                      <option value="round_robin">조별 리그</option>
                      <option value="group_knockout">조별 리그 + 토너먼트</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">조당 본선 진출 수</label>
                    <input type="number" min={1} max={8} value={div.advancement_count}
                      onChange={e => updateDivision(idx, 'advancement_count', Number(e.target.value))}
                      className="w-full glass border border-white/10 rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-primary" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>

        <div className="flex gap-3 justify-end">
          <Link href="/admin" className="px-6 py-2.5 glass border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors">
            취소
          </Link>
          <button type="submit" disabled={loading}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
            {loading ? '저장 중...' : '대회 등록'}
          </button>
        </div>
      </form>
    </div>
  )
}
