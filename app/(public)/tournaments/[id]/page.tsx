import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Calendar, MapPin, ChevronRight, ChevronDown, ClipboardList, Users, Clock, ShieldCheck, MessageCircle } from 'lucide-react'
import { createClientSafe } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import type { Division, Team, TeamMember, TournamentQuestion } from '@/lib/types'
import QnaSection from '@/components/tournament/QnaSection'
import MyRegistrationStatus from '@/components/tournament/MyRegistrationStatus'

const genderLabel: Record<string, string> = { male: '남자', female: '여자', mixed: '혼합' }
const matchTypeLabel: Record<string, string> = { individual: '개인전', team: '단체전' }
const statusLabel: Record<string, string> = {
  draft: '준비 중', registration: '접수 중', in_progress: '진행 중', completed: '종료',
}

interface TeamWithMembers extends Team { members: TeamMember[]; created_at?: string }
interface DivisionWithTeams extends Division {
  approvedTeams: TeamWithMembers[]
  pendingTeams: TeamWithMembers[]
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClientSafe()
  if (!supabase) notFound()

  const { data: tournament } = await supabase
    .from('tournaments').select('*, admin:admin_id(name)').eq('id', id).single()
  if (!tournament) notFound()

  const [{ data: divisions }, { data: questions }] = await Promise.all([
    supabase.from('divisions').select('*').eq('tournament_id', id).order('display_order'),
    supabase.from('tournament_questions')
      .select('*')
      .eq('tournament_id', id)
      .not('answer', 'is', null)
      .eq('is_public', true)
      .order('answered_at', { ascending: true }),
  ])

  const teamDivisions = (divisions ?? []).filter((d: Division) => d.match_type === 'team')
  let teamDivisionsWithTeams: DivisionWithTeams[] = []
  if (teamDivisions.length > 0) {
    const teamDivIds = teamDivisions.map((d: Division) => d.id)
    const { data: allTeams } = await supabase
      .from('teams')
      .select('*, members:team_members(*)')
      .in('division_id', teamDivIds)
      .order('created_at')
    const teamsData = (allTeams ?? []) as TeamWithMembers[]
    teamDivisionsWithTeams = teamDivisions.map((div: Division) => {
      const divTeams = teamsData.filter(t => t.division_id === div.id)
        .map(t => ({ ...t, members: [...(t.members ?? [])].sort((a, b) => a.player_order - b.player_order) }))
      return {
        ...div,
        approvedTeams: divTeams.filter(t => t.confirmed),
        pendingTeams: divTeams.filter(t => !t.confirmed),
      }
    })
  }

  const status = tournament.status
  const showRegulations = (status === 'draft' || status === 'registration')
  const showTeams      = status === 'registration'
  const showBracket    = status === 'in_progress' || status === 'completed'
  const showQna        = status === 'draft' || status === 'registration'

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div className="glass rounded-2xl p-6 border border-white/10">
        <div className="space-y-3">
          <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', `status-${tournament.status}`)}>
            {statusLabel[tournament.status]}
          </span>
          <h1 className="text-2xl font-extrabold">{tournament.name}</h1>
          {tournament.description && (
            <p className="text-muted-foreground text-sm">{tournament.description}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> {tournament.start_date} ~ {tournament.end_date}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" /> {tournament.venue}
            </span>
          </div>
          {tournament.registration_start && (
            <p className="text-sm text-muted-foreground">
              접수 기간: {tournament.registration_start} ~ {tournament.registration_end}
            </p>
          )}
          {tournament.status === 'registration' && (
            <Link href={`/tournaments/${id}/register`}
              className="inline-flex items-center gap-2 mt-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors">
              <ClipboardList className="w-4 h-4" /> 참가 신청하기
            </Link>
          )}
        </div>
      </div>

      <MyRegistrationStatus tournamentId={id} />

      {tournament.regulations && (
        <details open={showRegulations} className="glass rounded-2xl border border-white/10 group">
          <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none select-none hover:bg-white/[0.03] transition-colors rounded-2xl">
            <h2 className="text-lg font-bold">대회요강</h2>
            <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="px-6 pb-5">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {tournament.regulations}
            </p>
          </div>
        </details>
      )}

      {teamDivisionsWithTeams.length > 0 && (
        <details open={showTeams} className="glass rounded-2xl border border-white/10 group overflow-hidden">
          <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none select-none hover:bg-white/[0.03] transition-colors">
            <h2 className="text-lg font-bold">참가 팀 현황</h2>
            <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="space-y-4 px-4 pb-4">
            {teamDivisionsWithTeams.map(div => {
              const max = div.max_teams
              const approved = div.approvedTeams.length
              const pending = div.pendingTeams.length
              const isFull = max !== null && max !== undefined && approved >= max
              return (
                <div key={div.id} className="glass rounded-2xl border border-white/10 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/5">
                    <span className="font-semibold text-sm">
                      {genderLabel[div.gender]} {div.name}
                    </span>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                        승인 {approved}{max ? `/${max}` : ''}팀
                      </span>
                      {pending > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-accent" />
                          대기 {pending}팀
                        </span>
                      )}
                      {isFull && (
                        <span className="px-1.5 py-0.5 rounded-full bg-destructive/20 text-destructive">마감</span>
                      )}
                    </div>
                  </div>
                  {div.approvedTeams.length > 0 ? (
                    <div className="divide-y divide-white/10">
                      {div.approvedTeams.map((team, i) => (
                        <details key={team.id} className="group/team">
                          <summary className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-white/5 transition-colors list-none">
                            <span className="text-muted-foreground text-sm w-5 shrink-0 text-right">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{team.name}</span>
                              {team.club && <span className="text-sm text-muted-foreground ml-2">{team.club}</span>}
                            </div>
                            <span className="text-sm text-muted-foreground shrink-0">
                              {team.members.length}명
                              <ChevronRight className="w-3.5 h-3.5 inline ml-1 transition-transform group-open/team:rotate-90" />
                            </span>
                          </summary>
                          <div className="px-5 pb-3 pt-1 space-y-1 bg-white/[0.02]">
                            {team.members.map(m => (
                              <div key={m.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="w-4 text-right text-xs shrink-0">{m.player_order}</span>
                                <span className="text-foreground">
                                  {m.player_name}
                                  {m.player_level && <span className="text-muted-foreground text-xs ml-0.5">({m.player_level}부)</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-5">아직 승인된 팀이 없습니다.</p>
                  )}
                  {div.pendingTeams.length > 0 && (
                    <div className="border-t border-white/10">
                      <div className="px-5 py-2 bg-accent/5">
                        <span className="text-xs font-medium text-accent flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" /> 대기 순번
                        </span>
                      </div>
                      <div className="divide-y divide-white/10">
                        {div.pendingTeams.map((team, i) => (
                          <div key={team.id} className="flex items-center gap-3 px-5 py-3.5">
                            <span className="text-accent text-sm w-5 shrink-0 text-right font-medium">{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-muted-foreground">{team.name}</span>
                              {team.club && <span className="text-sm text-muted-foreground ml-2">{team.club}</span>}
                            </div>
                            <span className="text-sm text-muted-foreground shrink-0">
                              <Users className="w-3 h-3 inline mr-0.5" />{team.members.length}명
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </details>
      )}

      <details open={showBracket} className="glass rounded-2xl border border-white/10 group">
        <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none select-none hover:bg-white/[0.03] transition-colors rounded-2xl">
          <h2 className="text-lg font-bold">부수별 대진</h2>
          <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4 space-y-3">
          {(divisions?.length ?? 0) > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {divisions?.map((div: Division) => (
                <Link key={div.id} href={`/tournaments/${id}/divisions/${div.id}`}
                  className="glass rounded-xl p-4 border border-white/10 hover:bg-white/10 hover:border-primary/30 transition-all group/div">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-base group-hover/div:text-primary transition-colors">
                        {genderLabel[div.gender]} {div.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{matchTypeLabel[div.match_type]}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover/div:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm px-2">아직 부수가 등록되지 않았습니다.</p>
          )}
        </div>
      </details>

      <details open={showQna} className="glass rounded-2xl border border-white/10 group">
        <summary className="flex items-center justify-between px-6 py-4 cursor-pointer list-none select-none hover:bg-white/[0.03] transition-colors rounded-2xl">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" /> Q&amp;A
          </h2>
          <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
        </summary>
        <div className="px-4 pb-4">
          <QnaSection
            tournamentId={id}
            initialQuestions={(questions ?? []) as TournamentQuestion[]}
            hideTitle
          />
        </div>
      </details>
    </div>
  )
}
