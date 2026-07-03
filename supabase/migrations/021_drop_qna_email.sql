-- Q&A 이메일 항목 제거 (메인 + 대회 Q&A 모두)
ALTER TABLE tournament_questions DROP COLUMN IF EXISTS author_email;
