-- 014 마이그레이션이 011에서 추가된 provider·avatar_url·ON CONFLICT 로직을 덮어쓴 버그 수정
-- SET search_path = public: SECURITY DEFINER 함수는 search_path가 달라 public. 명시 필요
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, name, avatar_url, provider, role, password_changed)
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
    'tournament_admin',
    TRUE  -- 소셜·자체 가입은 비밀번호 변경 강제 불필요; 초대 계정은 API에서 FALSE로 덮어씀
  )
  ON CONFLICT (id) DO UPDATE SET
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.user_profiles.avatar_url),
    name       = COALESCE(NULLIF(EXCLUDED.name, ''), public.user_profiles.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
