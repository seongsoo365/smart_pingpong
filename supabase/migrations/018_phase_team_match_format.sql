-- tournament_phases에 단체전 방식을 단계별로 설정할 수 있도록 컬럼 추가
-- 예선/본선 각각 다른 team_match_format 적용 가능 (nullable: 개인전 phase는 NULL)
ALTER TABLE tournament_phases
  ADD COLUMN IF NOT EXISTS team_match_format TEXT
    CHECK (team_match_format IN (
      'olympic',
      'traditional_4s1d',
      'swaythling',
      'singles_2_doubles_1',
      'three_doubles',
      'three_singles'
    ));
