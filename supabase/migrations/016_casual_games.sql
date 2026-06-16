CREATE TABLE casual_games (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player1_name     TEXT NOT NULL,
  player2_name     TEXT NOT NULL,
  player1_club     TEXT,
  player2_club     TEXT,
  score1           INT  NOT NULL DEFAULT 0,
  score2           INT  NOT NULL DEFAULT 0,
  sets             JSONB NOT NULL DEFAULT '[]',
  games_per_match  INT  NOT NULL DEFAULT 5,
  points_per_game  INT  NOT NULL DEFAULT 11,
  played_at        DATE NOT NULL DEFAULT CURRENT_DATE,
  venue            TEXT,
  notes            TEXT,
  created_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE casual_games ENABLE ROW LEVEL SECURITY;

CREATE POLICY "casual_games_public_read" ON casual_games
  FOR SELECT USING (true);

CREATE POLICY "casual_games_admin_write" ON casual_games
  FOR ALL
  USING (get_my_role() = 'system_admin' OR created_by = auth.uid())
  WITH CHECK (get_my_role() = 'system_admin' OR created_by = auth.uid());

CREATE INDEX idx_casual_games_played_at ON casual_games (played_at DESC);
CREATE INDEX idx_casual_games_player1   ON casual_games (player1_name);
CREATE INDEX idx_casual_games_player2   ON casual_games (player2_name);
