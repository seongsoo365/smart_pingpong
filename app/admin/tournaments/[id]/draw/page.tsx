'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Shuffle, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { generateRoundRobin, distributeIntoGroups } from '@/lib/utils/roundrobin'
import { generateSeededBracket, getBracketRounds, nextPowerOfTwo } from '@/lib/utils/bracket'
import { cn } from '@/lib/utils'
import type { Division, Player, Team, TournamentPhase } from '@/lib/types'

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }

export default function DrawPage() {
  const { id } = useParams<{ id: string }>()
  const [divisions, setDivisions] = useState<Division[]>([])
  const [selectedDivId, setSelectedDivId] = useState('')
  const [phases, setPhases] = useState<TournamentPhase[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [groupCount, setGroupCount] = useState(2)
  const [advanceCount, setAdvanceCount] = useState(2)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    supabase.from('divisions').select('*').eq('tournament_id', id).order('display_order')
      .then(({ data }) => {
        setDivisions(data ?? [])
        if (data?.[0]) setSelectedDivId(data[0].id)
      })
  }, [id])

  const selectedDiv = divisions.find(d => d.id === selectedDivId)
  const isTeam = selectedDiv?.match_type === 'team'

  useEffect(() => {
    if (!selectedDivId) return
    const div = divisions.find(d => d.id === selectedDivId)
    if (!div) return

    if (div.match_type === 'team') {
      Promise.all([
        supabase.from('teams').select('*').eq('division_id', selectedDivId).eq('confirmed', true).order('seed', { nullsFirst: false }),
        supabase.from('tournament_phases').select('*').eq('division_id', selectedDivId).order('phase_order'),
      ]).then(([{ data: t }, { data: ph }]) => {
        setTeams(t ?? [])
        setPlayers([])
        setPhases(ph ?? [])
        const pre = (ph ?? []).find(phase => phase.phase_type === 'preliminary')
        if (pre?.advancement_count) setAdvanceCount(pre.advancement_count)
      })
    } else {
      Promise.all([
        supabase.from('players').select('*').eq('division_id', selectedDivId).eq('confirmed', true).order('seed', { nullsFirst: false }),
        supabase.from('tournament_phases').select('*').eq('division_id', selectedDivId).order('phase_order'),
      ]).then(([{ data: p }, { data: ph }]) => {
        setPlayers(p ?? [])
        setTeams([])
        setPhases(ph ?? [])
        const pre = (ph ?? []).find(phase => phase.phase_type === 'preliminary')
        if (pre?.advancement_count) setAdvanceCount(pre.advancement_count)
      })
    }
  }, [selectedDivId, divisions])

  const prelim = phases.find(p => p.phase_type === 'preliminary')
  const main = phases.find(p => p.phase_type === 'main')

  // 현재 부수의 참가자(개인 or 팀) 목록
  const participants = isTeam ? teams : players
  const participantType = isTeam ? 'team' : 'player'
  const unitLabel = isTeam ? '팀' : '명'

  // 조 편성 미리보기 계산
  const groupSizes = prelim && participants.length > 0
    ? distributeIntoGroups(participants as (Player | Team)[], groupCount).map(g => g.length)
    : []
  const hasEmptyGroup = groupSizes.some(s => s === 0)
  const hasOnePersonGroup = groupSizes.some(s => s === 1)
  const hasBlockingError = hasEmptyGroup || hasOnePersonGroup
  const theoreticalAdvancing = groupCount * advanceCount
  const bracketSlots = nextPowerOfTwo(theoreticalAdvancing)
  const emptySlots = bracketSlots - theoreticalAdvancing

  async function generateDraw() {
    if (!main) { toast.error('본선 단계가 없습니다'); return }
    if (participants.length < 2) { toast.error(`${isTeam ? '팀' : '선수'}을 최소 2${unitLabel} 이상 등록하세요`); return }

    // BUG-02: warn before overwriting completed results
    const { data: existingMatches } = await supabase.from('matches').select('status').eq('phase_id', main.id)
    if (existingMatches?.some(m => m.status === 'completed')) {
      if (!confirm('입력된 경기 결과가 있습니다. 대진표를 재생성하면 모든 결과가 삭제됩니다. 계속하시겠습니까?')) return
    }

    setLoading(true)

    // Clear existing matches and groups
    if (prelim) {
      const { data: existingGroups } = await supabase.from('groups').select('id').eq('phase_id', prelim.id)
      for (const g of existingGroups ?? []) {
        await supabase.from('matches').delete().eq('group_id', g.id)
      }
      await supabase.from('groups').delete().eq('phase_id', prelim.id)
    }
    await supabase.from('matches').delete().eq('phase_id', main.id)

    // Reset group_id on all participants
    if (isTeam) {
      await supabase.from('teams').update({ group_id: null }).eq('division_id', selectedDivId)
    } else {
      await supabase.from('players').update({ group_id: null }).eq('division_id', selectedDivId)
    }

    if (prelim) {
      const distributed = distributeIntoGroups(participants as (Player | Team)[], groupCount)
      for (let gi = 0; gi < distributed.length; gi++) {
        const groupParticipants = distributed[gi]
        if (groupParticipants.length === 0) continue

        const { data: group } = await supabase
          .from('groups')
          .insert({ phase_id: prelim.id, name: `${String.fromCharCode(65 + gi)}조`, display_order: gi })
          .select().single()

        if (!group) continue

        // Assign participants to group
        for (const p of groupParticipants) {
          if (isTeam) {
            await supabase.from('teams').update({ group_id: group.id }).eq('id', p.id)
          } else {
            await supabase.from('players').update({ group_id: group.id }).eq('id', p.id)
          }
        }

        // Generate round robin matches
        const ids = groupParticipants.map(p => p.id)
        const rounds = generateRoundRobin(ids)
        let matchNum = 1
        for (let ri = 0; ri < rounds.length; ri++) {
          for (const [p1, p2] of rounds[ri]) {
            await supabase.from('matches').insert({
              phase_id: prelim.id,
              group_id: group.id,
              round: ri + 1,
              match_number: matchNum++,
              participant1_id: p1,
              participant2_id: p2,
              participant1_type: participantType,
              status: 'pending',
            })
          }
        }
      }

      // advanceCount가 변경된 경우 DB에 저장
      if (prelim.advancement_count !== advanceCount) {
        await supabase.from('tournament_phases')
          .update({ advancement_count: advanceCount })
          .eq('id', prelim.id)
      }

      // Generate main bracket — ALL rounds (TBD slots)
      const totalAdvancing = groupCount * advanceCount
      const mainSlots = nextPowerOfTwo(totalAdvancing)
      const mainTotalRounds = getBracketRounds(totalAdvancing)
      for (let round = 1; round <= mainTotalRounds; round++) {
        const matchCount = mainSlots / Math.pow(2, round)
        for (let matchNum = 1; matchNum <= matchCount; matchNum++) {
          await supabase.from('matches').insert({
            phase_id: main.id,
            round,
            match_number: matchNum,
            participant1_type: participantType,
            status: 'pending',
          })
        }
      }
    } else {
      // Direct bracket (no preliminary)
      const seeded = [...participants]
        .sort((a, b) => ((a as Player | Team).seed ?? 9999) - ((b as Player | Team).seed ?? 9999))
        .map(p => p.id)
      const bracket = generateSeededBracket(seeded)
      const totalRounds = getBracketRounds(participants.length)
      const slots = nextPowerOfTwo(participants.length)

      const matchIdMap = new Map<string, string>()
      for (let round = 1; round <= totalRounds; round++) {
        const matchCount = slots / Math.pow(2, round)
        for (let matchNum = 1; matchNum <= matchCount; matchNum++) {
          let payload: Record<string, unknown> = {
            phase_id: main.id,
            round,
            match_number: matchNum,
            participant1_type: participantType,
            status: 'pending',
          }
          if (round === 1) {
            const [p1, p2] = bracket[matchNum - 1]
            const isBye = !!(p1 && !p2)
            payload = { ...payload, participant1_id: p1, participant2_id: p2,
              status: isBye ? 'bye' : 'pending', winner_id: isBye ? p1 : null }
          }
          const { data: m } = await supabase.from('matches').insert(payload).select('id').single()
          if (m) matchIdMap.set(`${round}-${matchNum}`, m.id)
        }
      }

      // Advance bye winners from round 1 into round 2 slots
      if (totalRounds > 1) {
        for (let matchNum = 1; matchNum <= slots / 2; matchNum++) {
          const [p1, p2] = bracket[matchNum - 1]
          if (p1 && !p2) {
            const nextMatchNum = Math.ceil(matchNum / 2)
            const isP1Slot = matchNum % 2 === 1
            const nextMatchId = matchIdMap.get(`2-${nextMatchNum}`)
            if (nextMatchId) {
              await supabase.from('matches').update(
                isP1Slot ? { participant1_id: p1 } : { participant2_id: p1 }
              ).eq('id', nextMatchId)
            }
          }
        }
      }
    }

    toast.success('대진표가 생성되었습니다!')
    setGenerated(true)
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/tournaments/${id}/edit`} className="p-2 glass rounded-lg hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="text-xl font-bold">대진표 생성</h1>
      </div>

      <div className="flex flex-wrap gap-2">
        {divisions.map(div => (
          <button key={div.id} onClick={() => { setSelectedDivId(div.id); setGenerated(false) }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedDivId === div.id
                ? 'bg-primary text-primary-foreground'
                : 'glass border border-white/10 text-muted-foreground hover:bg-white/10'
            }`}>
            {genderLabel[div.gender]} {div.name}
            {div.match_type === 'team' && <span className="ml-1 text-xs opacity-70">단체</span>}
          </button>
        ))}
      </div>

      {selectedDivId && (
        <div className="glass rounded-2xl p-6 border border-white/10 space-y-5">
          <div className="space-y-1">
            <h2 className="font-semibold">대진 설정</h2>
            <p className="text-sm text-muted-foreground">
              등록된 {isTeam ? '팀' : '선수'}: {participants.length}{unitLabel}
            </p>
          </div>

          {prelim && (
            <div className="space-y-4">
              {/* 조 수 선택 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">조 수</label>
                <div className="flex gap-2 flex-wrap">
                  {[2, 3, 4, 6, 8].map(n => (
                    <button key={n} type="button"
                      onClick={() => setGroupCount(n)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        groupCount === n
                          ? 'bg-primary text-primary-foreground'
                          : 'glass border border-white/10 text-muted-foreground hover:bg-white/10'
                      }`}>
                      {n}조
                    </button>
                  ))}
                </div>
              </div>

              {/* 조당 본선 진출 수 선택 */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">조당 본선 진출 수</label>
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5, 6, 7].map(n => (
                    <button key={n} type="button"
                      onClick={() => setAdvanceCount(n)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                        advanceCount === n
                          ? 'bg-primary text-primary-foreground'
                          : 'glass border border-white/10 text-muted-foreground hover:bg-white/10'
                      }`}>
                      {n}명
                    </button>
                  ))}
                </div>
              </div>

              {/* 조 편성 미리보기 */}
              {participants.length > 0 && groupSizes.length > 0 && (
                <div className="rounded-xl bg-white/5 p-3 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">조 편성 예상</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {groupSizes.map((size, i) => {
                      const advancing = size < 2 ? 0 : Math.min(size, advanceCount)
                      return (
                        <div key={i} className={cn(
                          'rounded-lg px-3 py-2 text-xs space-y-0.5',
                          size === 0 ? 'border border-red-500/40 bg-red-500/10' :
                          size === 1 ? 'border border-orange-500/40 bg-orange-500/10' :
                          advancing < advanceCount ? 'border border-yellow-500/30 bg-yellow-500/10' :
                          'bg-white/[0.05]'
                        )}>
                          <p className="font-semibold">{String.fromCharCode(65 + i)}조</p>
                          <p className="text-muted-foreground">{size}{unitLabel} 참가</p>
                          <p className={cn(
                            size < 2 ? 'text-red-400' :
                            advancing < advanceCount ? 'text-yellow-400' :
                            'text-primary'
                          )}>
                            {size < 2 ? '편성 불가' : `→ ${advancing}${unitLabel} 진출`}
                          </p>
                        </div>
                      )
                    })}
                  </div>

                  {/* 본선 구조 요약 */}
                  <div className="border-t border-white/10 pt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>진출 총원 <span className="text-foreground font-medium">{theoreticalAdvancing}{unitLabel}</span></span>
                    <span>본선 규모 <span className="text-foreground font-medium">{bracketSlots}강</span></span>
                    {emptySlots > 0 && (
                      <span>부전승 <span className="text-foreground font-medium">{emptySlots}개</span></span>
                    )}
                  </div>
                </div>
              )}

              {/* 에러 · 안내 메시지 */}
              {hasEmptyGroup && (
                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    조 수({groupCount})가 참가자 수({participants.length})보다 많아 빈 조가 생깁니다.
                    조 수를 줄이거나 참가자를 추가하세요.
                  </span>
                </div>
              )}
              {!hasEmptyGroup && hasOnePersonGroup && (
                <div className="flex items-start gap-2 text-sm text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    1명으로만 구성된 조가 있어 리그 경기를 편성할 수 없습니다.
                    조 수를 줄이세요.
                  </span>
                </div>
              )}
              {!hasBlockingError && emptySlots > 0 && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    진출 총원({theoreticalAdvancing}{unitLabel})이 2의 거듭제곱이 아니어서
                    본선 1라운드에 부전승 {emptySlots}개가 자동 배정됩니다. 대진 진행에는 문제없습니다.
                  </span>
                </div>
              )}
            </div>
          )}

          {!prelim && (
            <div className="text-sm text-muted-foreground">
              예선 없이 바로 본선 토너먼트 ({participants.length}{unitLabel} → {Math.ceil(Math.log2(Math.pow(2, Math.ceil(Math.log2(participants.length)))))} 라운드)
            </div>
          )}

          {generated ? (
            <div className="flex items-center gap-2 text-emerald-400 font-medium">
              <CheckCircle className="w-5 h-5" />
              대진표가 생성되었습니다
            </div>
          ) : null}

          <div className="flex gap-3 pt-2">
            <button
              onClick={generateDraw}
              disabled={loading || participants.length < 2 || (!!prelim && hasBlockingError)}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              <Shuffle className="w-4 h-4" />
              {loading ? '생성 중...' : generated ? '재생성' : '대진표 생성'}
            </button>
            {generated && (
              <Link
                href={`/tournaments/${id}`}
                target="_blank"
                className="inline-flex items-center gap-2 glass border border-white/10 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
              >
                공개 페이지에서 확인 →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
