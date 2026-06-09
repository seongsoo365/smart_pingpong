export type UserRole = 'system_admin' | 'tournament_admin' | 'viewer'
export type TournamentStatus = 'draft' | 'registration' | 'in_progress' | 'completed'
export type Gender = 'male' | 'female' | 'mixed'
export type MatchType = 'individual' | 'team'
export type PhaseType = 'preliminary' | 'main'
export type PhaseFormat = 'round_robin' | 'single_elimination' | 'double_elimination' | 'group_knockout'
export type MatchStatus = 'pending' | 'in_progress' | 'completed' | 'bye'
export type TeamMatchFormat =
  | 'olympic'             // 올림픽 공식 (3인, 복·단·단·단)
  | 'traditional_4s1d'    // 4단 1복 (최소4인, 단·단·복·단·단)
  | 'swaythling'          // 스웨이틀링 컵 (3명, 9전5선승)
  | 'singles_2_doubles_1' // 2단 1복 (2-3명, 단·복·단)
  | 'three_doubles'       // 3복식 (6명)
  | 'three_singles'       // 3단식 (3명, 3전2선)

export interface UserProfile {
  id: string
  email: string
  name: string
  phone?: string
  role: UserRole
  provider?: string
  avatar_url?: string
  password_changed?: boolean
  created_at: string
}

export interface Tournament {
  id: string
  name: string
  description?: string
  venue: string
  start_date: string
  end_date: string
  registration_start?: string
  registration_end?: string
  status: TournamentStatus
  logo_url?: string
  regulations?: string
  created_by: string
  admin_id: string
  created_at: string
  admin?: UserProfile
}

export interface Division {
  id: string
  tournament_id: string
  name: string
  gender: Gender
  match_type: MatchType
  team_match_format?: TeamMatchFormat
  display_order: number
  min_participants?: number
  max_teams?: number
  tournament?: Tournament
}

export interface DivisionMerge {
  id: string
  tournament_id: string
  name: string
  division_ids: string[]
}

export interface TournamentPhase {
  id: string
  division_id: string
  phase_type: PhaseType
  phase_order: number
  format: PhaseFormat
  games_per_match: number
  points_per_game: number
  advancement_count?: number
  is_active: boolean
  division?: Division
}

export interface Group {
  id: string
  phase_id: string
  name: string
  display_order: number
}

export interface Player {
  id: string
  division_id: string
  name: string
  club?: string
  phone?: string
  email?: string
  seed?: number
  group_id?: string
  confirmed: boolean
  created_at: string
  division?: Division
  group?: Group
}

export interface Team {
  id: string
  division_id: string
  name: string
  club?: string
  email?: string
  seed?: number
  group_id?: string
  confirmed: boolean
  created_at?: string
  members?: TeamMember[]
}

export interface TeamMember {
  id: string
  team_id: string
  player_name: string
  player_order: number
  player_level?: number
}

export interface Match {
  id: string
  phase_id: string
  group_id?: string
  round: number
  match_number: number
  participant1_id?: string
  participant2_id?: string
  participant1_type: 'player' | 'team'
  score1: number
  score2: number
  winner_id?: string
  table_number?: number
  scheduled_time?: string
  started_at?: string
  ended_at?: string
  status: MatchStatus
  notes?: string
  sets?: MatchSet[]
  participant1?: Player | Team
  participant2?: Player | Team
}

export interface MatchSet {
  id: string
  match_id: string
  set_number: number
  score1: number
  score2: number
}

export interface Standing {
  id: string
  group_id: string
  participant_id: string
  wins: number
  losses: number
  sets_won: number
  sets_lost: number
  points_won: number
  points_lost: number
  ranking: number
  updated_at: string
  participant?: Player | Team
}

export interface TournamentQuestion {
  id: string
  tournament_id: string
  author_name: string
  author_email?: string
  question: string
  answer?: string
  answered_by?: string
  answered_at?: string
  is_public: boolean
  created_at: string
}

export interface TournamentWithDivisions extends Tournament {
  divisions: (Division & {
    phases: TournamentPhase[]
    merges?: DivisionMerge[]
  })[]
}
