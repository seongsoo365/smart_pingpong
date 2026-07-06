-- Q&A: 답변 여부와 무관하게 공개(is_public=TRUE) 질문은 누구나 조회 가능하도록 변경
-- (기존에는 답변이 등록된 질문만 공개되어, 질문 등록 직후에는 본인도 목록에서 확인할 수 없었음)

DROP POLICY IF EXISTS "qna_public_read" ON tournament_questions;
CREATE POLICY "qna_public_read"
  ON tournament_questions FOR SELECT
  USING (is_public = TRUE);

DROP POLICY IF EXISTS "main_qna_public_read" ON main_questions;
CREATE POLICY "main_qna_public_read"
  ON main_questions FOR SELECT
  USING (is_public = TRUE);
