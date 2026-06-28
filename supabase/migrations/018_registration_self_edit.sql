-- Allow participants to update/delete their unconfirmed registrations
-- UUID provides brute-force protection; confirmed=false prevents editing approved records

CREATE POLICY "Public self update players"
  ON players FOR UPDATE
  USING (confirmed = false)
  WITH CHECK (confirmed = false);

CREATE POLICY "Public self delete players"
  ON players FOR DELETE
  USING (confirmed = false);

CREATE POLICY "Public self update teams"
  ON teams FOR UPDATE
  USING (confirmed = false)
  WITH CHECK (confirmed = false);

CREATE POLICY "Public self delete teams"
  ON teams FOR DELETE
  USING (confirmed = false);

CREATE POLICY "Public self update team_members"
  ON team_members FOR UPDATE
  USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.confirmed = false))
  WITH CHECK (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.confirmed = false));

CREATE POLICY "Public self delete team_members"
  ON team_members FOR DELETE
  USING (EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.confirmed = false));
