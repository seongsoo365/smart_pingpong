-- 공동 관리자 연결 테이블
CREATE TABLE tournament_admins (
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  added_by      UUID REFERENCES user_profiles(id),
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (tournament_id, user_id)
);

ALTER TABLE tournament_admins ENABLE ROW LEVEL SECURITY;

-- 공개 읽기 (대시보드 쿼리 등에서 사용)
CREATE POLICY "Public read tournament_admins" ON tournament_admins FOR SELECT USING (true);

-- 대회 관리자 판별 헬퍼 함수 (SECURITY DEFINER — get_my_role()과 동일 패턴)
-- admin_id, created_by, co-admin, system_admin 중 하나라도 해당하면 true
CREATE OR REPLACE FUNCTION is_tournament_admin(t_id UUID)
RETURNS BOOLEAN LANGUAGE SQL SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM tournaments t WHERE t.id = t_id AND (
      t.admin_id   = auth.uid()
      OR t.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM tournament_admins ta
        WHERE ta.tournament_id = t.id AND ta.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM user_profiles up
        WHERE up.id = auth.uid() AND up.role = 'system_admin'
      )
    )
  )
$$;

-- tournament_admins 쓰기: admin_id / created_by / system_admin 만 가능
CREATE POLICY "Admins manage tournament_admins" ON tournament_admins FOR ALL TO authenticated
  USING (is_tournament_admin(tournament_id));

-- 기존 RLS 정책을 is_tournament_admin() 기반으로 교체 ---------------------

-- tournaments
DROP POLICY IF EXISTS "Admins manage tournaments" ON tournaments;
CREATE POLICY "Admins manage tournaments" ON tournaments FOR ALL TO authenticated
  USING (is_tournament_admin(id));

-- divisions
DROP POLICY IF EXISTS "Admins manage divisions" ON divisions;
CREATE POLICY "Admins manage divisions" ON divisions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND is_tournament_admin(t.id)
    )
  );

-- division_merges
DROP POLICY IF EXISTS "Admins manage merges" ON division_merges;
CREATE POLICY "Admins manage merges" ON division_merges FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND is_tournament_admin(t.id)
    )
  );

-- tournament_phases
DROP POLICY IF EXISTS "Admins manage phases" ON tournament_phases;
CREATE POLICY "Admins manage phases" ON tournament_phases FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id AND is_tournament_admin(t.id)
    )
  );

-- groups
DROP POLICY IF EXISTS "Admins manage groups" ON groups;
CREATE POLICY "Admins manage groups" ON groups FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournament_phases tp
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE tp.id = phase_id AND is_tournament_admin(t.id)
    )
  );

-- players
DROP POLICY IF EXISTS "Admins manage players" ON players;
CREATE POLICY "Admins manage players" ON players FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id AND is_tournament_admin(t.id)
    )
  );

-- teams
DROP POLICY IF EXISTS "Admins manage teams" ON teams;
CREATE POLICY "Admins manage teams" ON teams FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id AND is_tournament_admin(t.id)
    )
  );

-- team_members
DROP POLICY IF EXISTS "Admins manage team_members" ON team_members;
CREATE POLICY "Admins manage team_members" ON team_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams tm
      JOIN divisions d ON d.id = tm.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE tm.id = team_id AND is_tournament_admin(t.id)
    )
  );

-- matches
DROP POLICY IF EXISTS "Admins manage matches" ON matches;
CREATE POLICY "Admins manage matches" ON matches FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournament_phases tp
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE tp.id = phase_id AND is_tournament_admin(t.id)
    )
  );

-- match_sets
DROP POLICY IF EXISTS "Admins manage match_sets" ON match_sets;
CREATE POLICY "Admins manage match_sets" ON match_sets FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN tournament_phases tp ON tp.id = m.phase_id
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE m.id = match_id AND is_tournament_admin(t.id)
    )
  );

-- standings
DROP POLICY IF EXISTS "Admins manage standings" ON standings;
CREATE POLICY "Admins manage standings" ON standings FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN tournament_phases tp ON tp.id = g.phase_id
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE g.id = group_id AND is_tournament_admin(t.id)
    )
  );
