ALTER TABLE divisions
ADD COLUMN IF NOT EXISTS team_match_format TEXT
CHECK (team_match_format IN (
  'olympic',
  'traditional_4s1d',
  'swaythling',
  'singles_2_doubles_1',
  'three_doubles',
  'three_singles'
));
