-- Add confirmed flag to players (true = admin-added or approved, false = pending public registration)
ALTER TABLE players
ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT true;

-- Allow anyone to submit a registration when the tournament is in 'registration' status
CREATE POLICY "Public registration insert" ON players
  FOR INSERT
  WITH CHECK (
    confirmed = false AND
    EXISTS (
      SELECT 1 FROM divisions d
      JOIN tournaments t ON t.id = d.tournament_id
      WHERE d.id = division_id
      AND t.status = 'registration'
    )
  );

CREATE INDEX IF NOT EXISTS idx_players_confirmed ON players(division_id, confirmed);
