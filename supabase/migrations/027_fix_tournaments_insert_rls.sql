-- RLS 정책 수정: INSERT 정책을 WITH CHECK로 분리
-- 문제: FOR ALL 정책은 INSERT의 WITH CHECK 조건을 제대로 처리하지 못함
-- 해결: INSERT/UPDATE/DELETE를 명시적으로 분리

-- tournaments 정책 수정
DROP POLICY IF EXISTS "Admins insert tournaments" ON tournaments;
DROP POLICY IF EXISTS "Admins update tournaments" ON tournaments;
DROP POLICY IF EXISTS "Admins delete tournaments" ON tournaments;
DROP POLICY IF EXISTS "Admins manage tournaments" ON tournaments;

-- INSERT: 새 대회는 created_by와 admin_id가 모두 현재 사용자여야 함 (또는 system_admin)
CREATE POLICY "Admins insert tournaments" ON tournaments FOR INSERT TO authenticated
  WITH CHECK (
    (created_by = auth.uid() AND admin_id = auth.uid())
    OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'system_admin')
  );

-- UPDATE/DELETE: 기존 대회에 대한 관리 권한 검증
CREATE POLICY "Admins update tournaments" ON tournaments FOR UPDATE TO authenticated
  USING (is_tournament_admin(id));

CREATE POLICY "Admins delete tournaments" ON tournaments FOR DELETE TO authenticated
  USING (is_tournament_admin(id));

-- 다른 테이블들도 동일 패턴으로 수정 (WITH CHECK를 명시적으로 사용)

-- divisions
DROP POLICY IF EXISTS "Admins manage divisions" ON divisions;
DROP POLICY IF EXISTS "Admins divisions insert" ON divisions;
DROP POLICY IF EXISTS "Admins divisions update" ON divisions;
DROP POLICY IF EXISTS "Admins divisions delete" ON divisions;

CREATE POLICY "Admins divisions insert" ON divisions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins divisions update" ON divisions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins divisions delete" ON divisions FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND is_tournament_admin(t.id)
    )
  );

-- division_merges
DROP POLICY IF EXISTS "Admins manage merges" ON division_merges;
DROP POLICY IF EXISTS "Admins merges insert" ON division_merges;
DROP POLICY IF EXISTS "Admins merges update" ON division_merges;
DROP POLICY IF EXISTS "Admins merges delete" ON division_merges;

CREATE POLICY "Admins merges insert" ON division_merges FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins merges update" ON division_merges FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins merges delete" ON division_merges FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND is_tournament_admin(t.id)
    )
  );

-- tournament_phases
DROP POLICY IF EXISTS "Admins manage phases" ON tournament_phases;
DROP POLICY IF EXISTS "Admins phases insert" ON tournament_phases;
DROP POLICY IF EXISTS "Admins phases update" ON tournament_phases;
DROP POLICY IF EXISTS "Admins phases delete" ON tournament_phases;

CREATE POLICY "Admins phases insert" ON tournament_phases FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins phases update" ON tournament_phases FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins phases delete" ON tournament_phases FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id AND is_tournament_admin(t.id)
    )
  );

-- groups
DROP POLICY IF EXISTS "Admins manage groups" ON groups;
DROP POLICY IF EXISTS "Admins groups insert" ON groups;
DROP POLICY IF EXISTS "Admins groups update" ON groups;
DROP POLICY IF EXISTS "Admins groups delete" ON groups;

CREATE POLICY "Admins groups insert" ON groups FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournament_phases tp
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE tp.id = phase_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins groups update" ON groups FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournament_phases tp
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE tp.id = phase_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins groups delete" ON groups FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournament_phases tp
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE tp.id = phase_id AND is_tournament_admin(t.id)
    )
  );

-- players (공개 등록 정책은 유지, 관리자 쓰기만 추가)
DROP POLICY IF EXISTS "Admins manage players" ON players;
DROP POLICY IF EXISTS "Admins players insert" ON players;
DROP POLICY IF EXISTS "Admins players update" ON players;
DROP POLICY IF EXISTS "Admins players delete" ON players;

CREATE POLICY "Admins players insert" ON players FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins players update" ON players FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins players delete" ON players FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id AND is_tournament_admin(t.id)
    )
  );

-- teams (공개 등록 정책은 유지, 관리자 쓰기만 추가)
DROP POLICY IF EXISTS "Admins manage teams" ON teams;
DROP POLICY IF EXISTS "Admins teams insert" ON teams;
DROP POLICY IF EXISTS "Admins teams update" ON teams;
DROP POLICY IF EXISTS "Admins teams delete" ON teams;

CREATE POLICY "Admins teams insert" ON teams FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins teams update" ON teams FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins teams delete" ON teams FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id AND is_tournament_admin(t.id)
    )
  );

-- team_members (공개 등록 정책은 유지, 관리자 쓰기만 추가)
DROP POLICY IF EXISTS "Admins manage team_members" ON team_members;
DROP POLICY IF EXISTS "Admins team_members insert" ON team_members;
DROP POLICY IF EXISTS "Admins team_members update" ON team_members;
DROP POLICY IF EXISTS "Admins team_members delete" ON team_members;

CREATE POLICY "Admins team_members insert" ON team_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams tm
      JOIN divisions d ON d.id = tm.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE tm.id = team_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins team_members update" ON team_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM teams tm
      JOIN divisions d ON d.id = tm.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE tm.id = team_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins team_members delete" ON team_members FOR DELETE TO authenticated
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
DROP POLICY IF EXISTS "Admins matches insert" ON matches;
DROP POLICY IF EXISTS "Admins matches update" ON matches;
DROP POLICY IF EXISTS "Admins matches delete" ON matches;

CREATE POLICY "Admins matches insert" ON matches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournament_phases tp
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE tp.id = phase_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins matches update" ON matches FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tournament_phases tp
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE tp.id = phase_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins matches delete" ON matches FOR DELETE TO authenticated
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
DROP POLICY IF EXISTS "Admins match_sets insert" ON match_sets;
DROP POLICY IF EXISTS "Admins match_sets update" ON match_sets;
DROP POLICY IF EXISTS "Admins match_sets delete" ON match_sets;

CREATE POLICY "Admins match_sets insert" ON match_sets FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN tournament_phases tp ON tp.id = m.phase_id
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE m.id = match_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins match_sets update" ON match_sets FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      JOIN tournament_phases tp ON tp.id = m.phase_id
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE m.id = match_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins match_sets delete" ON match_sets FOR DELETE TO authenticated
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
DROP POLICY IF EXISTS "Admins standings insert" ON standings;
DROP POLICY IF EXISTS "Admins standings update" ON standings;
DROP POLICY IF EXISTS "Admins standings delete" ON standings;

CREATE POLICY "Admins standings insert" ON standings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN tournament_phases tp ON tp.id = g.phase_id
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE g.id = group_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins standings update" ON standings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN tournament_phases tp ON tp.id = g.phase_id
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE g.id = group_id AND is_tournament_admin(t.id)
    )
  );

CREATE POLICY "Admins standings delete" ON standings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN tournament_phases tp ON tp.id = g.phase_id
      JOIN divisions d ON d.id = tp.division_id
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE g.id = group_id AND is_tournament_admin(t.id)
    )
  );
