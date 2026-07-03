-- 메인 Q&A 테이블 (대회와 무관한 사이트 공통 Q&A)
CREATE TABLE main_questions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_name  TEXT NOT NULL,
  question     TEXT NOT NULL,
  answer       TEXT,
  answered_by  UUID REFERENCES auth.users(id),
  answered_at  TIMESTAMPTZ,
  is_public    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE main_questions ENABLE ROW LEVEL SECURITY;

-- 답변된 공개 질문은 누구나 조회
CREATE POLICY "main_qna_public_read" ON main_questions
  FOR SELECT USING (answer IS NOT NULL AND is_public = TRUE);

-- 질문 등록은 누구나 가능 (비인증 포함)
CREATE POLICY "main_qna_public_insert" ON main_questions
  FOR INSERT WITH CHECK (TRUE);

-- system_admin은 전체 관리 가능
CREATE POLICY "main_qna_admin_all" ON main_questions
  FOR ALL USING (get_my_role() = 'system_admin');
