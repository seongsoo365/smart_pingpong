-- teams 테이블에 created_at 추가 (신청 시간순 대기열)
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- divisions 테이블에 max_teams 추가 (단체전 최대 참가팀 수)
ALTER TABLE divisions
ADD COLUMN IF NOT EXISTS max_teams INT;
