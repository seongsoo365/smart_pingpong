'use client'
import { useState, useEffect, Suspense } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save, Loader2, CheckCircle2, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { getMyRegistrationsByTournament } from '@/lib/utils/myRegistrations'
import type { Division, Player, Team, TeamMember, TeamMatchFormat } from '@/lib/types'

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }

const TEAM_SIZE: Record<TeamMatchFormat, { min: number; max: number }> = {
  olympic:              { min: 3, max: 3 },
  traditional_4s1d:    { min: 4, max: 6 },
  swaythling:          { min: 3, max: 3 },
  singles_2_doubles_1: { min: 2, max: 3 },
  three_doubles:       { min: 6, max: 6 },
  three_singles:       { min: 3, max: 3 },
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

function validatePhone(phone: string): string | null {
  if (!phone) return null
  if (!/^01[0-9]-\d{3,4}-\d{4}$/.test(phone)) return '010-0000-0000 형식으로 입력하세요'
  return null
}

interface MemberInput { name: string; level: number | '' }

function EditContent() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const regId = searchParams.get('regId') ?? ''
  const type = (searchParams.get('type') ?? 'player') as 'player' | 'team'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [registrationStatus, setRegistrationStatus] = useState<'pending' | 'approved' | null>(null)

  // Individual fields
  const [name, setName] = useState('')
  const [club, setClub] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  // Team fields
  const [teamName, setTeamName] = useState('')
  const [teamClub, setTeamClub] = useState('')
  const [teamEmail, setTeamEmail] = useState('')
  const [members, setMembers] = useState<MemberInput[]>([])
  const [teamMatchFormat, setTeamMatchFormat] = useState<TeamMatchFormat | null>(null)

  // division selection
  const [divisions, setDivisions] = useState<Division[]>([])
  const [divisionId, setDivisionId] = useState('')

  useEffect(() => {
    if (!regId) { setNotFound(true); setLoading(false); return }

    // Verify ownership via localStorage
    const myRegs = getMyRegistrationsByTournament(id)
    const mine = myRegs.find(r => r.id === regId && r.type === type)
    if (!mine) { setNotFound(true); setLoading(false); return }

    loadData()
  }, [regId, type])

  async function loadData() {
    setLoading(true)

    const { data: divs } = await supabase
      .from('divisions').select('*').eq('tournament_id', id).order('display_order')
    const allDivs = (divs ?? []) as Division[]

    if (type === 'player') {
      const { data: p } = await supabase
        .from('players')
        .select('*')
        .eq('id', regId)
        .single()
      if (!p) { setNotFound(true); setLoading(false); return }
      const player = p as Player
      if (player.confirmed) { setRegistrationStatus('approved'); setLoading(false); return }
      setRegistrationStatus('pending')
      setName(player.name)
      setClub(player.club ?? '')
      setPhone(player.phone ?? '')
      setEmail(player.email ?? '')
      setDivisionId(player.division_id)
      setDivisions(allDivs.filter(d => d.match_type === 'individual'))
    } else {
      const { data: t } = await supabase
        .from('teams')
        .select('*, members:team_members(*), division:divisions(team_match_format)')
        .eq('id', regId)
        .single()
      if (!t) { setNotFound(true); setLoading(false); return }
      const team = t as Team & { members: TeamMember[]; division: { team_match_format: TeamMatchFormat | null } }
      if (team.confirmed) { setRegistrationStatus('approved'); setLoading(false); return }
      setRegistrationStatus('pending')
      setTeamName(team.name)
      setTeamClub(team.club ?? '')
      setTeamEmail(team.email ?? '')
      setTeamMatchFormat(team.division?.team_match_format ?? null)
      setDivisionId(team.division_id)
      setDivisions(allDivs.filter(d => d.match_type === 'team'))
      const sorted = [...(team.members ?? [])].sort((a, b) => a.player_order - b.player_order)
      setMembers(sorted.map(m => ({ name: m.player_name, level: m.player_level ?? '' })))
    }
    setLoading(false)
  }

  function handlePhoneChange(value: string) {
    const formatted = formatPhone(value)
    setPhone(formatted)
    setPhoneError(validatePhone(formatted))
  }

  function updateMember(idx: number, field: 'name' | 'level', val: string) {
    setMembers(prev => prev.map((m, i) => i === idx
      ? { ...m, [field]: field === 'level' ? (val ? Number(val) : '') : val }
      : m))
  }

  function handleDivisionChange(newDivId: string) {
    setDivisionId(newDivId)
    if (type === 'team') {
      const div = divisions.find(d => d.id === newDivId)
      setTeamMatchFormat(div?.team_match_format ?? null)
    }
  }

  function handleMemberCountChange(count: number) {
    setMembers(prev => {
      if (count > prev.length)
        return [...prev, ...Array.from({ length: count - prev.length }, () => ({ name: '', level: '' as const }))]
      return prev.slice(0, count)
    })
  }

  async function handleSavePlayer(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('이름을 입력하세요'); return }
    const phoneErr = validatePhone(phone)
    if (phoneErr) { setPhoneError(phoneErr); toast.error(phoneErr); return }

    setSaving(true)
    const { error } = await supabase.from('players').update({
      name: name.trim(),
      club: club.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      division_id: divisionId,
    }).eq('id', regId)
    setSaving(false)

    if (error) { toast.error('수정 실패: ' + error.message); return }
    toast.success('신청 정보가 수정되었습니다.')
    router.push(`/tournaments/${id}`)
  }

  async function handleSaveTeam(e: React.FormEvent) {
    e.preventDefault()
    if (!teamName.trim()) { toast.error('팀명을 입력하세요'); return }
    const validMembers = members.filter(m => m.name.trim())
    const fmt = teamMatchFormat
    const size = fmt && fmt in TEAM_SIZE ? TEAM_SIZE[fmt] : { min: 1, max: 10 }
    if (validMembers.length < size.min) {
      toast.error(`선수를 최소 ${size.min}명 입력하세요`)
      return
    }

    setSaving(true)

    // Update team info
    const { error: teamErr } = await supabase.from('teams').update({
      name: teamName.trim(),
      club: teamClub.trim() || null,
      email: teamEmail.trim() || null,
      division_id: divisionId,
    }).eq('id', regId)

    if (teamErr) { toast.error('수정 실패: ' + teamErr.message); setSaving(false); return }

    // Replace team members: delete existing then insert new
    const { error: delErr } = await supabase.from('team_members').delete().eq('team_id', regId)
    if (delErr) { toast.error('팀원 수정 실패: ' + delErr.message); setSaving(false); return }

    const memberRows = validMembers.map((m, i) => ({
      team_id: regId,
      player_name: m.name.trim(),
      player_order: i + 1,
      player_level: m.level !== '' ? m.level : null,
    }))
    const { error: insErr } = await supabase.from('team_members').insert(memberRows)
    if (insErr) { toast.error('팀원 저장 실패: ' + insErr.message); setSaving(false); return }

    setSaving(false)
    toast.success('신청 정보가 수정되었습니다.')
    router.push(`/tournaments/${id}`)
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm">불러오는 중...</span>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <p className="text-muted-foreground">신청 내역을 찾을 수 없습니다.</p>
        <Link href={`/tournaments/${id}`} className="text-primary text-sm hover:underline">
          대회 페이지로 돌아가기
        </Link>
      </div>
    )
  }

  if (registrationStatus === 'approved') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
        <h2 className="text-lg font-bold">신청이 승인되었습니다</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          승인 완료 후에는 수정이 불가합니다.<br />
          변경이 필요한 경우 대회 운영진에게 문의하세요.
        </p>
        <Link href={`/tournaments/${id}`}
          className="inline-block mt-2 text-primary text-sm hover:underline">
          대회 페이지로 돌아가기
        </Link>
      </div>
    )
  }

  const fmt = teamMatchFormat
  const size = fmt && fmt in TEAM_SIZE ? TEAM_SIZE[fmt] : null

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${id}`} className="p-2 glass rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold">신청 정보 수정</h1>
          {registrationStatus === 'pending' && (
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-xs text-yellow-600 dark:text-yellow-400">승인 대기 중</span>
            </div>
          )}
        </div>
      </div>

      {type === 'player' ? (
        <form onSubmit={handleSavePlayer} className="glass rounded-2xl p-6 border border-white/10 space-y-5">
          {divisions.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">신청 부수 *</label>
              <select value={divisionId} onChange={e => handleDivisionChange(e.target.value)} required
                className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:border-primary">
                {divisions.map(div => (
                  <option key={div.id} value={div.id}>
                    {genderLabel[div.gender]} {div.name} (개인전)
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">이름 *</label>
            <input required value={name} onChange={e => setName(e.target.value)}
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">소속 <span className="text-muted-foreground font-normal">(선택)</span></label>
            <input value={club} onChange={e => setClub(e.target.value)}
              placeholder="팀명 또는 소속 기관"
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">연락처 <span className="text-muted-foreground font-normal">(선택)</span></label>
            <input type="tel" value={phone} onChange={e => handlePhoneChange(e.target.value)}
              placeholder="010-0000-0000"
              className={`w-full glass border rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none transition-colors ${
                phoneError ? 'border-red-500' : 'border-white/10 focus:border-primary'
              }`} />
            {phoneError && <p className="text-xs text-red-400">{phoneError}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">이메일 <span className="text-muted-foreground font-normal">(선택)</span></label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
          </div>
          <button type="submit" disabled={saving || !!phoneError}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />저장 중...</> : <><Save className="w-4 h-4" />수정 완료</>}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSaveTeam} className="glass rounded-2xl p-6 border border-white/10 space-y-5">
          {divisions.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">신청 부수 *</label>
              <select value={divisionId} onChange={e => handleDivisionChange(e.target.value)} required
                className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:border-primary">
                {divisions.map(div => (
                  <option key={div.id} value={div.id}>
                    {genderLabel[div.gender]} {div.name} (단체전)
                  </option>
                ))}
              </select>
            </div>
          )}
          {size && (
            <p className="text-xs text-primary/80 bg-primary/10 rounded-lg px-3 py-2">
              팀원 {size.min === size.max ? `${size.min}명` : `${size.min}~${size.max}명`} 필요
            </p>
          )}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">팀명 *</label>
            <input required value={teamName} onChange={e => setTeamName(e.target.value)}
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">소속 / 클럽 <span className="text-muted-foreground font-normal">(선택)</span></label>
            <input value={teamClub} onChange={e => setTeamClub(e.target.value)}
              placeholder="소속 기관 또는 클럽명"
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
          </div>

          {size && size.min !== size.max && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">참가 인원 수 *</label>
              <div className="flex gap-2">
                {Array.from({ length: size.max - size.min + 1 }, (_, i) => size.min + i).map(count => (
                  <button key={count} type="button" onClick={() => handleMemberCountChange(count)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                      members.length === count
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'glass border-white/10 hover:border-primary/50'
                    }`}>
                    {count}인
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">
              선수 명단 * <span className="text-muted-foreground font-normal text-xs">({members.length}명)</span>
            </label>
            <div className="space-y-2">
              {members.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
                  <input value={m.name} onChange={e => updateMember(i, 'name', e.target.value)}
                    placeholder={`선수 ${i + 1} 이름`}
                    className="flex-1 glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
                  <input type="number" min={1} max={99} value={m.level}
                    onChange={e => updateMember(i, 'level', e.target.value)}
                    placeholder="-"
                    className="w-14 text-center glass border border-white/10 rounded-xl px-2 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
                  <span className="text-xs text-muted-foreground shrink-0">부</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">이메일 <span className="text-muted-foreground font-normal">(선택)</span></label>
            <input type="email" value={teamEmail} onChange={e => setTeamEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary transition-colors" />
          </div>

          <button type="submit" disabled={saving}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" />저장 중...</> : <><Save className="w-4 h-4" />수정 완료</>}
          </button>
        </form>
      )}
    </div>
  )
}

export default function MyRegistrationPage() {
  return (
    <Suspense fallback={
      <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm">불러오는 중...</span>
      </div>
    }>
      <EditContent />
    </Suspense>
  )
}
