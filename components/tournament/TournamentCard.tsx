import Link from 'next/link'
import { Calendar, MapPin, Users } from 'lucide-react'
import type { Tournament } from '@/lib/types'
import { cn } from '@/lib/utils'

const statusLabel: Record<string, string> = {
  draft: '준비 중',
  registration: '참가 접수 중',
  in_progress: '진행 중',
  completed: '종료',
}

export default function TournamentCard({ tournament }: { tournament: Tournament }) {
  const { id, name, venue, start_date, end_date, status } = tournament

  return (
    <Link href={`/tournaments/${id}`} className="block group">
      <div className="glass rounded-2xl p-5 hover:bg-white/10 transition-all duration-200 hover:scale-[1.01] border border-white/10">
        <div className="flex items-start justify-between mb-3">
          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', `status-${status}`)}>
            {statusLabel[status] ?? status}
          </span>
        </div>
        <h3 className="font-bold text-base text-foreground mb-3 group-hover:text-primary transition-colors line-clamp-2">
          {name}
        </h3>
        <div className="space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{start_date} ~ {end_date}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{venue}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
