'use client'
import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeft, Users, GitBranch, ClipboardList, Plus, Trash2, Save, ExternalLink, Pencil, Check, X, FileCheck, Settings2, MessageCircle, AlertTriangle, UserCog, Search, RotateCcw } from 'lucide-react'
import { HelpPopover } from '@/components/ui/help-popover'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Tournament, Division, TournamentPhase, Gender, MatchType, TeamMatchFormat, PhaseFormat, UserProfile, TournamentAdmin } from '@/lib/types'

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

const PHASE_FORMAT_LABEL: Record<string, string> = {
  round_robin: '리그',
  single_elimination: '단일 토너먼트',
}

const TEAM_FORMAT_SHORT: Record<string, string> = {
  olympic: '올림픽',
  traditional_4s1d: '4단1복',
  swaythling: '스웨이틀링',
  singles_2_doubles_1: '2단1복',
  three_doubles: '3복식',
  three_singles: '3단식',
}

interface DivisionForm { name: string; gender: Gender; match_type: MatchType; team_match_format: TeamMatchFormat | ''; max_teams: number | '' }
type NewDivisionForm = DivisionForm
const defaultNewDiv = (): DivisionForm => ({ name: '', gender: 'male', match_type: 'individual', team_match_format: '', max_teams: '' })

interface PhaseEdit {
  hasPrelim: boolean
  prelim: { format: PhaseFormat; games_per_match: number; points_per_game: number; advancement_count: number; team_match_format: TeamMatchFormat | '' }
  main: { format: PhaseFormat; games_per_match: number; points_per_game: number; team_match_format: TeamMatchFormat | '' }
}
function defaultPhaseEdit(): PhaseEdit {
  return {
    hasPrelim: false,
    prelim: { format: 'round_robin', games_per_match: 5, points_per_game: 11, advancement_count: 2, team_match_format: '' },
    main: { format: 'single_elimination', games_per_match: 5, points_per_game: 11, team_match_format: '' },
  }
}

export default function TournamentEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [divisions, setDivisions] = useState<Division[]>([])
  const [phasesMap, setPhasesMap] = useState<Record<string, TournamentPhase[]>>({})
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', venue: '', description: '', regulations: '', start_date: '', end_date: '',
    registration_start: '', registration_end: '', status: 'draft',
  })
  const [showDivForm, setShowDivForm] = useState(false)
  const [newDiv, setNewDiv] = useState<NewDivisionForm>(defaultNewDiv())
  const [addingDiv, setAddingDiv] = useState(false)
  const [editingDivId, setEditingDivId] = useState<string | null>(null)
  const [editDiv, setEditDiv] = useState<DivisionForm>(defaultNewDiv())
  const [savingDiv, setSavingDiv] = useState(false)
  const [editingPhaseDivId, setEditingPhaseDivId] = useState<string | null>(null)
  const [phaseEdit, setPhaseEdit] = useState<PhaseEdit>(defaultPhaseEdit())
  const [savingPhase, setSavingPhase] = useState(false)

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isSystemAdmin, setIsSystemAdmin] = useState(false)
  const [currentAdmin, setCurrentAdmin] = useState<UserProfile | null>(null)
  const [delegateSearch, setDelegateSearch] = useState('')
  const [delegateResults, setDelegateResults] = useState<UserProfile[]>([])
  const [selectedDelegate, setSelectedDelegate] = useState<UserProfile | null>(null)
  const [savingDelegate, setSavingDelegate] = useState(false)
  const [showDelegateResults, setShowDelegateResults] = useState(false)

  // 공동 관리자
  const [coAdmins, setCoAdmins] = useState<UserProfile[]>([])
  const [coAdminSearch, setCoAdminSearch] = useState('')
  const [coAdminResults, setCoAdminResults] = useState<UserProfile[]>([])
  const [showCoAdminResults, setShowCoAdminResults] = useState(false)
  const [addingCoAdmin, setAddingCoAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      const [{ data: { user } }, { data: t }, { data: d }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('tournaments').select('*').eq('id', id).single(),
        supabase.from('divisions').select('*').eq('tournament_id', id).order('display_order'),
      ])
      if (user) {
        setCurrentUserId(user.id)
        const { data: profile } = await supabase
          .from('user_profiles').select('role').eq('id', user.id).single()
        if (profile?.role === 'system_admin') setIsSystemAdmin(true)
      }
      if (t) {
        setTournament(t)
        setForm({
          name: t.name ?? '',
          venue: t.venue ?? '',
          description: t.description ?? '',
          regulations: t.regulations ?? '',
          start_date: t.start_date ?? '',
          end_date: t.end_date ?? '',
          registration_start: t.registration_start ?? '',
          registration_end: t.registration_end ?? '',
          status: t.status ?? 'draft',
        })
        // 위임 관리자 프로필 로드 (created_by와 admin_id가 다를 때만)
        if (t.admin_id && t.admin_id !== t.created_by) {
          const { data: adminProfile } = await supabase
            .from('user_profiles').select('id, name, email, role').eq('id', t.admin_id).single()
          if (adminProfile) setCurrentAdmin(adminProfile as UserProfile)
        }
        // 공동 관리자 목록 로드
        const coAdminsRes = await fetch(`/api/tournaments/${id}/admins`)
        if (coAdminsRes.ok) {
          const coAdminsData = await coAdminsRes.json() as (TournamentAdmin & { user: UserProfile })[]
          setCoAdmins(coAdminsData.map(ca => ca.user).filter(Boolean))
        }
      }
      const divList = d ?? []
      setDivisions(divList)
      if (divList.length > 0) {
        const divIds = divList.map(div => div.id)
        const { data: phases } = await supabase
          .from('tournament_phases').select('*').in('division_id', divIds).order('phase_order')
        const map: Record<string, TournamentPhase[]> = {}
        for (const ph of phases ?? []) {
          if (!map[ph.division_id]) map[ph.division_id] = []
          map[ph.division_id].push(ph)
        }
        setPhasesMap(map)
      }
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

  async function searchUsers(q: string) {
    setDelegateSearch(q)
    if (!q.trim()) { setDelegateResults([]); setShowDelegateResults(false); return }
    const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`)
    if (res.ok) {
      const data = await res.json()
      setDelegateResults(data)
      setShowDelegateResults(true)
    }
  }

  async function searchCoAdminUsers(q: string) {
    setCoAdminSearch(q)
    if (!q.trim()) { setCoAdminResults([]); setShowCoAdminResults(false); return }
    const res = await fetch(`/api/admin/users/search?q=${encodeURIComponent(q)}`)
    if (res.ok) {
      const data: UserProfile[] = await res.json()
      // 이미 추가된 공동 관리자 및 대표 관리자 제외
      const existingIds = new Set([
        ...coAdmins.map(ca => ca.id),
        tournament?.admin_id,
        tournament?.created_by,
        currentUserId,
      ])
      setCoAdminResults(data.filter(u => !existingIds.has(u.id)))
      setShowCoAdminResults(true)
    }
  }

  async function handleAddCoAdmin(u: UserProfile) {
    setAddingCoAdmin(true)
    setCoAdminSearch('')
    setCoAdminResults([])
    setShowCoAdminResults(false)
    const res = await fetch(`/api/tournaments/${id}/admins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: u.id }),
    })
    if (res.ok) {
      setCoAdmins(prev => [...prev, u])
      toast.success(`${u.name}님을 공동 관리자로 추가했습니다`)
    } else {
      const err = await res.json()
      toast.error('추가 실패: ' + err.error)
    }
    setAddingCoAdmin(false)
  }

  async function handleRemoveCoAdmin(u: UserProfile) {
    if (!confirm(`"${u.name}"의 공동 관리자 권한을 제거하시겠습니까?`)) return
    const res = await fetch(`/api/tournaments/${id}/admins/${u.id}`, { method: 'DELETE' })
    if (res.ok) {
      setCoAdmins(prev => prev.filter(ca => ca.id !== u.id))
      toast.success(`${u.name}님의 공동 관리자 권한이 제거되었습니다`)
    } else {
      const err = await res.json()
      toast.error('제거 실패: ' + err.error)
    }
  }

  async function handleSaveDelegate(newAdminId: string) {
    setSavingDelegate(true)
    const res = await fetch(`/api/tournaments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_id: newAdminId }),
    })
    if (res.ok) {
      const updated = await res.json()
      setTournament(updated)
      if (newAdminId !== currentUserId) {
        const { data: adminProfile } = await supabase
          .from('user_profiles').select('id, name, email, role').eq('id', newAdminId).single()
        setCurrentAdmin(adminProfile as UserProfile)
      } else {
        setCurrentAdmin(null)
      }
      setSelectedDelegate(null)
      setDelegateSearch('')
      setDelegateResults([])
      setShowDelegateResults(false)
      toast.success('관리자 권한이 위임되었습니다')
    } else {
      const err = await res.json()
      toast.error('위임 실패: ' + err.error)
    }
    setSavingDelegate(false)
  }

  function openPhaseEditor(divId: string) {
    if (editingPhaseDivId === divId) {
      setEditingPhaseDivId(null)
      return
    }
    const phases = phasesMap[divId] ?? []
    const prelim = phases.find(p => p.phase_type === 'preliminary')
    const main = phases.find(p => p.phase_type === 'main')
    setPhaseEdit({
      hasPrelim: !!prelim,
      prelim: {
        format: (prelim?.format ?? 'round_robin') as PhaseFormat,
        games_per_match: prelim?.games_per_match ?? 5,
        points_per_game: prelim?.points_per_game ?? 11,
        advancement_count: prelim?.advancement_count ?? 2,
        team_match_format: (prelim?.team_match_format ?? '') as TeamMatchFormat | '',
      },
      main: {
        format: (main?.format ?? 'single_elimination') as PhaseFormat,
        games_per_match: main?.games_per_match ?? 5,
        points_per_game: main?.points_per_game ?? 11,
        team_match_format: (main?.team_match_format ?? '') as TeamMatchFormat | '',
      },
    })
    setEditingPhaseDivId(divId)
  }

  async function savePhases(divId: string) {
    setSavingPhase(true)
    const existing = phasesMap[divId] ?? []
    const existingPrelim = existing.find(p => p.phase_type === 'preliminary')
    const existingMain = existing.find(p => p.phase_type === 'main')
    const newPhases: TournamentPhase[] = []

    // 예선 처리
    if (phaseEdit.hasPrelim) {
      const payload = {
        format: phaseEdit.prelim.format,
        games_per_match: phaseEdit.prelim.games_per_match,
        points_per_game: phaseEdit.prelim.points_per_game,
        advancement_count: phaseEdit.prelim.advancement_count,
        team_match_format: phaseEdit.prelim.team_match_format || null,
      }
      if (existingPrelim) {
        const { data } = await supabase.from('tournament_phases').update(payload).eq('id', existingPrelim.id).select().single()
        if (data) newPhases.push(data as TournamentPhase)
      } else {
        const { data } = await supabase.from('tournament_phases').insert({
          division_id: divId, phase_type: 'preliminary', phase_order: 1, is_active: true, ...payload,
        }).select().single()
        if (data) newPhases.push(data as TournamentPhase)
      }
    } else if (existingPrelim) {
      await supabase.from('tournament_phases').delete().eq('id', existingPrelim.id)
    }

    // 본선 처리
    const mainPayload = {
      format: phaseEdit.main.format,
      games_per_match: phaseEdit.main.games_per_match,
      points_per_game: phaseEdit.main.points_per_game,
      team_match_format: phaseEdit.main.team_match_format || null,
    }
    if (existingMain) {
      const { data } = await supabase.from('tournament_phases').update(mainPayload).eq('id', existingMain.id).select().single()
      if (data) newPhases.push(data as TournamentPhase)
    } else {
      const { data } = await supabase.from('tournament_phases').insert({
        division_id: divId, phase_type: 'main', phase_order: phaseEdit.hasPrelim ? 2 : 1, is_active: true, ...mainPayload,
      }).select().single()
      if (data) newPhases.push(data as TournamentPhase)
    }

    newPhases.sort((a, b) => a.phase_order - b.phase_order)
    setPhasesMap(prev => ({ ...prev, [divId]: newPhases }))
    setSavingPhase(false)
    setEditingPhaseDivId(null)
    toast.success('단계 설정이 저장되었습니다')
  }

  function phaseSummary(divId: string) {
    const phases = phasesMap[divId] ?? []
    if (phases.length === 0) return null
    return phases.map(ph => {
      const fmtLabel = PHASE_FORMAT_LABEL[ph.format] ?? ph.format
      const typeLabel = ph.phase_type === 'preliminary' ? '예선' : '본선'
      const adv = ph.phase_type === 'preliminary' && ph.advancement_count ? ` · 진출 ${ph.advancement_count}팀` : ''
      const teamFmt = ph.team_match_format ? ` · ${TEAM_FORMAT_SHORT[ph.team_match_format] ?? ph.team_match_format}` : ''
      return `${typeLabel}: ${fmtLabel} · ${ph.games_per_match}게임/${ph.points_per_game}점${teamFmt}${adv}`
    }).join('  |  ')
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
          { href: `/admin/tournaments/${id}/players`,       icon: Users,          label: '선수 관리' },
          { href: `/admin/tournaments/${id}/registrations`, icon: FileCheck,     label: '접수 관리' },
          { href: `/admin/tournaments/${id}/draw`,          icon: GitBranch,     label: '대진표 생성' },
          { href: `/admin/tournaments/${id}/scores`,        icon: ClipboardList, label: '결과 입력' },
          { href: `/admin/tournaments/${id}/qna`,           icon: MessageCircle, label: 'Q&A 관리' },
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
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-sm font-medium">대회요강</label>
            <textarea value={form.regulations} onChange={e => updateField('regulations', e.target.value)}
              rows={8} placeholder="참가 자격, 경기 방식, 시상 내역, 유의사항 등을 입력하세요"
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors resize-y" />
          </div>
        </div>
      </form>

      {/* 관리자 위임 섹션 — 대표 관리자(created_by/admin_id) 또는 system_admin에게 표시 */}
      {currentUserId && (isSystemAdmin || tournament.created_by === currentUserId || tournament.admin_id === currentUserId) && (
        <section className="glass rounded-2xl p-6 border border-white/10 space-y-5">
          <div className="flex items-center gap-2">
            <UserCog className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">관리자 위임</h2>
          </div>

          {/* 대표 관리자 — created_by / system_admin만 변경 가능 */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">대표 관리자</p>
            <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
              <div className="text-sm">
                {currentAdmin
                  ? <span className="font-medium text-accent">{currentAdmin.name} <span className="text-muted-foreground font-normal">({currentAdmin.email})</span></span>
                  : <span className="font-medium">직접 관리 중</span>
                }
              </div>
              {currentAdmin && (isSystemAdmin || tournament.created_by === currentUserId) && (
                <button
                  onClick={() => handleSaveDelegate(currentUserId!)}
                  disabled={savingDelegate}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" /> 권한 회수
                </button>
              )}
            </div>

            {(isSystemAdmin || tournament.created_by === currentUserId) && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">다른 회원에게 위임</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={delegateSearch}
                    onChange={e => searchUsers(e.target.value)}
                    onFocus={() => delegateResults.length > 0 && setShowDelegateResults(true)}
                    onBlur={() => setTimeout(() => setShowDelegateResults(false), 150)}
                    placeholder="이름 또는 이메일로 검색"
                    className="w-full glass border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors"
                  />
                  {showDelegateResults && delegateResults.length > 0 && (
                    <ul className="absolute z-10 mt-1 w-full glass border border-white/10 rounded-xl overflow-hidden shadow-lg">
                      {delegateResults.map(u => (
                        <li key={u.id}>
                          <button
                            type="button"
                            onMouseDown={() => {
                              setSelectedDelegate(u)
                              setDelegateSearch(u.name)
                              setShowDelegateResults(false)
                            }}
                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors flex items-center justify-between"
                          >
                            <span>{u.name}</span>
                            <span className="text-xs text-muted-foreground">{u.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {selectedDelegate && (
                  <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
                    <div className="text-sm">
                      <span className="font-medium">{selectedDelegate.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{selectedDelegate.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveDelegate(selectedDelegate.id)}
                      disabled={savingDelegate}
                      className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      <UserCog className="w-3 h-3" />
                      {savingDelegate ? '처리 중...' : '위임하기'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 공동 관리자 — 대표 관리자 이상 조작 가능 */}
          <div className="space-y-3 border-t border-white/10 pt-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">공동 관리자</p>

            {/* 현재 공동 관리자 칩 목록 */}
            {coAdmins.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {coAdmins.map(ca => (
                  <span key={ca.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium glass border border-white/10">
                    {ca.name}
                    <span className="text-muted-foreground">{ca.email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCoAdmin(ca)}
                      className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                      title="제거"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">공동 관리자가 없습니다.</p>
            )}

            {/* 공동 관리자 추가 검색 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={coAdminSearch}
                onChange={e => searchCoAdminUsers(e.target.value)}
                onFocus={() => coAdminResults.length > 0 && setShowCoAdminResults(true)}
                onBlur={() => setTimeout(() => setShowCoAdminResults(false), 150)}
                placeholder="이름 또는 이메일로 검색하여 추가"
                disabled={addingCoAdmin}
                className="w-full glass border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors disabled:opacity-50"
              />
              {showCoAdminResults && coAdminResults.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full glass border border-white/10 rounded-xl overflow-hidden shadow-lg">
                  {coAdminResults.map(u => (
                    <li key={u.id}>
                      <button
                        type="button"
                        onMouseDown={() => handleAddCoAdmin(u)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/10 transition-colors flex items-center justify-between"
                      >
                        <span>{u.name}</span>
                        <span className="text-xs text-muted-foreground">{u.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              공동 관리자는 대회 정보 수정, 선수/팀 관리, 경기 결과 입력이 가능합니다.
            </p>
          </div>
        </section>
      )}

      {/* Division Management */}
      <section className="glass rounded-2xl p-6 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <h2 className="font-semibold">부수 관리 ({divisions.length}개)</h2>
            <HelpPopover title="부수 관리 안내">
              <p>
                <span className="text-foreground font-medium">부수(Division)</span>는 대회 내 경기를 구분하는 단위입니다.
                예를 들어 &ldquo;남자 1부&rdquo;, &ldquo;여자 2부&rdquo;처럼 성별·수준별로 나눌 수 있습니다.
              </p>
              <ul className="space-y-1.5 list-none">
                <li>
                  <span className="text-foreground font-medium">개인전</span> — 선수 개인이 직접 참가하는 방식
                </li>
                <li>
                  <span className="text-foreground font-medium">단체전</span> — 팀 단위 참가. 올림픽, 스웨이틀링 등 다양한 방식 선택 가능
                </li>
              </ul>
              <p className="border-t border-white/10 pt-2">
                각 부수의 <span className="text-foreground font-medium">⚙ 단계 설정</span>에서 예선(리그)·본선(토너먼트) 방식과 게임 수를 지정합니다.
                대진표 생성 전 반드시 설정을 완료해야 합니다.
              </p>
            </HelpPopover>
          </div>
          <button onClick={() => setShowDivForm(!showDivForm)}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:opacity-80 transition-opacity">
            <Plus className="w-4 h-4" /> 부수 추가
          </button>
        </div>

        {divisions.length > 0 ? (
          <div className="space-y-3">
            {divisions.map(div => (
              <div key={div.id} className="rounded-xl bg-white/5 overflow-hidden">
                {/* Division row */}
                <div className="px-4 py-3">
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
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{genderLabel[div.gender]} {div.name}</span>
                          <span className="text-xs text-muted-foreground">{matchTypeLabel[div.match_type]}</span>
                          {div.match_type === 'team' && div.team_match_format && (
                            <span className="text-xs text-accent">{TEAM_FORMAT_LABEL[div.team_match_format]}</span>
                          )}
                          {div.match_type === 'team' && div.max_teams && (
                            <span className="text-xs text-muted-foreground">최대 {div.max_teams}팀</span>
                          )}
                        </div>
                        {phaseSummary(div.id) && (
                          <p className="text-xs text-muted-foreground mt-0.5">{phaseSummary(div.id)}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Link href={`/admin/tournaments/${id}/players?divId=${div.id}`}
                          className="text-xs px-2.5 py-1.5 glass border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                          선수 관리
                        </Link>
                        <button
                          onClick={() => { setEditingDivId(null); openPhaseEditor(div.id) }}
                          title="단계 설정"
                          className={`p-1.5 rounded-lg transition-colors ${editingPhaseDivId === div.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-primary'}`}>
                          <Settings2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => { setEditingPhaseDivId(null); startEditDiv(div) }}
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

                {/* Phase settings section */}
                {editingPhaseDivId === div.id && (
                  <div className="border-t border-white/10 bg-white/[0.03] px-4 py-4 space-y-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">단계 설정</p>

                    {/* 예선 */}
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={phaseEdit.hasPrelim}
                          onChange={e => setPhaseEdit(p => ({ ...p, hasPrelim: e.target.checked }))}
                          className="accent-primary w-4 h-4" />
                        <span className="text-sm font-medium">예선전 (리그) 사용</span>
                      </label>
                      {phaseEdit.hasPrelim && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pl-6">
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">예선 방식</label>
                            <select value={phaseEdit.prelim.format}
                              onChange={e => setPhaseEdit(p => ({ ...p, prelim: { ...p.prelim, format: e.target.value as PhaseFormat } }))}
                              className="w-full glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-background outline-none focus:border-primary">
                              <option value="round_robin">리그 (라운드로빈)</option>
                              <option value="group_knockout">조별 토너먼트</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">경기당 게임 수</label>
                            <input type="number" min={1} max={99}
                              value={phaseEdit.prelim.games_per_match}
                              onChange={e => setPhaseEdit(p => ({ ...p, prelim: { ...p.prelim, games_per_match: Number(e.target.value) } }))}
                              className="w-full glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">게임당 점수</label>
                            <input type="number" min={1} max={99}
                              value={phaseEdit.prelim.points_per_game}
                              onChange={e => setPhaseEdit(p => ({ ...p, prelim: { ...p.prelim, points_per_game: Number(e.target.value) } }))}
                              className="w-full glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-muted-foreground">조당 본선 진출 수</label>
                            <input type="number" min={1} max={99}
                              value={phaseEdit.prelim.advancement_count}
                              onChange={e => setPhaseEdit(p => ({ ...p, prelim: { ...p.prelim, advancement_count: Number(e.target.value) } }))}
                              className="w-full glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                          </div>
                          {div.match_type === 'team' && (
                            <div className="space-y-1 col-span-2 sm:col-span-4">
                              <label className="text-xs text-muted-foreground">예선 단체전 방식</label>
                              <select
                                value={phaseEdit.prelim.team_match_format}
                                onChange={e => setPhaseEdit(p => ({ ...p, prelim: { ...p.prelim, team_match_format: e.target.value as TeamMatchFormat | '' } }))}
                                className="w-full glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-background outline-none focus:border-primary">
                                <option value="">-- 방식 선택 --</option>
                                {(Object.entries(TEAM_FORMAT_LABEL) as [TeamMatchFormat, string][]).map(([val, label]) => (
                                  <option key={val} value={val}>{label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 본선 */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">본선 (토너먼트)</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pl-0">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">본선 방식</label>
                          <select value={phaseEdit.main.format}
                            onChange={e => setPhaseEdit(p => ({ ...p, main: { ...p.main, format: e.target.value as PhaseFormat } }))}
                            className="w-full glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-background outline-none focus:border-primary">
                            <option value="single_elimination">단일 토너먼트</option>
                            <option value="double_elimination">더블 토너먼트</option>
                            <option value="round_robin">리그</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">경기당 게임 수</label>
                          <input type="number" min={1} max={99}
                            value={phaseEdit.main.games_per_match}
                            onChange={e => setPhaseEdit(p => ({ ...p, main: { ...p.main, games_per_match: Number(e.target.value) } }))}
                            className="w-full glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground">게임당 점수</label>
                          <input type="number" min={1} max={99}
                            value={phaseEdit.main.points_per_game}
                            onChange={e => setPhaseEdit(p => ({ ...p, main: { ...p.main, points_per_game: Number(e.target.value) } }))}
                            className="w-full glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                        </div>
                        {div.match_type === 'team' && (
                          <div className="space-y-1 col-span-2 sm:col-span-3">
                            <label className="text-xs text-muted-foreground">본선 단체전 방식</label>
                            <select
                              value={phaseEdit.main.team_match_format}
                              onChange={e => setPhaseEdit(p => ({ ...p, main: { ...p.main, team_match_format: e.target.value as TeamMatchFormat | '' } }))}
                              className="w-full glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-background outline-none focus:border-primary">
                              <option value="">-- 방식 선택 --</option>
                              {(Object.entries(TEAM_FORMAT_LABEL) as [TeamMatchFormat, string][]).map(([val, label]) => (
                                <option key={val} value={val}>{label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button onClick={() => savePhases(div.id)} disabled={savingPhase}
                        className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                        <Save className="w-3.5 h-3.5" />
                        {savingPhase ? '저장 중...' : '저장'}
                      </button>
                      <button onClick={() => setEditingPhaseDivId(null)}
                        className="px-4 py-1.5 glass border border-white/10 rounded-lg text-sm hover:bg-white/10 transition-colors">
                        취소
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
      {/* 대회 삭제 */}
      <section className="glass rounded-2xl p-5 border border-red-500/20">
        <h2 className="font-semibold text-red-400 mb-1">위험 구역</h2>
        <p className="text-xs text-muted-foreground mb-4">대회를 삭제하면 부수·선수·대진표·결과가 모두 영구 삭제됩니다.</p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border border-red-500/40 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" /> 대회 삭제
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300">
                <span className="font-semibold">"{tournament?.name}"</span> 대회를 정말 삭제하시겠습니까?<br />
                이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setDeleting(true)
                  const res = await fetch(`/api/tournaments/${id}`, { method: 'DELETE' })
                  if (res.ok) {
                    toast.success('대회가 삭제되었습니다')
                    router.push('/admin')
                  } else {
                    const { error } = await res.json()
                    toast.error('삭제 실패: ' + error)
                    setDeleting(false)
                    setShowDeleteConfirm(false)
                  }
                }}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? '삭제 중...' : '삭제 확인'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm glass border border-white/10 hover:bg-white/10 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
