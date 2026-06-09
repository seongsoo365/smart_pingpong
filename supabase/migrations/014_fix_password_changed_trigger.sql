-- FEAT-18/16: 소셜 로그인·자체 가입 사용자는 password_changed 강제 불필요
-- 기본값을 TRUE로 변경하고, 관리자 초대 계정만 API에서 명시적으로 FALSE 설정
ALTER TABLE user_profiles ALTER COLUMN password_changed SET DEFAULT TRUE;

-- 트리거 업데이트: 신규 사용자는 password_changed = TRUE로 생성
-- (관리자 초대 계정은 create-user API에서 FALSE로 덮어씀)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, name, role, password_changed)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'tournament_admin',
    TRUE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
