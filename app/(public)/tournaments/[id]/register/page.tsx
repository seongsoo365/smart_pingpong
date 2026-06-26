'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { Division, Tournament, TeamMatchFormat } from '@/lib/types'

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }

const TEAM_SIZE: Record<TeamMatchFormat, { min: number; max: number; desc: string }> = {
  olympic:              { min: 3, max: 3, desc: '3인 (에이스 포함)' },
  traditional_4s1d:    { min: 4, max: 6, desc: '4~6인' },
  swaythling:          { min: 3, max: 3, desc: '3인' },
  singles_2_doubles_1: { min: 2, max: 3, desc: '2~3인' },
  three_doubles:       { min: 6, max: 6, desc: '6인 (복식 3쌍)' },
  three_singles:       { min: 3, max: 3, desc: '3인' },
}

function getTeamSize(fmt?: TeamMatchFormat | null) {
  if (!fmt || !(fmt in TEAM_SIZE)) return { min: 3, max: 6, desc: '팀원 입력' }
  return TEAM_SIZE[fmt]
}

// FEAT-15: 연락처 자동 포맷팅 (010-XXXX-XXXX)
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

export default function RegisterPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [divisions, setDivisions] = useState<Division[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  // common
  const [divisionId, setDivisionId] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  // individual
  const [name, setName] = useState('')
  const [club, setClub] = useState('')

  // team
  const [teamName, setTeamName] = useState('')
  const [teamClub, setTeamClub] = useState('')
  const [members, setMembers] = useState<{ name: string; level: number | '' }[]>([])

  useEffect(() => {
    Promise.all([
      supabase.from('tournaments').select('*').eq('id', id).single(),
      supabase.from('divisions').select('*').eq('tournament_id', id).order('display_order'),
    ]).then(([{ data: t }, { data: d }]) => {
      if (!t || t.status !== 'registration') {
        router.replace(`/tournaments/${id}`)
        return
      }
      setTournament(t)
      const divs = d ?? []
      setDivisions(divs)
      if (divs[0]) selectDivision(divs[0])
    })
  }, [id])

  function selectDivision(div: Division) {
    setDivisionId(div.id)
    if (div.match_type === 'team') {
      const { min } = getTeamSize(div.team_match_format)
      setMembers(Array.from({ length: min }, () => ({ name: '', level: '' as const })))
    }
  }

  const selectedDiv = divisions.find(d => d.id === divisionId)
  const isTeam = selectedDiv?.match_type === 'team'
  const teamSize = isTeam ? getTeamSize(selectedDiv?.team_match_format) : null

  function handleDivChange(newDivId: string) {
    const div = divisions.find(d => d.id === newDivId)
    if (div) selectDivision(div)
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

  function handleMemberCountChange(count: number) {
    setMembers(prev => {
      if (count > prev.length) {
        return [...prev, ...Array.from({ length: count - prev.length }, () => ({ name: '', level: '' as const }))]
      }
      return prev.slice(0, count)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!divisionId) return

    // FEAT-15: 연락처 형식 최종 검증
    const phoneValidationError = validatePhone(phone)
    if (phoneValidationError) {
      setPhoneError(phoneValidationError)
      toast.error(phoneValidationError)
      return
    }

    setLoading(true)

    if (isTeam) {
      const validMembers = members.filter(m => m.name.trim())
      if (!teamName.trim()) { toast.error('팀명을 입력하세요'); setLoading(false); return }
      if (teamSize && validMembers.length < teamSize.min) {
        toast.error(`선수를 최소 ${teamSize.min}명 입력하세요`)
        setLoading(false)
        return
      }

      // FEAT-14: 팀명 중복 확인
      const { data: existingTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('division_id', divisionId)
        .eq('name', teamName.trim())
        .maybeSingle()

      if (existingTeam) {
        toast.error('이미 동일한 팀명으로 신청된 내역이 있습니다')
        setLoading(false)
        return
      }

      const { data: team, error: tErr } = await supabase
        .from('teams')
        .insert({ division_id: divisionId, name: teamName.trim(), club: teamClub.trim() || null, email: email.trim() || null, confirmed: false })
        .select()
        .single()

      if (tErr || !team) {
        toast.error('접수 실패: ' + tErr?.message)
        setLoading(false)
        return
      }

      const memberRows = validMembers.map((m, i) => ({
        team_id: team.id,
        player_name: m.name.trim(),
        player_order: i + 1,
        player_level: m.level !== '' ? m.level : null,
      }))
      const { error: mErr } = await supabase.from('team_members').insert(memberRows)
      if (mErr) {
        toast.error('선수 등록 실패: ' + mErr.message)
        setLoading(false)
        return
      }
    } else {
      if (!name.trim()) { toast.error('이름을 입력하세요'); setLoading(false); return }

      // FEAT-14: 이름+연락처 기준 중복 확인
      const dupQuery = supabase
        .from('players')
        .select('id')
        .eq('division_id', divisionId)
        .eq('name', name.trim())

      const { data: existing } = await (
        phone.trim()
          ? dupQuery.eq('phone', phone.trim())
          : dupQuery
      ).maybeSingle()

      if (existing) {
        toast.error('이미 동일한 이름' + (phone.trim() ? '과 연락처로' : '으로') + ' 신청된 내역이 있습니다')
        setLoading(false)
        return
      }

      const { error } = await supabase.from('players').insert({
        division_id: divisionId,
        name: name.trim(),
        club: club.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        confirmed: false,
      })
      if (error) { toast.error('접수 실패: ' + error.message); setLoading(false); return }
    }

    setSubmitted(true)
    setLoading(false)
  }

  function resetForm() {
    setSubmitted(false)
    setName(''); setClub(''); setPhone(''); setPhoneError(null); setEmail('')
    setTeamName(''); setTeamClub('')
    if (selectedDiv) selectDivision(selectedDiv)
  }

  if (!tournament) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-sm">불러오는 중...</span>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
        <CheckCircle2 className="w-14 h-14 text-primary mx-auto" />
        <h2 className="text-xl font-bold">접수가 완료되었습니다</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          접수 내용은 대회 운영진이 확인 후 승인합니다.<br />
          승인 결과는 별도로 연락드릴 예정입니다.
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <button onClick={resetForm}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
            추가 접수하기
          </button>
          <Link href={`/tournaments/${id}`}
            className="w-full py-2.5 glass border border-white/10 rounded-xl text-sm text-center hover:bg-white/10 transition-colors">
            대회 페이지로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  // 연락처 입력 필드 (재사용)
  const phoneField = (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">연락처 <span className="text-muted-foreground font-normal">(선택)</span></label>
      <input
        type="tel"
        value={phone}
        onChange={e => handlePhoneChange(e.target.value)}
        placeholder="010-0000-0000"
        className={`w-full glass border rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none transition-colors ${
          phoneError ? 'border-red-500' : 'border-white/10 focus:border-primary'
        }`}
      />
      {phoneError && <p className="text-xs text-red-400">{phoneError}</p>}
    </div>
  )

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/tournaments/${id}`} className="p-2 glass rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">참가 신청</h1>
          <p className="text-xs text-muted-foreground">{tournament.name}</p>
        </div>
      </div>

      {tournament.registration_end && (
        <div className="glass rounded-xl px-4 py-3 border border-primary/20 text-sm text-muted-foreground">
          접수 기간: <span className="text-foreground font-medium">{tournament.registration_start} ~ {tournament.registration_end}</span>
        </div>
      )}

      {divisions.length === 0 ? (
        <div className="glass rounded-2xl p-6 border border-white/10 text-center text-muted-foreground text-sm">
          현재 접수 가능한 부수가 없습니다.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 border border-white/10 space-y-5">
          {/* Division selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">신청 부수 *</label>
            <select value={divisionId} onChange={e => handleDivChange(e.target.value)} required
              className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-background outline-none focus:border-primary">
              {divisions.map(div => (
                <option key={div.id} value={div.id}>
                  {genderLabel[div.gender]} {div.name} ({div.match_type === 'team' ? '단체전' : '개인전'})
                </option>
              ))}
            </select>
          </div>

          {isTeam ? (
            <>
              {teamSize && (
                <p className="text-xs text-primary/80 bg-primary/10 rounded-lg px-3 py-2">
                  {selectedDiv?.team_match_format
                    ? `${teamSize.desc} 등록`
                    : '팀원 정보를 입력하세요'}
                </p>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium">팀명 *</label>
                <input required value={teamName} onChange={e => setTeamName(e.target.value)}
                  placeholder="예) 서울탁구팀"
                  className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">소속 / 클럽 <span className="text-muted-foreground font-normal">(선택)</span></label>
                <input value={teamClub} onChange={e => setTeamClub(e.target.value)}
                  placeholder="소속 기관 또는 클럽명"
                  className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
              </div>

              {teamSize && teamSize.min !== teamSize.max && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">참가 인원 수 *</label>
                  <div className="flex gap-2">
                    {Array.from(
                      { length: teamSize.max - teamSize.min + 1 },
                      (_, i) => teamSize.min + i
                    ).map(count => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => handleMemberCountChange(count)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                          members.length === count
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'glass border-white/10 hover:border-primary/50'
                        }`}
                      >
                        {count}인
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  선수 명단 *
                  <span className="text-muted-foreground font-normal ml-1 text-xs">
                    ({members.length}명)
                  </span>
                </label>
                <div className="space-y-2">
                  {members.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
                      <input
                        value={m.name}
                        onChange={e => updateMember(i, 'name', e.target.value)}
                        placeholder={`선수 ${i + 1} 이름`}
                        className="flex-1 glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary"
                      />
                      <input
                        type="number" min={1} max={99}
                        value={m.level}
                        onChange={e => updateMember(i, 'level', e.target.value)}
                        placeholder="-"
                        className="w-14 text-center glass border border-white/10 rounded-xl px-2 py-2.5 text-sm bg-transparent outline-none focus:border-primary"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">부</span>
                    </div>
                  ))}
                </div>
              </div>

              {phoneField}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">이메일 <span className="text-muted-foreground font-normal">(선택)</span></label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">이름 *</label>
                <input required value={name} onChange={e => setName(e.target.value)}
                  placeholder="홍길동"
                  className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">소속 <span className="text-muted-foreground font-normal">(선택)</span></label>
                <input value={club} onChange={e => setClub(e.target.value)}
                  placeholder="팀명 또는 소속 기관"
                  className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
              </div>
              {phoneField}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">이메일 <span className="text-muted-foreground font-normal">(선택 — 승인 결과 수신)</span></label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full glass border border-white/10 rounded-xl px-4 py-2.5 text-sm bg-transparent outline-none focus:border-primary" />
              </div>
            </>
          )}

          <button type="submit" disabled={loading || !!phoneError}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
            {loading
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />접수 중...</span>
              : '참가 신청하기'}
          </button>

          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            접수 후 운영진 승인 과정이 있습니다.<br />결과는 개별 연락을 통해 안내됩니다.
          </p>
        </form>
      )}
    </div>
  )
}
