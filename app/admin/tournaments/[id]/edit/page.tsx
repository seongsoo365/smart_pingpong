'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { ChevronLeft, Users, GitBranch, ClipboardList, Plus, Trash2, Save, ExternalLink, Pencil, Check, X, FileCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Tournament, Division, Gender, MatchType, TeamMatchFormat } from '@/lib/types'

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }
const matchTypeLabel: Record<string, string> = { individual: '개인전', team: '단체전' }

const TEAM_FORMAT_LABEL: Record<TeamMatchFormat, string> = {
  olympic: '올림픽 공식 — 3인, 5전3선(복·단·단·단)',
  traditional_4s1d: '4단 1복 — 최소4인, 5전3선(단·단·복·단·단)',
  swaythling: '스웨이틀링 컵 — 3명, 9전5선',
  singles_2_doubles_1: '2단 1복 — 2-3명, 3전2선(단·복·단)',
  three_doubles: '3복식 — 6명, 3전2선(복·복·복)',
  three_singles: '3단식 — 3명, 3전2선(단·단·단)',
}

interface DivisionForm { name: string; gender: Gender; match_type: MatchType; team_match_format: TeamMatchFormat | ''; max_teams: number | '' }
type NewDivisionForm = DivisionForm
const defaultNewDiv = (): DivisionForm => ({ name: '', gender: 'male', match_type: 'individual', team_match_format: '', max_teams: '' })

export default function TournamentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const supabase = createClient()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [divisions, setDivisions] = useState<Division[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', venue: '', description: '', start_date: '', end_date: '',
    registration_start: '', registration_end: '', status: 'draft',
  })
  const [showDivForm, setShowDivForm] = useState(false)
  const [newDiv, setNewDiv] = useState<NewDivisionForm>(defaultNewDiv())
  const [addingDiv, setAddingDiv] = useState(false)
  const [editingDivId, setEditingDivId] = useState<string | null>(null)
  const [editDiv, setEditDiv] = useState<DivisionForm>(defaultNewDiv())
  const [savingDiv, setSavingDiv] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: t }, { data: d }] = await Promise.all([
        supabase.from('tournaments').select('*').eq('id', id).single(),
        supabase.from('divisions').select('*').eq('tournament_id', id).order('display_order'),
      ])
      if (t) {
        setTournament(t)
        setForm({
          name: t.name ?? '',
          venue: t.venue ?? '',
          description: t.description ?? '',
          start_date: t.start_date ?? '',
          end_date: t.end_date ?? '',
          registration_start: t.registration_start ?? '',
          registration_end: t.registration_end ?? '',
          status: t.status ?? 'draft',
        })
      }
      setDivisions(d ?? [])
    }
    load()
  }, [id])

  function updateField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch(`/api/tournaments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) {
      const updated = await res.json()
      setTournament(updated)
      toast.success('대회 정보가 저장되었습니다')
    } else {
      const err = await res.json()
      toast.error('저장 실패: ' + err.error)
    }
    setSaving(false)
  }

  async function handleAddDivision(e: React.FormEvent) {
    e.preventDefault()
    if (!newDiv.name.trim()) { toast.error('부수명을 입력하세요'); return }
    setAddingDiv(true)
    const res = await fetch('/api/divisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tournament_id: id,
        ...newDiv,
        team_match_format: newDiv.team_match_format || null,
        max_teams: newDiv.max_teams !== '' ? Number(newDiv.max_teams) : null,
        display_order: divisions.length,
      }),
    })
    if (res.ok) {
      const created = await res.json()
      setDivisions(prev => [...prev, created])
      setNewDiv(defaultNewDiv())
      setShowDivForm(false)
      toast.success(`${genderLabel[newDiv.gender]} ${newDiv.name} 부수가 추가되었습니다`)
    } else {
      const err = await res.json()
      toast.error('추가 실패: ' + err.error)
    }
    setAddingDiv(false)
  }

  function startEditDiv(div: Division) {
    setEditingDivId(div.id)
    setEditDiv({ name: div.name, gender: div.gender, match_type: div.match_type, team_match_format: div.team_match_format ?? '', max_teams: div.max_teams ?? '' })
  }

  async function handleSaveDivision(e: React.FormEvent) {
    e.preventDefault()
    if (!editingDivId || !editDiv.name.trim()) return
    setSavingDiv(true)
    const res = await fetch(`/api/divisions/${editingDivId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editDiv, team_match_format: editDiv.team_match_format || null, max_teams: editDiv.max_teams !== '' ? Number(editDiv.max_teams) : null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setDivisions(prev => prev.map(d => d.id === editingDivId ? updated : d))
      setEditingDivId(null)
      toast.success('부수 정보가 수정되었습니다')
    } else {
      const err = await res.json()
      toast.error('수정 실패: ' + err.error)
    }
    setSavingDiv(false)
  }

  async function handleDeleteDivision(div: Division) {
    if (!confirm(`"${genderLabel[div.gender]} ${div.name}" 부수를 삭제하시겠습니까?\n(경기가 생성된 경우 삭제 불가)`)) return
    const res = await fetch(`/api/divisions/${div.id}`, { method: 'DELETE' })
    if (res.ok) {
      setDivisions(prev => prev.filter(d => d.id !== div.id))
      toast.success('부수가 삭제되었습니다')
    } else {
      const err = await res.json()
      toast.error(err.error)
    }
  }

  if (!tournament) {
    return (
      <div className="max-w-4xl mx-auto pt-20 text-center text-muted-foreground">
        불러오는 중...
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="p-2 glass rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{tournament.name}</h1>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full status-${tournament.status}`}>
            {form.status === 'draft' ? '준비 중' : form.status === 'registration' ? '접수 중' : form.status === 'in_progress' ? '진행 중' : '종료'}
          </span>
        </div>
        <Link href={`/tournaments/${id}`} target="_blank"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground glass px-3 py-1.5 rounded-lg border border-white/10 transition-colors">
          <ExternalLink className="w-3.5 h-3.5" /> 공개 페이지
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: `/admin/tournaments/${id}/players`,       icon: Users,        label: '선수 관리' },
          { href: `/admin/tournaments/${id}/registrations`, icon: FileCheck,    label: '접수 관리' },
          { href: `/admin/tournaments/${id}/draw`,          icon: GitBranch,    label: '대진표 생성' },
          { href: `/admin/tournaments/${id}/scores`,        icon: ClipboardList,label: '결과 입력' },
        ].map(({ href, icon: Icon, label }) => (
          <Link key={href} href={href}
            className="glass rounded-xl p-4 border border-white/10 hover:bg-white/10 hover:border-primary/30 transition-all group text-center">
            <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
            <div className="text-sm font-medium group-hover:text-primary transition-colors">{label}</div>
          </Link>
        ))}
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSave} className="glass rounded-2xl p-6 border border-white/10 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">대회 정보 수정</h2>
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-2 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
            <Save className="w-3.5 h-3.5" />
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">대회명 *</label>
            <input required value={form.name} onChange={e => updateField('name', e.target.value)}
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">장소 *</label>
            <input required value={form.venue} onChange={e => updateField('venue', e.target.value)}
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">시작일 *</label>
            <input required type="date" value={form.start_date} onChange={e => updateField('start_date', e.target.value)}
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">종료일 *</label>
            <input required type="date" value={form.end_date} onChange={e => updateField('end_date', e.target.value)}
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">접수 시작</label>
            <input type="date" value={form.registration_start} onChange={e => updateField('registration_start', e.target.value)}
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">접수 마감</label>
            <input type="date" value={form.registration_end} onChange={e => updateField('registration_end', e.target.value)}
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">대회 상태</label>
            <select value={form.status} onChange={e => updateField('status', e.target.value)}
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:border-primary transition-colors">
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
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors resize-none" />
          </div>
        </div>
      </form>

      {/* Division Management */}
      <section className="glass rounded-2xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">부수 관리 ({divisions.length}개)</h2>
          <button onClick={() => setShowDivForm(!showDivForm)}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity">
            <Plus className="w-4 h-4" /> 부수 추가
          </button>
        </div>

        {/* Existing divisions */}
        {divisions.length > 0 ? (
          <div className="space-y-2">
            {divisions.map(div => (
              <div key={div.id} className="rounded-xl bg-white/5 px-4 py-3">
                {editingDivId === div.id ? (
                  <form onSubmit={handleSaveDivision} className="flex flex-wrap items-end gap-2">
                    <div className="space-y-1 flex-1 min-w-28">
                      <label className="text-xs text-muted-foreground">부수명</label>
                      <input required value={editDiv.name}
                        onChange={e => setEditDiv(p => ({ ...p, name: e.target.value }))}
                        className="w-full glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">성별</label>
                      <select value={editDiv.gender} onChange={e => setEditDiv(p => ({ ...p, gender: e.target.value as Gender }))}
                        className="glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-background outline-none focus:border-primary">
                        <option value="male">남자</option>
                        <option value="female">여자</option>
                        <option value="mixed">혼합</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">경기 유형</label>
                      <select value={editDiv.match_type} onChange={e => setEditDiv(p => ({ ...p, match_type: e.target.value as MatchType, team_match_format: '' }))}
                        className="glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-background outline-none focus:border-primary">
                        <option value="individual">개인전</option>
                        <option value="team">단체전</option>
                      </select>
                    </div>
                    {editDiv.match_type === 'team' && (
                      <>
                        <div className="space-y-1 w-full sm:w-auto">
                          <label className="text-xs text-muted-foreground">단체전 방식</label>
                          <select value={editDiv.team_match_format} onChange={e => setEditDiv(p => ({ ...p, team_match_format: e.target.value as TeamMatchFormat | '' }))}
                            className="glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-background outline-none focus:border-primary w-full">
                            <option value="">-- 방식 선택 --</option>
                            {(Object.entries(TEAM_FORMAT_LABEL) as [TeamMatchFormat, string][]).map(([val, label]) => (
                              <option key={val} value={val}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">최대 참가팀</label>
                          <input
                            type="number" min={1} placeholder="제한 없음"
                            value={editDiv.max_teams}
                            onChange={e => setEditDiv(p => ({ ...p, max_teams: e.target.value === '' ? '' : Number(e.target.value) }))}
                            className="w-24 glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                        </div>
                      </>
                    )}
                    <div className="flex gap-1.5">
                      <button type="submit" disabled={savingDiv}
                        className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingDivId(null)}
                        className="p-2 glass border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">{genderLabel[div.gender]} {div.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{matchTypeLabel[div.match_type]}</span>
                      {div.match_type === 'team' && div.team_match_format && (
                        <span className="text-xs text-accent ml-2">{TEAM_FORMAT_LABEL[div.team_match_format]}</span>
                      )}
                      {div.match_type === 'team' && div.max_teams && (
                        <span className="text-xs text-muted-foreground ml-2">최대 {div.max_teams}팀</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/tournaments/${id}/players?divId=${div.id}`}
                        className="text-xs px-3 py-1.5 glass border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                        선수 관리
                      </Link>
                      <button onClick={() => startEditDiv(div)}
                        className="p-1.5 text-muted-foreground hover:text-primary transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => handleDeleteDivision(div)}
                        className="p-1.5 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-3">등록된 부수가 없습니다</p>
        )}

        {/* Add division form */}
        {showDivForm && (
          <form onSubmit={handleAddDivision}
            className="border-t border-white/10 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2 sm:col-span-1 space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">부수명 *</label>
              <input value={newDiv.name} onChange={e => setNewDiv(p => ({ ...p, name: e.target.value }))}
                placeholder="예) 1부, 2부" required
                className="w-full glass border border-white/10 rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">성별</label>
              <select value={newDiv.gender} onChange={e => setNewDiv(p => ({ ...p, gender: e.target.value as Gender }))}
                className="w-full glass border border-white/10 rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary">
                <option value="male">남자</option>
                <option value="female">여자</option>
                <option value="mixed">혼합</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">경기 유형</label>
              <select value={newDiv.match_type} onChange={e => setNewDiv(p => ({ ...p, match_type: e.target.value as MatchType, team_match_format: '' }))}
                className="w-full glass border border-white/10 rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary">
                <option value="individual">개인전</option>
                <option value="team">단체전</option>
              </select>
            </div>
            {newDiv.match_type === 'team' && (
              <>
                <div className="col-span-2 sm:col-span-3 space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">단체전 방식</label>
                  <select value={newDiv.team_match_format} onChange={e => setNewDiv(p => ({ ...p, team_match_format: e.target.value as TeamMatchFormat | '' }))}
                    className="w-full glass border border-white/10 rounded-lg px-3 py-2 text-sm bg-background outline-none focus:border-primary">
                    <option value="">-- 방식 선택 --</option>
                    {(Object.entries(TEAM_FORMAT_LABEL) as [TeamMatchFormat, string][]).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">최대 참가팀</label>
                  <input
                    type="number" min={1} placeholder="제한 없음"
                    value={newDiv.max_teams}
                    onChange={e => setNewDiv(p => ({ ...p, max_teams: e.target.value === '' ? '' : Number(e.target.value) }))}
                    className="w-full glass border border-white/10 rounded-lg px-3 py-2 text-sm bg-transparent outline-none focus:border-primary" />
                </div>
              </>
            )}
            <div className="flex items-end gap-2 col-span-2 sm:col-span-4">
              <button type="submit" disabled={addingDiv}
                className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                {addingDiv ? '...' : '추가'}
              </button>
              <button type="button" onClick={() => { setShowDivForm(false); setNewDiv(defaultNewDiv()) }}
                className="flex-1 glass border border-white/10 py-2 rounded-lg text-sm hover:bg-white/10 transition-colors">
                취소
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  )
}
