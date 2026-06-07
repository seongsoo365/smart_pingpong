-- Q&A: tournament_questions table
CREATE TABLE tournament_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  author_email TEXT,
  question TEXT NOT NULL,
  answer TEXT,
  answered_by UUID REFERENCES auth.users(id),
  answered_at TIMESTAMPTZ,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tournament_questions ENABLE ROW LEVEL SECURITY;

-- Public visitors: see only answered & public questions
CREATE POLICY "qna_public_read"
  ON tournament_questions FOR SELECT
  USING (answer IS NOT NULL AND is_public = TRUE);

-- Anyone (including anon): submit questions
CREATE POLICY "qna_public_insert"
  ON tournament_questions FOR INSERT
  WITH CHECK (TRUE);

-- Tournament owners: read ALL questions for their tournament
CREATE POLICY "qna_admin_read"
  ON tournament_questions FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND (
      get_my_role() = 'system_admin' OR
      EXISTS (
        SELECT 1 FROM tournaments t
        WHERE t.id = tournament_questions.tournament_id
          AND (t.admin_id = auth.uid() OR t.created_by = auth.uid())
      )
    )
  );

-- Tournament owners: answer / update questions
CREATE POLICY "qna_admin_update"
  ON tournament_questions FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      get_my_role() = 'system_admin' OR
      EXISTS (
        SELECT 1 FROM tournaments t
        WHERE t.id = tournament_questions.tournament_id
          AND (t.admin_id = auth.uid() OR t.created_by = auth.uid())
      )
    )
  );

-- Tournament owners: delete questions
CREATE POLICY "qna_admin_delete"
  ON tournament_questions FOR DELETE
  USING (
    auth.uid() IS NOT NULL AND (
      get_my_role() = 'system_admin' OR
      EXISTS (
        SELECT 1 FROM tournaments t
        WHERE t.id = tournament_questions.tournament_id
          AND (t.admin_id = auth.uid() OR t.created_by = auth.uid())
      )
    )
  );
