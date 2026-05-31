-- user_profiles 정책의 재귀 참조 버그 수정
-- 기존 정책 삭제
DROP POLICY IF EXISTS "Admins read profiles" ON user_profiles;
DROP POLICY IF EXISTS "System admin manages profiles" ON user_profiles;

-- SECURITY DEFINER 함수: RLS를 우회하여 role 조회 (재귀 방지)
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 새 정책: 본인 프로필은 누구나 조회, 시스템 관리자는 전체 조회/수정
CREATE POLICY "Users read own profile" ON user_profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR get_my_role() = 'system_admin');

CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR get_my_role() = 'system_admin');

CREATE POLICY "System admin insert profiles" ON user_profiles
  FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'system_admin');

CREATE POLICY "System admin delete profiles" ON user_profiles
  FOR DELETE TO authenticated
  USING (get_my_role() = 'system_admin');

-- 다른 테이블 정책도 get_my_role() 함수로 통일
-- tournaments
DROP POLICY IF EXISTS "Admins manage tournaments" ON tournaments;
CREATE POLICY "Admins manage tournaments" ON tournaments FOR ALL TO authenticated
  USING (admin_id = auth.uid() OR created_by = auth.uid() OR get_my_role() = 'system_admin');

-- divisions
DROP POLICY IF EXISTS "Admins manage divisions" ON divisions;
CREATE POLICY "Admins manage divisions" ON divisions FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tournaments t WHERE t.id = tournament_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR get_my_role() = 'system_admin')
  ));

-- division_merges
DROP POLICY IF EXISTS "Admins manage merges" ON division_merges;
CREATE POLICY "Admins manage merges" ON division_merges FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tournaments t WHERE t.id = tournament_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR get_my_role() = 'system_admin')
  ));

-- tournament_phases
DROP POLICY IF EXISTS "Admins manage phases" ON tournament_phases;
CREATE POLICY "Admins manage phases" ON tournament_phases FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM divisions d JOIN tournaments t ON t.id = d.tournament_id
    WHERE d.id = division_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR get_my_role() = 'system_admin')
  ));

-- groups
DROP POLICY IF EXISTS "Admins manage groups" ON groups;
CREATE POLICY "Admins manage groups" ON groups FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tournament_phases tp
    JOIN divisions d ON d.id = tp.division_id
    JOIN tournaments t ON t.id = d.tournament_id
    WHERE tp.id = phase_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR get_my_role() = 'system_admin')
  ));

-- players
DROP POLICY IF EXISTS "Admins manage players" ON players;
CREATE POLICY "Admins manage players" ON players FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM divisions d JOIN tournaments t ON t.id = d.tournament_id
    WHERE d.id = division_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR get_my_role() = 'system_admin')
  ));

-- teams
DROP POLICY IF EXISTS "Admins manage teams" ON teams;
CREATE POLICY "Admins manage teams" ON teams FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM divisions d JOIN tournaments t ON t.id = d.tournament_id
    WHERE d.id = division_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR get_my_role() = 'system_admin')
  ));

-- team_members
DROP POLICY IF EXISTS "Admins manage team_members" ON team_members;
CREATE POLICY "Admins manage team_members" ON team_members FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM teams tm
    JOIN divisions d ON d.id = tm.division_id
    JOIN tournaments t ON t.id = d.tournament_id
    WHERE tm.id = team_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR get_my_role() = 'system_admin')
  ));

-- matches
DROP POLICY IF EXISTS "Admins manage matches" ON matches;
CREATE POLICY "Admins manage matches" ON matches FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM tournament_phases tp
    JOIN divisions d ON d.id = tp.division_id
    JOIN tournaments t ON t.id = d.tournament_id
    WHERE tp.id = phase_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR get_my_role() = 'system_admin')
  ));

-- match_sets
DROP POLICY IF EXISTS "Admins manage match_sets" ON match_sets;
CREATE POLICY "Admins manage match_sets" ON match_sets FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM matches m
    JOIN tournament_phases tp ON tp.id = m.phase_id
    JOIN divisions d ON d.id = tp.division_id
    JOIN tournaments t ON t.id = d.tournament_id
    WHERE m.id = match_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR get_my_role() = 'system_admin')
  ));

-- standings
DROP POLICY IF EXISTS "Admins manage standings" ON standings;
CREATE POLICY "Admins manage standings" ON standings FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM groups g
    JOIN tournament_phases tp ON tp.id = g.phase_id
    JOIN divisions d ON d.id = tp.division_id
    JOIN tournaments t ON t.id = d.tournament_id
    WHERE g.id = group_id
    AND (t.admin_id = auth.uid() OR t.created_by = auth.uid() OR get_my_role() = 'system_admin')
  ));
