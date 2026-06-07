-- Add provider and avatar_url columns to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'email',
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Update trigger to capture OAuth metadata (google, naver, etc.)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, name, avatar_url, provider, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      NEW.raw_user_meta_data->>'full_name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'provider', 'email'),
    'tournament_admin'
  )
  ON CONFLICT (id) DO UPDATE SET
    avatar_url = COALESCE(EXCLUDED.avatar_url, user_profiles.avatar_url),
    name      = COALESCE(NULLIF(EXCLUDED.name, ''), user_profiles.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
