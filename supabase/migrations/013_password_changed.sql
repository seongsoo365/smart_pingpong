-- FEAT-12: 첫 로그인 비밀번호 변경 강제를 위한 컬럼 추가
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS password_changed BOOLEAN NOT NULL DEFAULT FALSE;

-- 기존 계정은 이미 사용 중이므로 변경 완료로 처리 (신규 계정만 강제 적용)
UPDATE user_profiles SET password_changed = TRUE;
