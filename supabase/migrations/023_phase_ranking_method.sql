-- 예선 순위 결정 기준(승수 우선 / 세트 득실 우선) 선택 컬럼 추가
-- 기본값 wins_first는 기존 계산 방식과 동일하여 기존 대회에 영향 없음

ALTER TABLE tournament_phases
  ADD COLUMN IF NOT EXISTS ranking_method TEXT NOT NULL DEFAULT 'wins_first'
  CHECK (ranking_method IN ('wins_first', 'setdiff_first'));
