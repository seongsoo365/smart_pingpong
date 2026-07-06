-- 관리자가 개인/단체전 신청자 정보에 남길 수 있는 메모 (단체전은 팀 단위)

ALTER TABLE players ADD COLUMN IF NOT EXISTS memo TEXT;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS memo TEXT;
