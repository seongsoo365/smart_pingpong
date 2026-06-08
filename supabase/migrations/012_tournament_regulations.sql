-- tournaments 테이블에 대회요강 컬럼 추가
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS regulations TEXT;
