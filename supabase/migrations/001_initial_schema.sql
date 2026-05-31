-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User profiles (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'tournament_admin' CHECK (role IN ('system_admin', 'tournament_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournaments
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  venue TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  registration_start DATE,
  registration_end DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'registration', 'in_progress', 'completed')),
  logo_url TEXT,
  created_by UUID REFERENCES user_profiles(id),
  admin_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Divisions (부수)
CREATE TABLE divisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL DEFAULT 'male' CHECK (gender IN ('male', 'female', 'mixed')),
  match_type TEXT NOT NULL DEFAULT 'individual' CHECK (match_type IN ('individual', 'team')),
  display_order INT NOT NULL DEFAULT 0,
  min_participants INT DEFAULT 4
);

-- Division merges (통합 부수)
CREATE TABLE division_merges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  division_ids UUID[] NOT NULL
);

-- Tournament phases (예선/본선)
CREATE TABLE tournament_phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  phase_type TEXT NOT NULL CHECK (phase_type IN ('preliminary', 'main')),
  phase_order INT NOT NULL DEFAULT 1,
  format TEXT NOT NULL CHECK (format IN ('round_robin', 'single_elimination', 'double_elimination', 'group_knockout')),
  games_per_match INT NOT NULL DEFAULT 3,
  points_per_game INT NOT NULL DEFAULT 11,
  advancement_count INT DEFAULT 2,
  is_active BOOLEAN DEFAULT TRUE
);

-- Groups (조)
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phase_id UUID NOT NULL REFERENCES tournament_phases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0
);

-- Players (개인전 선수)
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  club TEXT,
  phone TEXT,
  seed INT,
  group_id UUID REFERENCES groups(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Teams (단체전 팀)
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  club TEXT,
  seed INT,
  group_id UUID REFERENCES groups(id)
);

-- Team members
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  player_order INT NOT NULL DEFAULT 0
);

-- Matches
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phase_id UUID NOT NULL REFERENCES tournament_phases(id) ON DELETE CASCADE,
  group_id UUID REFERENCES groups(id),
  round INT NOT NULL DEFAULT 1,
  match_number INT NOT NULL DEFAULT 1,
  participant1_id UUID,
  participant2_id UUID,
  participant1_type TEXT NOT NULL DEFAULT 'player' CHECK (participant1_type IN ('player', 'team')),
  score1 INT NOT NULL DEFAULT 0,
  score2 INT NOT NULL DEFAULT 0,
  winner_id UUID,
  table_number INT,
  scheduled_time TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'bye')),
  notes TEXT
);

-- Match sets (세트별 점수)
CREATE TABLE match_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  set_number INT NOT NULL,
  score1 INT NOT NULL DEFAULT 0,
  score2 INT NOT NULL DEFAULT 0
);

-- Standings cache (조별 순위)
CREATE TABLE standings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  participant_id UUID NOT NULL,
  wins INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  sets_won INT NOT NULL DEFAULT 0,
  sets_lost INT NOT NULL DEFAULT 0,
  points_won INT NOT NULL DEFAULT 0,
  points_lost INT NOT NULL DEFAULT 0,
  ranking INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, participant_id)
);

-- Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_merges ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE standings ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Public read divisions" ON divisions FOR SELECT USING (true);
CREATE POLICY "Public read division_merges" ON division_merges FOR SELECT USING (true);
CREATE POLICY "Public read phases" ON tournament_phases FOR SELECT USING (true);
CREATE POLICY "Public read groups" ON groups FOR SELECT USING (true);
CREATE POLICY "Public read players" ON players FOR SELECT USING (true);
CREATE POLICY "Public read teams" ON teams FOR SELECT USING (true);
CREATE POLICY "Public read team_members" ON team_members FOR SELECT USING (true);
CREATE POLICY "Public read matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Public read match_sets" ON match_sets FOR SELECT USING (true);
CREATE POLICY "Public read standings" ON standings FOR SELECT USING (true);

-- Admin write policies (tournament admins can write their own tournaments)
CREATE POLICY "Admins read profiles" ON user_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage tournaments" ON tournaments FOR ALL TO authenticated
  USING (admin_id = auth.uid() OR created_by = auth.uid() OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin'));

CREATE POLICY "Admins manage divisions" ON divisions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tournaments t WHERE t.id = tournament_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin'))
  ));

CREATE POLICY "Admins manage merges" ON division_merges FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tournaments t WHERE t.id = tournament_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin'))
  ));

CREATE POLICY "Admins manage phases" ON tournament_phases FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM divisions d JOIN tournaments t ON t.id = d.tournament_id
    WHERE d.id = division_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin'))
  ));

CREATE POLICY "Admins manage groups" ON groups FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tournament_phases tp
    JOIN divisions d ON d.id = tp.division_id
    JOIN tournaments t ON t.id = d.tournament_id
    WHERE tp.id = phase_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin'))
  ));

CREATE POLICY "Admins manage players" ON players FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM divisions d JOIN tournaments t ON t.id = d.tournament_id
    WHERE d.id = division_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin'))
  ));

CREATE POLICY "Admins manage teams" ON teams FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM divisions d JOIN tournaments t ON t.id = d.tournament_id
    WHERE d.id = division_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin'))
  ));

CREATE POLICY "Admins manage team_members" ON team_members FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM teams tm
    JOIN divisions d ON d.id = tm.division_id
    JOIN tournaments t ON t.id = d.tournament_id
    WHERE tm.id = team_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin'))
  ));

CREATE POLICY "Admins manage matches" ON matches FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tournament_phases tp
    JOIN divisions d ON d.id = tp.division_id
    JOIN tournaments t ON t.id = d.tournament_id
    WHERE tp.id = phase_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin'))
  ));

CREATE POLICY "Admins manage match_sets" ON match_sets FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matches m
    JOIN tournament_phases tp ON tp.id = m.phase_id
    JOIN divisions d ON d.id = tp.division_id
    JOIN tournaments t ON t.id = d.tournament_id
    WHERE m.id = match_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin'))
  ));

CREATE POLICY "Admins manage standings" ON standings FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM groups g
    JOIN tournament_phases tp ON tp.id = g.phase_id
    JOIN divisions d ON d.id = tp.division_id
    JOIN tournaments t ON t.id = d.tournament_id
    WHERE g.id = group_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin'))
  ));

CREATE POLICY "System admin manages profiles" ON user_profiles FOR ALL TO authenticated
  USING (id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin'));

-- Function: auto-create user_profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, name, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), 'tournament_admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Indexes for performance
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_divisions_tournament ON divisions(tournament_id);
CREATE INDEX idx_phases_division ON tournament_phases(division_id);
CREATE INDEX idx_groups_phase ON groups(phase_id);
CREATE INDEX idx_players_division ON players(division_id);
CREATE INDEX idx_players_group ON players(group_id);
CREATE INDEX idx_teams_division ON teams(division_id);
CREATE INDEX idx_matches_phase ON matches(phase_id);
CREATE INDEX idx_matches_group ON matches(group_id);
CREATE INDEX idx_match_sets_match ON match_sets(match_id);
CREATE INDEX idx_standings_group ON standings(group_id);
