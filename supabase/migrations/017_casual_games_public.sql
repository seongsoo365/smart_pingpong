-- 기존 write 정책 제거 후 공개 INSERT + 관리자 UPDATE/DELETE로 분리
DROP POLICY IF EXISTS "casual_games_admin_write" ON casual_games;

-- 누구나 등록 가능 (비인증 포함)
CREATE POLICY "casual_games_public_insert" ON casual_games
  FOR INSERT WITH CHECK (true);

-- 수정/삭제는 작성자 또는 system_admin만
CREATE POLICY "casual_games_owner_update" ON casual_games
  FOR UPDATE
  USING (get_my_role() = 'system_admin' OR created_by = auth.uid())
  WITH CHECK (get_my_role() = 'system_admin' OR created_by = auth.uid());

CREATE POLICY "casual_games_owner_delete" ON casual_games
  FOR DELETE
  USING (get_my_role() = 'system_admin' OR created_by = auth.uid());
