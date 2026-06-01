'use client'
import { cn } from '@/lib/utils'
import type { Match } from '@/lib/types'
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
}

const CARD_W = 192   // px — match card width
const SLOT_H = 96    // px — height per slot in the first round (card + spacing)
const CONN_W = 36    // px — connector column width
const HEADER_H = 28  // px — round label height

export default function BracketView({ matches, totalRounds }: Props) {
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
              {/* Round column */}
              <div style={{ width: CARD_W }}>
                <div
                  className="text-xs font-semibold text-muted-foreground text-center uppercase tracking-wider"
                  style={{ height: HEADER_H, lineHeight: `${HEADER_H}px` }}
                >
                  {getRoundName(ri + 1, totalRounds)}
                </div>
                <div
                  className="flex flex-col justify-around"
                  style={{ height: matchAreaH }}
                >
                  {roundMatches.map(match => (
                    <BracketMatchCard key={match.id} match={match} />
                  ))}
                </div>
              </div>

              {/* SVG connector to next round */}
              {!isLast && (
                <div style={{ paddingTop: HEADER_H }}>
                  <svg
                    width={CONN_W}
                    height={matchAreaH}
                    className="shrink-0 overflow-visible"
                  >
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
                    {/* odd match (bye slot at bottom) straight through */}
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

function BracketMatchCard({ match }: { match: BracketMatch }) {
  const { p1Name, p1Club, p2Name, p2Club, score1, score2, status, winner_id, participant1_id, participant2_id } = match
  const isBye = status === 'bye'
  const isDone = status === 'completed'

  return (
    <div className="glass rounded-xl overflow-hidden border border-white/10" style={{ width: CARD_W }}>
      <ParticipantRow
        name={p1Name}
        club={p1Club}
        score={score1}
        isWinner={isDone && winner_id === participant1_id}
        isEmpty={!p1Name}
      />
      <div className="h-px bg-white/10" />
      <ParticipantRow
        name={isBye ? '부전승' : p2Name}
        club={isBye ? undefined : p2Club}
        score={score2}
        isWinner={isDone && winner_id === participant2_id}
        isEmpty={!p2Name && !isBye}
      />
    </div>
  )
}

function ParticipantRow({
  name, club, score, isWinner, isEmpty,
}: {
  name?: string; club?: string; score: number; isWinner: boolean; isEmpty: boolean
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
          {club && (
            <span className="text-[11px] font-normal text-muted-foreground ml-1">({club})</span>
          )}
        </div>
      </div>
      {name && !isEmpty && (
        <span className={cn('font-bold text-base tabular-nums shrink-0', isWinner ? 'text-primary' : 'text-muted-foreground')}>
          {score}
        </span>
      )}
    </div>
  )
}
