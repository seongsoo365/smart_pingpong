-- 조회 빈도가 높지만 인덱스가 없던 컬럼에 인덱스 추가 (화면 전환 성능 개선)

-- matches.participant1_id / participant2_id: 선수 전적(/api/players/records), 랭킹(/api/players/rankings) 조회에서 필터링
CREATE INDEX IF NOT EXISTS idx_matches_participant1 ON matches(participant1_id);
CREATE INDEX IF NOT EXISTS idx_matches_participant2 ON matches(participant2_id);

-- tournament_questions.tournament_id: FK지만 Postgres가 자동으로 인덱스를 만들지 않음 (대회 상세/Q&A 관리 페이지에서 매번 조회)
CREATE INDEX IF NOT EXISTS idx_tournament_questions_tournament ON tournament_questions(tournament_id);

-- team_members.team_id: FK지만 인덱스 없음 (teams(*, members:team_members(*)) 조인에서 매번 사용)
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);

-- teams.group_id: players.group_id(idx_players_group)와 동일한 용도인데 비대칭으로 누락되어 있었음
CREATE INDEX IF NOT EXISTS idx_teams_group ON teams(group_id);

-- tournament_admins.user_id: PK가 (tournament_id, user_id) 복합키라 user_id 단독 조회(관리자 대시보드)는 커버되지 않음
CREATE INDEX IF NOT EXISTS idx_tournament_admins_user ON tournament_admins(user_id);
