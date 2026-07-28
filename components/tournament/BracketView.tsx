'use client'
import { cn } from '@/lib/utils'
import type { Match, MatchSet } from '@/lib/types'
import { getRoundName } from '@/lib/utils/bracket'

interface BracketMatch extends Match {
  p1Name?: string
  p2Name?: string
  p1Club?: string
  p2Club?: string
  p1Label?: string  // 예선 미확정 슬롯 예상 배정 (예: "1조 1위")
  p2Label?: string
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
                  className="text-sm font-semibold text-foreground text-center"
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
                        <g key={p} style={{ stroke: 'var(--bracket-line)' }} strokeWidth="1.5" fill="none">
                          <polyline points={`0,${yTop} ${xMid},${yTop} ${xMid},${yBot} 0,${yBot}`} />
                          <line x1={xMid} y1={yMid} x2={CONN_W} y2={yMid} />
                        </g>
                      )
                    })}
                    {n % 2 === 1 && (() => {
                      const yLone = matchAreaH * (2 * (n - 1) + 1) / (2 * n)
                      return <line key="lone" x1="0" y1={yLone} x2={CONN_W} y2={yLone} style={{ stroke: 'var(--bracket-line)' }} strokeWidth="1.5" />
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
  const { p1Name, p1Club, p1Label, p2Name, p2Club, p2Label, score1, score2, status, winner_id, participant1_id, participant2_id } = match
  const isBye = status === 'bye'
  const isDone = status === 'completed'
  const sets = (match.sets ?? []) as MatchSet[]

  return (
    <div className="glass rounded-xl overflow-hidden border border-border" style={{ width: CARD_W }}>
      <ParticipantRow
        name={p1Name}
        label={p1Label}
        club={p1Club}
        score={score1}
        isWinner={isDone && winner_id === participant1_id}
        isEmpty={!p1Name}
        isTeam={isTeam}
      />
      <div className="h-px bg-border" />
      <ParticipantRow
        name={isBye ? '부전승' : p2Name}
        label={isBye ? undefined : p2Label}
        club={isBye ? undefined : p2Club}
        score={score2}
        isWinner={isDone && winner_id === participant2_id}
        isEmpty={!p2Name && !isBye}
        isTeam={isTeam}
      />
    </div>
  )
}

function ParticipantRow({
  name, label, club, score, isWinner, isEmpty, isTeam,
}: {
  name?: string; label?: string; club?: string; score: number; isWinner: boolean; isEmpty: boolean; isTeam: boolean
}) {
  const displayLabel = !name && label  // 실제 선수 미확정 + 예상 배정 있을 때
  return (
    <div className={cn(
      'flex items-center justify-between px-3 py-2 text-sm',
      isWinner && 'bg-primary/10',
      isEmpty && !displayLabel && 'opacity-40'
    )}>
      <div className="flex-1 min-w-0 mr-2">
        {displayLabel ? (
          <div className="text-xs italic text-muted-foreground truncate">{label}</div>
        ) : (
          <div className={cn('font-medium truncate', isWinner ? 'text-primary' : 'text-foreground')}>
            {name ?? 'TBD'}
            {!isTeam && club && (
              <span className="text-xs font-normal text-muted-foreground ml-1">({club})</span>
            )}
          </div>
        )}
        {!displayLabel && isTeam && club && (
          <div className="text-xs text-muted-foreground truncate">{club}</div>
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
