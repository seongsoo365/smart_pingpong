-- Add confirmed flag to teams (same pattern as players)
ALTER TABLE teams
ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT true;

-- Allow public team registration when tournament is in 'registration' status
CREATE POLICY "Public registration insert teams" ON teams
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

-- Allow inserting members for unconfirmed (pending) teams
CREATE POLICY "Public registration insert team_members" ON team_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams tm
      WHERE tm.id = team_id
      AND tm.confirmed = false
    )
  );

CREATE INDEX IF NOT EXISTS idx_teams_confirmed ON teams(division_id, confirmed);
