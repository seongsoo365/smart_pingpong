'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Shuffle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { generateRoundRobin, distributeIntoGroups } from '@/lib/utils/roundrobin'
import { generateSeededBracket, getBracketRounds, nextPowerOfTwo } from '@/lib/utils/bracket'
import type { Division, Player, TournamentPhase } from '@/lib/types'

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }

export default function DrawPage() {
  const { id } = useParams<{ id: string }>()
  const [divisions, setDivisions] = useState<Division[]>([])
  const [selectedDivId, setSelectedDivId] = useState('')
  const [phases, setPhases] = useState<TournamentPhase[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [groupCount, setGroupCount] = useState(2)
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

  useEffect(() => {
    if (!selectedDivId) return
    Promise.all([
      supabase.from('players').select('*').eq('division_id', selectedDivId).eq('confirmed', true).order('seed', { nullsFirst: false }),
      supabase.from('tournament_phases').select('*').eq('division_id', selectedDivId).order('phase_order'),
    ]).then(([{ data: p }, { data: ph }]) => {
      setPlayers(p ?? [])
      setPhases(ph ?? [])
    })
  }, [selectedDivId])

  const prelim = phases.find(p => p.phase_type === 'preliminary')
  const main = phases.find(p => p.phase_type === 'main')

  async function generateDraw() {
    if (!main) { toast.error('본선 단계가 없습니다'); return }
    if (players.length < 2) { toast.error('선수를 최소 2명 이상 등록하세요'); return }

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

    if (prelim) {
      // Create groups
      const distributed = distributeIntoGroups(players, groupCount)
      for (let gi = 0; gi < distributed.length; gi++) {
        const groupPlayers = distributed[gi]
        if (groupPlayers.length === 0) continue

        const { data: group } = await supabase
          .from('groups')
          .insert({ phase_id: prelim.id, name: `${String.fromCharCode(65 + gi)}조`, display_order: gi })
          .select().single()

        if (!group) continue

        // Assign players to group
        for (const p of groupPlayers) {
          await supabase.from('players').update({ group_id: group.id }).eq('id', p.id)
        }

        // Generate round robin matches
        const playerIds = groupPlayers.map(p => p.id)
        const rounds = generateRoundRobin(playerIds)
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
              participant1_type: 'player',
              status: 'pending',
            })
          }
        }
      }

      // Generate main bracket — ALL rounds (TBD slots, filled when prelim completes)
      const totalAdvancing = groupCount * (prelim.advancement_count ?? 2)
      const mainSlots = nextPowerOfTwo(totalAdvancing)
      const mainTotalRounds = getBracketRounds(totalAdvancing)
      for (let round = 1; round <= mainTotalRounds; round++) {
        const matchCount = mainSlots / Math.pow(2, round)
        for (let matchNum = 1; matchNum <= matchCount; matchNum++) {
          await supabase.from('matches').insert({
            phase_id: main.id,
            round,
            match_number: matchNum,
            participant1_type: 'player',
            status: 'pending',
          })
        }
      }
    } else {
      // Direct bracket (no preliminary) — create ALL rounds, propagate bye winners
      const seeded = [...players]
        .sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999))
        .map(p => p.id)
      const bracket = generateSeededBracket(seeded)
      const totalRounds = getBracketRounds(players.length)
      const slots = nextPowerOfTwo(players.length)

      // Insert every round upfront, collect IDs for bye propagation
      const matchIdMap = new Map<string, string>()
      for (let round = 1; round <= totalRounds; round++) {
        const matchCount = slots / Math.pow(2, round)
        for (let matchNum = 1; matchNum <= matchCount; matchNum++) {
          let payload: Record<string, unknown> = {
            phase_id: main.id,
            round,
            match_number: matchNum,
            participant1_type: 'player',
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
            {genderLabel[div.gender]} {divisions.find(d => d.id === div.id)?.name}
          </button>
        ))}
      </div>

      {selectedDivId && (
        <div className="glass rounded-2xl p-6 border border-white/10 space-y-5">
          <div className="space-y-1">
            <h2 className="font-semibold">대진 설정</h2>
            <p className="text-sm text-muted-foreground">등록된 선수: {players.length}명</p>
          </div>

          {prelim && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">조 수 (예선)</label>
              <div className="flex gap-2">
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
              <p className="text-xs text-muted-foreground">
                조당 약 {Math.ceil(players.length / groupCount)}명 · 조당 {prelim.advancement_count ?? 2}명 본선 진출
              </p>
            </div>
          )}

          {!prelim && (
            <div className="text-sm text-muted-foreground">
              예선 없이 바로 본선 토너먼트 ({players.length}명 → {Math.ceil(Math.log2(Math.pow(2, Math.ceil(Math.log2(players.length)))))} 라운드)
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
              disabled={loading || players.length < 2}
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
