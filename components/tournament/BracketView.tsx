'use client'
import { cn } from '@/lib/utils'
import type { Match, MatchSet } from '@/lib/types'
import { getRoundName } from '@/lib/utils/bracket'

interface BracketMatch extends Match {
  p1Name?: string
  p2Name?: string
  p1Club?: string
  p2Club?: string
}

interface Props {
  matches: BracketMatch[]
  totalRounds: number
  isTeam?: boolean
}

const CARD_W = 200   // px
const SLOT_H = 96    // px
const CONN_W = 36    // px
const HEADER_H = 28  // px

export default function BracketView({ matches, totalRounds, isTeam = false }: Props) {
  const rounds: BracketMatch[][] = []
  for (let r = 1; r <= totalRounds; r++) {
    rounds.push(matches.filter(m => m.round === r))
  }

  const maxMatches = Math.max(...rounds.map(r => r.length), 1)
  const matchAreaH = maxMatches * SLOT_H

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max items-start">
        {rounds.map((roundMatches, ri) => {
          const isLast = ri === rounds.length - 1
          const n = roundMatches.length || 1

          return (
            <div key={ri} className="flex items-start">
              <div style={{ width: CARD_W }}>
                <div
                  className="text-xs font-semibold text-muted-foreground text-center uppercase tracking-wider"
                  style={{ height: HEADER_H, lineHeight: `${HEADER_H}px` }}
                >
                  {getRoundName(ri + 1, totalRounds)}
                </div>
                <div className="flex flex-col justify-around" style={{ height: matchAreaH }}>
                  {roundMatches.map(match => (
                    <BracketMatchCard key={match.id} match={match} isTeam={isTeam} />
                  ))}
                </div>
              </div>

              {!isLast && (
                <div style={{ paddingTop: HEADER_H }}>
                  <svg width={CONN_W} height={matchAreaH} className="shrink-0 overflow-visible">
                    {Array.from({ length: Math.floor(n / 2) }, (_, p) => {
                      const yTop = matchAreaH * (4 * p + 1) / (2 * n)
                      const yBot = matchAreaH * (4 * p + 3) / (2 * n)
                      const yMid = (yTop + yBot) / 2
                      const xMid = CONN_W / 2
                      return (
                        <g key={p} stroke="rgba(255,255,255,0.18)" strokeWidth="1" fill="none">
                          <polyline points={`0,${yTop} ${xMid},${yTop} ${xMid},${yBot} 0,${yBot}`} />
                          <line x1={xMid} y1={yMid} x2={CONN_W} y2={yMid} />
                        </g>
                      )
                    })}
                    {n % 2 === 1 && (() => {
                      const yLone = matchAreaH * (2 * (n - 1) + 1) / (2 * n)
                      return <line key="lone" x1="0" y1={yLone} x2={CONN_W} y2={yLone} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
                    })()}
                  </svg>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BracketMatchCard({ match, isTeam }: { match: BracketMatch; isTeam: boolean }) {
  const { p1Name, p1Club, p2Name, p2Club, score1, score2, status, winner_id, participant1_id, participant2_id } = match
  const isBye = status === 'bye'
  const isDone = status === 'completed'
  const sets = (match.sets ?? []) as MatchSet[]

  return (
    <div className="glass rounded-xl overflow-hidden border border-white/10" style={{ width: CARD_W }}>
      <ParticipantRow
        name={p1Name}
        club={p1Club}
        score={score1}
        isWinner={isDone && winner_id === participant1_id}
        isEmpty={!p1Name}
        isTeam={isTeam}
      />
      <div className="h-px bg-white/10" />
      <ParticipantRow
        name={isBye ? '부전승' : p2Name}
        club={isBye ? undefined : p2Club}
        score={score2}
        isWinner={isDone && winner_id === participant2_id}
        isEmpty={!p2Name && !isBye}
        isTeam={isTeam}
      />
      {/* 단체전 개인경기 결과 요약 */}
      {isTeam && isDone && sets.length > 0 && (
        <div className="flex items-center justify-center gap-0.5 px-3 py-1.5 border-t border-white/10">
          {sets.map((s, i) => {
            const p1Won = s.score1 > s.score2
            const p2Won = s.score2 > s.score1
            return (
              <span
                key={i}
                title={p1Won ? (p1Name ?? '팀1') : p2Won ? (p2Name ?? '팀2') : '-'}
                className={cn(
                  'w-2.5 h-2.5 rounded-full shrink-0',
                  p1Won ? 'bg-primary' : p2Won ? 'bg-accent' : 'bg-white/20'
                )}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function ParticipantRow({
  name, club, score, isWinner, isEmpty, isTeam,
}: {
  name?: string; club?: string; score: number; isWinner: boolean; isEmpty: boolean; isTeam: boolean
}) {
  return (
    <div className={cn(
      'flex items-center justify-between px-3 py-2 text-sm',
      isWinner && 'bg-primary/10',
      isEmpty && 'opacity-40'
    )}>
      <div className="flex-1 min-w-0 mr-2">
        <div className={cn('font-medium truncate', isWinner ? 'text-primary' : 'text-foreground')}>
          {name ?? 'TBD'}
          {!isTeam && club && (
            <span className="text-[11px] font-normal text-muted-foreground ml-1">({club})</span>
          )}
        </div>
        {isTeam && club && (
          <div className="text-[11px] text-muted-foreground truncate">{club}</div>
        )}
      </div>
      {name && !isEmpty && (
        <span className={cn(
          'font-bold text-base tabular-nums shrink-0',
          isWinner ? 'text-primary' : 'text-muted-foreground'
        )}>
          {score}
        </span>
      )}
    </div>
  )
}
