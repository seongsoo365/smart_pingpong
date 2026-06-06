'use client'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, ChevronLeft, Pencil, Check, X, Clock, ClipboardList, ChevronDown, ChevronUp, AlertTriangle, Users } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Division, Player, Team, TeamMember, TeamMatchFormat } from '@/lib/types'

// ─── 공통 ────────────────────────────────────────────────────────────────────

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }

const TEAM_SIZE: Record<TeamMatchFormat, { min: number; max: number; desc: string }> = {
  olympic:              { min: 3, max: 3, desc: '3인' },
  traditional_4s1d:    { min: 4, max: 6, desc: '4~6인' },
  swaythling:          { min: 3, max: 3, desc: '3인' },
  singles_2_doubles_1: { min: 2, max: 3, desc: '2~3인' },
  three_doubles:       { min: 6, max: 6, desc: '6인' },
  three_singles:       { min: 3, max: 3, desc: '3인' },
}

function getTeamSize(fmt?: TeamMatchFormat | null) {
  if (!fmt || !(fmt in TEAM_SIZE)) return { min: 1, max: 10, desc: '팀원 입력' }
  return TEAM_SIZE[fmt]
}

// ─── 개인전 유틸 ─────────────────────────────────────────────────────────────

interface ParsedRow { name: string; club: string; duplicate: boolean }

function parseBulkText(text: string, existing: Player[]): ParsedRow[] {
  const existingNames = new Set(existing.map(p => p.name.trim().toLowerCase()))
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const [rawName, rawClub = ''] = line.split(',')
      const name = rawName.trim()
      const club = rawClub.trim()
      return { name, club, duplicate: existingNames.has(name.toLowerCase()) }
    })
    .filter(row => row.name.length > 0)
}

// ─── 메인 페이지 ─────────────────────────────────────────────────────────────

export default function PlayersPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const defaultDivId = searchParams.get('divId') ?? ''

  const [divisions, setDivisions] = useState<Division[]>([])
  const [selectedDivId, setSelectedDivId] = useState(defaultDivId)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('divisions').select('*').eq('tournament_id', id).order('display_order')
      .then(({ data }) => {
        setDivisions(data ?? [])
        if (!selectedDivId && data?.[0]) setSelectedDivId(data[0].id)
      })
  }, [id])

  const selectedDiv = divisions.find(d => d.id === selectedDivId)
  const isTeam = selectedDiv?.match_type === 'team'

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/tournaments/${id}/edit`} className="p-2 glass rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold">선수 관리</h1>
      </div>

      {/* Division selector */}
      <div className="flex flex-wrap gap-2">
        {divisions.map(div => (
          <button
            key={div.id}
            onClick={() => setSelectedDivId(div.id)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedDivId === div.id
                ? 'bg-primary text-primary-foreground'
                : 'glass border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10'
            }`}
          >
            {genderLabel[div.gender]} {div.name}
            {div.match_type === 'team' && (
              <span className="ml-1.5 text-xs opacity-70">단체</span>
            )}
          </button>
        ))}
      </div>

      {selectedDiv && (
        isTeam
          ? <TeamSection supabase={supabase} div={selectedDiv} />
          : <IndividualSection supabase={supabase} divId={selectedDivId} />
      )}
    </div>
  )
}

// ─── 개인전 섹션 ─────────────────────────────────────────────────────────────

function IndividualSection({ supabase, divId }: { supabase: ReturnType<typeof createClient>; divId: string }) {
  const [players, setPlayers] = useState<Player[]>([])
  const [newName, setNewName] = useState('')
  const [newClub, setNewClub] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editClub, setEditClub] = useState('')
  const [showBulk, setShowBulk] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkLoading, setBulkLoading] = useState(false)

  const parsedRows = useMemo(() => parseBulkText(bulkText, players), [bulkText, players])

  useEffect(() => {
    if (!divId) return
    supabase.from('players').select('*').eq('division_id', divId)
      .order('seed', { nullsFirst: false }).order('created_at')
      .then(({ data }) => setPlayers(data ?? []))
  }, [divId])

  async function addPlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim() || !divId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('players')
      .insert({ division_id: divId, name: newName.trim(), club: newClub.trim() || null, confirmed: true })
      .select().single()
    if (error) { toast.error('추가 실패: ' + error.message) }
    else { setPlayers(prev => [...prev, data]); setNewName(''); setNewClub('') }
    setLoading(false)
  }

  async function confirmPlayer(playerId: string) {
    const { data, error } = await supabase.from('players').update({ confirmed: true }).eq('id', playerId).select().single()
    if (error) { toast.error('승인 실패'); return }
    setPlayers(prev => prev.map(p => p.id === playerId ? data : p))
    toast.success('선수를 승인했습니다')
  }

  async function removePlayer(playerId: string) {
    const { error } = await supabase.from('players').delete().eq('id', playerId)
    if (error) toast.error('삭제 실패')
    else setPlayers(prev => prev.filter(p => p.id !== playerId))
  }

  function startEdit(p: Player) {
    setEditingId(p.id); setEditName(p.name); setEditClub(p.club ?? '')
  }

  async function savePlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId || !editName.trim()) return
    const { data, error } = await supabase
      .from('players').update({ name: editName.trim(), club: editClub.trim() || null })
      .eq('id', editingId).select().single()
    if (error) { toast.error('수정 실패: ' + error.message); return }
    setPlayers(prev => prev.map(p => p.id === editingId ? data : p))
    setEditingId(null)
    toast.success('선수 정보가 수정되었습니다')
  }

  async function addBulk() {
    const rows = parsedRows.filter(r => !r.duplicate)
    if (rows.length === 0) { toast.error('등록할 선수가 없습니다'); return }
    setBulkLoading(true)
    const { data, error } = await supabase
      .from('players')
      .insert(rows.map(r => ({ division_id: divId, name: r.name, club: r.club || null, confirmed: true })))
      .select()
    if (error) { toast.error('일괄 등록 실패: ' + error.message) }
    else {
      setPlayers(prev => [...prev, ...(data ?? [])])
      setBulkText(''); setShowBulk(false)
      toast.success(`${data?.length ?? 0}명을 등록했습니다`)
    }
    setBulkLoading(false)
  }

  async function updateSeed(playerId: string, seed: number) {
    await supabase.from('players').update({ seed: seed || null }).eq('id', playerId)
    setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, seed } : p))
  }

  return (
    <>
      {/* Player list */}
      <div className="glass rounded-2xl p-5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            선수 목록
            <span className="text-muted-foreground font-normal ml-2 text-sm">({players.length}명)</span>
          </h2>
        </div>

        {players.length > 0 ? (
          <div className="space-y-2">
            {players.map((p, i) => (
              <div key={p.id} className="rounded-xl bg-white/5 px-4 py-3">
                {editingId === p.id ? (
                  <form onSubmit={savePlayer} className="flex items-center gap-2 flex-wrap">
                    <span className="text-muted-foreground text-sm w-5 shrink-0">{i + 1}</span>
                    <input required value={editName} onChange={e => setEditName(e.target.value)}
                      placeholder="선수명 *"
                      className="flex-1 min-w-24 glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                    <input value={editClub} onChange={e => setEditClub(e.target.value)}
                      placeholder="소속"
                      className="flex-1 min-w-24 glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                    <div className="flex gap-1.5 shrink-0">
                      <button type="submit"
                        className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}
                        className="p-2 glass border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground text-sm w-5 shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        {!p.confirmed && (
                          <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-accent/20 text-accent">
                            <Clock className="w-2.5 h-2.5" /> 미승인
                          </span>
                        )}
                      </div>
                      {p.club && <div className="text-xs text-muted-foreground">{p.club}</div>}
                      {p.phone && <div className="text-xs text-muted-foreground">{p.phone}</div>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {!p.confirmed && (
                        <button onClick={() => confirmPlayer(p.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                          <Check className="w-3 h-3" /> 승인
                        </button>
                      )}
                      {p.confirmed && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">시드</span>
                          <input
                            type="number" min={1} defaultValue={p.seed ?? ''}
                            onBlur={e => updateSeed(p.id, Number(e.target.value))}
                            className="w-12 glass border border-white/10 rounded-lg px-2 py-1 text-xs text-center bg-transparent outline-none focus:border-primary"
                            placeholder="-"
                          />
                        </div>
                      )}
                      <button onClick={() => startEdit(p)}
                        className="p-1 text-muted-foreground hover:text-primary transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => removePlayer(p.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">등록된 선수가 없습니다</p>
        )}
      </div>

      {/* Add form */}
      <form onSubmit={addPlayer} className="glass rounded-2xl p-5 border border-white/10 space-y-4">
        <h2 className="font-semibold">선수 추가</h2>
        <div className="flex gap-3 flex-wrap">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="선수명 *" required
            className="flex-1 min-w-32 glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
          <input value={newClub} onChange={e => setNewClub(e.target.value)}
            placeholder="소속 (선택)"
            className="flex-1 min-w-32 glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
          <button type="submit" disabled={loading}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 shrink-0">
            <Plus className="w-4 h-4" /> 추가
          </button>
        </div>
      </form>

      {/* Bulk registration */}
      <div className="glass rounded-2xl border border-white/10 overflow-hidden">
        <button type="button" onClick={() => setShowBulk(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors">
          <span className="flex items-center gap-2 font-semibold text-sm">
            <ClipboardList className="w-4 h-4 text-primary" />
            일괄 등록
            <span className="text-xs text-muted-foreground font-normal">이름,소속 형식으로 여러 명 한 번에 등록</span>
          </span>
          {showBulk ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showBulk && (
          <div className="px-5 pb-5 space-y-4 border-t border-white/10 pt-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                한 줄에 한 명씩 — <code className="bg-white/10 px-1 rounded">이름,소속</code> 또는 <code className="bg-white/10 px-1 rounded">이름</code>
              </label>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={6}
                placeholder={"홍길동,한국탁구클럽\n김철수\n이영희,서울FC"}
                className="w-full glass border border-white/10 rounded-xl px-4 py-3 text-sm bg-transparent outline-none focus:border-primary resize-y font-mono" />
            </div>

            {parsedRows.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  미리보기 — 총 {parsedRows.length}명
                  {parsedRows.some(r => r.duplicate) && (
                    <span className="text-accent ml-2">(중복 {parsedRows.filter(r => r.duplicate).length}명 제외)</span>
                  )}
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {parsedRows.map((row, i) => (
                    <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${row.duplicate ? 'bg-accent/10 text-muted-foreground line-through' : 'bg-white/5'}`}>
                      {row.duplicate && <AlertTriangle className="w-3.5 h-3.5 text-accent shrink-0" />}
                      <span className="font-medium">{row.name}</span>
                      {row.club && <span className="text-muted-foreground">{row.club}</span>}
                      {row.duplicate && <span className="text-xs text-accent ml-auto">중복</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={addBulk}
                disabled={bulkLoading || parsedRows.filter(r => !r.duplicate).length === 0}
                className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
                {bulkLoading ? '등록 중...' : `${parsedRows.filter(r => !r.duplicate).length}명 등록`}
              </button>
              <button type="button" onClick={() => { setBulkText(''); setShowBulk(false) }}
                className="px-4 glass border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors">
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ─── 단체전 섹션 ─────────────────────────────────────────────────────────────

interface TeamWithMembers extends Team { members: TeamMember[] }
interface MemberInput { name: string; level: number | '' }

const emptyMember = (): MemberInput => ({ name: '', level: '' })

function TeamSection({ supabase, div }: { supabase: ReturnType<typeof createClient>; div: Division }) {
  const teamSize = getTeamSize(div.team_match_format)

  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editClub, setEditClub] = useState('')
  const [editMembers, setEditMembers] = useState<MemberInput[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Add form state
  const [newName, setNewName] = useState('')
  const [newClub, setNewClub] = useState('')
  const [newMembers, setNewMembers] = useState<MemberInput[]>(() => Array.from({ length: teamSize.min }, emptyMember))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadTeams()
  }, [div.id])

  async function loadTeams() {
    const { data, error } = await supabase
      .from('teams')
      .select('*, members:team_members(*)')
      .eq('division_id', div.id)
      .order('seed', { nullsFirst: false })
    if (error) toast.error('팀 목록 조회 실패: ' + error.message)
    setTeams((data ?? []) as TeamWithMembers[])
  }

  async function addTeam(e: React.FormEvent) {
    e.preventDefault()
    const validMembers = newMembers.filter(m => m.name.trim())
    if (!newName.trim()) { toast.error('팀명을 입력하세요'); return }
    if (validMembers.length < teamSize.min) {
      toast.error(`선수를 최소 ${teamSize.min}명 입력하세요`); return
    }
    setLoading(true)

    const { data: team, error: tErr } = await supabase
      .from('teams')
      .insert({ division_id: div.id, name: newName.trim(), club: newClub.trim() || null, confirmed: true })
      .select().single()

    if (tErr || !team) { toast.error('추가 실패: ' + tErr?.message); setLoading(false); return }

    const memberRows = validMembers.map((m, i) => ({
      team_id: team.id, player_name: m.name.trim(),
      player_order: i + 1, player_level: m.level !== '' ? m.level : null,
    }))
    const { error: mErr } = await supabase.from('team_members').insert(memberRows)
    if (mErr) { toast.error('선수 등록 실패: ' + mErr.message); setLoading(false); return }

    toast.success(`${team.name} 팀을 등록했습니다`)
    setNewName(''); setNewClub(''); setNewMembers(Array.from({ length: teamSize.min }, emptyMember))
    await loadTeams()
    setLoading(false)
  }

  async function confirmTeam(teamId: string) {
    const { error } = await supabase.from('teams').update({ confirmed: true }).eq('id', teamId)
    if (error) { toast.error('승인 실패'); return }
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, confirmed: true } : t))
    toast.success('팀을 승인했습니다')
  }

  async function removeTeam(teamId: string) {
    const { error } = await supabase.from('teams').delete().eq('id', teamId)
    if (error) toast.error('삭제 실패')
    else setTeams(prev => prev.filter(t => t.id !== teamId))
  }

  async function updateSeed(teamId: string, seed: number) {
    await supabase.from('teams').update({ seed: seed || null }).eq('id', teamId)
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, seed } : t))
  }

  function startEdit(team: TeamWithMembers) {
    setEditingId(team.id)
    setEditName(team.name)
    setEditClub(team.club ?? '')
    const sorted = [...(team.members ?? [])].sort((a, b) => a.player_order - b.player_order)
    setEditMembers(sorted.map(m => ({ name: m.player_name, level: m.player_level ?? '' })))
    setExpandedId(team.id)
  }

  async function saveTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId || !editName.trim()) return
    const validMembers = editMembers.filter(m => m.name.trim())
    if (validMembers.length < teamSize.min) {
      toast.error(`선수를 최소 ${teamSize.min}명 입력하세요`); return
    }

    const { error: tErr } = await supabase
      .from('teams').update({ name: editName.trim(), club: editClub.trim() || null })
      .eq('id', editingId)
    if (tErr) { toast.error('수정 실패: ' + tErr.message); return }

    await supabase.from('team_members').delete().eq('team_id', editingId)
    const memberRows = validMembers.map((m, i) => ({
      team_id: editingId, player_name: m.name.trim(),
      player_order: i + 1, player_level: m.level !== '' ? m.level : null,
    }))
    const { error: mErr } = await supabase.from('team_members').insert(memberRows)
    if (mErr) { toast.error('선수 수정 실패: ' + mErr.message); return }

    toast.success('팀 정보가 수정되었습니다')
    setEditingId(null)
    await loadTeams()
  }

  // Add form member helpers
  function updateNewMember(idx: number, field: keyof MemberInput, val: string) {
    setNewMembers(prev => prev.map((m, i) => i === idx
      ? { ...m, [field]: field === 'level' ? (val ? Number(val) : '') : val }
      : m))
  }
  function addNewMember() {
    if (newMembers.length >= teamSize.max) return
    setNewMembers(prev => [...prev, emptyMember()])
  }
  function removeNewMember(idx: number) {
    if (newMembers.length <= teamSize.min) return
    setNewMembers(prev => prev.filter((_, i) => i !== idx))
  }

  // Edit form member helpers
  function updateEditMember(idx: number, field: keyof MemberInput, val: string) {
    setEditMembers(prev => prev.map((m, i) => i === idx
      ? { ...m, [field]: field === 'level' ? (val ? Number(val) : '') : val }
      : m))
  }
  function addEditMember() {
    if (editMembers.length >= teamSize.max) return
    setEditMembers(prev => [...prev, emptyMember()])
  }
  function removeEditMember(idx: number) {
    if (editMembers.length <= teamSize.min) return
    setEditMembers(prev => prev.filter((_, i) => i !== idx))
  }

  return (
    <>
      {/* Team list */}
      <div className="glass rounded-2xl p-5 border border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">
            팀 목록
            <span className="text-muted-foreground font-normal ml-2 text-sm">({teams.length}팀)</span>
          </h2>
          {div.team_match_format && (
            <span className="text-xs text-muted-foreground glass border border-white/10 rounded-lg px-2 py-1">
              {teamSize.desc}
            </span>
          )}
        </div>

        {teams.length > 0 ? (
          <div className="space-y-2">
            {teams.map((team, i) => (
              <div key={team.id} className="rounded-xl bg-white/5 overflow-hidden">
                {editingId === team.id ? (
                  /* Edit form */
                  <form onSubmit={saveTeam} className="p-4 space-y-3">
                    <div className="flex gap-2 flex-wrap">
                      <input required value={editName} onChange={e => setEditName(e.target.value)}
                        placeholder="팀명 *"
                        className="flex-1 min-w-32 glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                      <input value={editClub} onChange={e => setEditClub(e.target.value)}
                        placeholder="소속"
                        className="flex-1 min-w-32 glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground">선수 명단</p>
                      {editMembers.map((member, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{idx + 1}</span>
                          <input value={member.name} onChange={e => updateEditMember(idx, 'name', e.target.value)}
                            placeholder={`선수 ${idx + 1}`}
                            className="flex-1 glass border border-white/10 rounded-lg px-3 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                          <input type="number" min={1} max={99}
                            value={member.level}
                            onChange={e => updateEditMember(idx, 'level', e.target.value)}
                            placeholder="-"
                            className="w-12 text-center glass border border-white/10 rounded-lg px-1 py-1.5 text-sm bg-transparent outline-none focus:border-primary" />
                          <span className="text-xs text-muted-foreground shrink-0">부</span>
                          {editMembers.length > teamSize.min && (
                            <button type="button" onClick={() => removeEditMember(idx)}
                              className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      {editMembers.length < teamSize.max && (
                        <button type="button" onClick={addEditMember}
                          className="w-full py-1.5 glass border border-dashed border-white/20 rounded-lg text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-1">
                          <Plus className="w-3 h-3" /> 선수 추가
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button type="submit"
                        className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                        저장
                      </button>
                      <button type="button" onClick={() => setEditingId(null)}
                        className="px-4 glass border border-white/10 rounded-lg text-sm hover:bg-white/10 transition-colors">
                        취소
                      </button>
                    </div>
                  </form>
                ) : (
                  /* View row */
                  <>
                    <div className="flex items-center gap-3 px-4 py-3">
                      <span className="text-muted-foreground text-sm w-5 shrink-0">{i + 1}</span>
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === team.id ? null : team.id)}
                        className="flex-1 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{team.name}</span>
                          {!team.confirmed && (
                            <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full bg-accent/20 text-accent">
                              <Clock className="w-2.5 h-2.5" /> 미승인
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            <Users className="w-3 h-3 inline mr-0.5" />{team.members?.length ?? 0}명
                          </span>
                        </div>
                        {team.club && <div className="text-xs text-muted-foreground">{team.club}</div>}
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        {!team.confirmed && (
                          <button onClick={() => confirmTeam(team.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                            <Check className="w-3 h-3" /> 승인
                          </button>
                        )}
                        {team.confirmed && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground">시드</span>
                            <input
                              type="number" min={1} defaultValue={team.seed ?? ''}
                              onBlur={e => updateSeed(team.id, Number(e.target.value))}
                              className="w-12 glass border border-white/10 rounded-lg px-2 py-1 text-xs text-center bg-transparent outline-none focus:border-primary"
                              placeholder="-"
                            />
                          </div>
                        )}
                        <button onClick={() => startEdit(team)}
                          className="p-1 text-muted-foreground hover:text-primary transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeTeam(team.id)}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Member list (expanded) */}
                    {expandedId === team.id && (team.members?.length ?? 0) > 0 && (
                      <div className="px-4 pb-3 border-t border-white/5">
                        <div className="pt-2 space-y-1">
                          {[...(team.members ?? [])].sort((a, b) => a.player_order - b.player_order).map(m => (
                            <div key={m.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span className="w-4 text-right text-xs">{m.player_order}</span>
                              <span className="text-foreground">
                                {m.player_name}
                                {m.player_level && (
                                  <span className="text-xs text-muted-foreground ml-1">({m.player_level}부)</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">등록된 팀이 없습니다</p>
        )}
      </div>

      {/* Add team form */}
      <form onSubmit={addTeam} className="glass rounded-2xl p-5 border border-white/10 space-y-4">
        <h2 className="font-semibold">팀 추가</h2>

        {div.team_match_format && (
          <p className="text-xs text-primary/80 bg-primary/10 rounded-lg px-3 py-2">
            {teamSize.desc} 등록
          </p>
        )}

        <div className="flex gap-3 flex-wrap">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="팀명 *" required
            className="flex-1 min-w-32 glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
          <input value={newClub} onChange={e => setNewClub(e.target.value)}
            placeholder="소속 (선택)"
            className="flex-1 min-w-32 glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">
            선수 명단 *
            <span className="text-muted-foreground font-normal ml-1 text-xs">
              ({newMembers.length}명
              {teamSize.min !== teamSize.max && ` / 최소 ${teamSize.min}명`})
            </span>
          </p>
          {newMembers.map((member, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-4 text-right shrink-0">{idx + 1}</span>
              <input value={member.name} onChange={e => updateNewMember(idx, 'name', e.target.value)}
                placeholder={`선수 ${idx + 1} 이름`}
                className="flex-1 glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
              <input type="number" min={1} max={99}
                value={member.level}
                onChange={e => updateNewMember(idx, 'level', e.target.value)}
                placeholder="-"
                className="w-14 text-center glass border border-white/10 rounded-xl px-2 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
              <span className="text-xs text-muted-foreground shrink-0">부</span>
              {newMembers.length > teamSize.min && (
                <button type="button" onClick={() => removeNewMember(idx)}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
          {newMembers.length < teamSize.max && (
            <button type="button" onClick={addNewMember}
              className="w-full py-2 glass border border-dashed border-white/20 rounded-xl text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> 선수 추가
            </button>
          )}
        </div>

        <button type="submit" disabled={loading}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
          {loading ? '등록 중...' : '팀 등록'}
        </button>
      </form>
    </>
  )
}
