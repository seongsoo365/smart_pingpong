'use client'
import { cn } from '@/lib/utils'
import type { Match } from '@/lib/types'
import { getRoundName } from '@/lib/utils/bracket'

interface BracketMatch extends Match {
  p1Name?: string
  p2Name?: string
}

interface Props {
  matches: BracketMatch[]
  totalRounds: number
}

export default function BracketView({ matches, totalRounds }: Props) {
  const rounds: BracketMatch[][] = []
  for (let r = 1; r <= totalRounds; r++) {
    rounds.push(matches.filter(m => m.round === r))
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-6 min-w-max">
        {rounds.map((roundMatches, ri) => (
          <div key={ri} className="flex flex-col justify-around gap-4">
            <div className="text-xs font-semibold text-muted-foreground text-center mb-2 uppercase tracking-wider">
              {getRoundName(ri + 1, totalRounds)}
            </div>
            {roundMatches.map((match) => (
              <BracketMatchCard key={match.id} match={match} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function BracketMatchCard({ match }: { match: BracketMatch }) {
  const { p1Name, p2Name, score1, score2, status, winner_id, participant1_id, participant2_id } = match
  const isBye = status === 'bye'
  const isDone = status === 'completed'

  return (
    <div className="glass rounded-xl overflow-hidden border border-white/10 w-48">
      <ParticipantRow
        name={p1Name}
        score={score1}
        isWinner={isDone && winner_id === participant1_id}
        isEmpty={!p1Name}
      />
      <div className="h-px bg-white/10" />
      <ParticipantRow
        name={isBye ? '부전승' : p2Name}
        score={score2}
        isWinner={isDone && winner_id === participant2_id}
        isEmpty={!p2Name && !isBye}
      />
    </div>
  )
}

function ParticipantRow({
  name, score, isWinner, isEmpty,
}: {
  name?: string; score: number; isWinner: boolean; isEmpty: boolean
}) {
  return (
    <div className={cn(
      'flex items-center justify-between px-3 py-2.5 text-sm',
      isWinner && 'bg-primary/10',
      isEmpty && 'opacity-40'
    )}>
      <span className={cn('font-medium truncate flex-1 mr-2', isWinner ? 'text-primary' : 'text-foreground')}>
        {name ?? (isEmpty ? 'TBD' : name)}
      </span>
      {name && !isEmpty && (
        <span className={cn('font-bold text-base tabular-nums', isWinner ? 'text-primary' : 'text-muted-foreground')}>
          {score}
        </span>
      )}
    </div>
  )
}
