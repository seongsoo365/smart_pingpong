# 화면 요구사항정의서 — 인증 화면

> 관리자 로그인·가입·비밀번호·소셜 OAuth 콜백 화면 정의서입니다.
> 포함 화면: **AUTH-01 로그인**, **AUTH-02 관리자 가입**, **AUTH-03 이메일 인증**, **AUTH-04 비밀번호 찾기**, **AUTH-05 비밀번호 재설정**, **AUTH-06 카카오 OAuth 콜백**, **AUTH-07 네이버 OAuth 콜백**

---

## AUTH-01 로그인

| 항목 | 내용 |
|------|------|
| 경로 | /login |
| 파일 | app/(auth)/login/page.tsx |
| 유형 | 클라이언트 컴포넌트 (Suspense 래핑) |
| 접근권한 | 비인증 공개 |

- **주요 기능**: 이메일/비밀번호 및 소셜(Google/Naver/Kakao) 로그인. 소셜 콜백 오류 파라미터를 한국어 메시지로 표시. 이메일 로그인 실패 시 해당 계정이 소셜 가입 계정이면 안내 힌트 표시.
- **입력 항목**: 이메일(email, 필수), 비밀번호(password, 필수). `searchParams.error`(선택) — 소셜 콜백 오류 코드.
- **처리 흐름**:
  - 이메일 로그인: `supabase.auth.signInWithPassword()` → 성공 시 toast 후 `/admin` push + `router.refresh()`. 실패 시 `/api/auth/provider?email=`로 provider 조회 → google/naver면 해당 버튼 안내 힌트, 아니면 "이메일 또는 비밀번호가 올바르지 않습니다".
  - Google: `signInWithOAuth({provider:'google', redirectTo:/auth/callback?next=/admin})`.
  - Naver: `window.location.href = '/auth/naver'`. Kakao: `window.location.href = '/auth/kakao'`.
- **연동 API/테이블**: Supabase Auth(`signInWithPassword`, `signInWithOAuth`), `/api/auth/provider`(GET). 리다이렉트 엔드포인트 `/auth/callback`, `/auth/naver`, `/auth/kakao`.
- **주요 컴포넌트**: 인라인 SVG 아이콘(GoogleIcon/KakaoIcon/NaverIcon), sonner toast, `Link`(회원가입·비밀번호 찾기).
- **주의사항**: `useSearchParams()` 사용으로 `<Suspense>` 필수(파일 하단 `LoginPage`가 감쌈). 소셜 로그인 성공 시 브라우저가 리다이렉트되므로 로딩 상태 해제 불필요. `errorMessages` 맵에 naver_/kakao_/invalid_state 등 다수 오류코드 정의.

---

## AUTH-02 관리자 가입

| 항목 | 내용 |
|------|------|
| 경로 | /register |
| 파일 | app/(auth)/register/page.tsx |
| 유형 | 클라이언트 컴포넌트 (Suspense 래핑) |
| 접근권한 | 비인증 공개 |

- **주요 기능**: 대회 관리자 계정을 이메일 또는 소셜(Google/Naver)로 가입. 비밀번호 정책 검증 후 Supabase 회원가입.
- **입력 항목**: 이름(text, 필수), 이메일(email, 필수), 비밀번호(password, 필수 — 최소 8자·영문·숫자 포함), 비밀번호 확인(password, 필수 — 일치 검증).
- **처리 흐름**: 제출 시 이름/비밀번호 정책(`validatePassword`)/일치 검증 → `supabase.auth.signUp({email,password,options:{data:{name}, emailRedirectTo:/auth/callback?next=/admin}})`. `data.session`이 있으면(이메일 인증 불필요 설정) 바로 `/admin`, 없으면 `/register/verify?email=`로 이동. 소셜은 로그인과 동일하게 OAuth/리다이렉트.
- **연동 API/테이블**: Supabase Auth(`signUp`, `signInWithOAuth`). 콜백 `/auth/callback`, `/auth/naver`.
- **주요 컴포넌트**: 인라인 GoogleIcon/NaverIcon, sonner toast, `Link`(로그인).
- **주의사항**: `RegisterForm`이 `<Suspense>`로 감싸짐. 카카오 가입 버튼은 없음(로그인 화면에만 존재). 비밀번호 오류는 toast로 안내.

---

## AUTH-03 이메일 인증

| 항목 | 내용 |
|------|------|
| 경로 | /register/verify |
| 파일 | app/(auth)/register/verify/page.tsx |
| 유형 | 클라이언트 컴포넌트 (Suspense 래핑) |
| 접근권한 | 비인증 공개 |

- **주요 기능**: 회원가입 후 인증 메일 발송 안내 화면. 인증 메일 재발송(쿨다운 60초) 지원.
- **입력 항목**: `searchParams.email`(문자열) — 대상 이메일 표시 및 재발송 대상. 폼 입력 없음(버튼만).
- **처리 흐름**: `email` 쿼리를 읽어 안내 문구에 표시. "인증 메일 재발송" 클릭 시 `supabase.auth.resend({type:'signup', email})` → 성공 시 toast + 60초 쿨다운 시작(`setInterval` 카운트다운), 실패 시 toast 에러. 쿨다운 중·이메일 없음 시 버튼 비활성.
- **연동 API/테이블**: Supabase Auth(`resend`).
- **주요 컴포넌트**: lucide `MailCheck`, sonner toast, `Link`(로그인 복귀).
- **주의사항**: `useSearchParams()` 사용으로 `<Suspense>` 필수(하단 `VerifyPage`가 감쌈). 쿨다운 타이머는 언마운트 시 `clearInterval` 정리. 링크 유효 24시간·스팸함 확인 안내 문구 포함.

---

## AUTH-04 비밀번호 찾기

| 항목 | 내용 |
|------|------|
| 경로 | /forgot-password |
| 파일 | app/(auth)/forgot-password/page.tsx |
| 유형 | 클라이언트 컴포넌트 (Suspense 래핑) |
| 접근권한 | 비인증 공개 |

- **주요 기능**: 가입 이메일로 비밀번호 재설정 링크를 발송. 발송 완료 시 안내 화면 전환.
- **입력 항목**: 이메일(email, 필수).
- **처리 흐름**: 제출 시 `supabase.auth.resetPasswordForEmail(email, {redirectTo:/auth/callback?next=/reset-password})` → 성공 시 `sent=true`로 발송 완료 안내 렌더, 실패 시 toast 에러.
- **연동 API/테이블**: Supabase Auth(`resetPasswordForEmail`). 콜백 후 `/reset-password`로 이동.
- **주요 컴포넌트**: lucide `Trophy`/`ArrowLeft`, sonner toast, `Link`(로그인 복귀).
- **주의사항**: `ForgotPasswordForm`이 `<Suspense>`로 감싸짐. 재설정 링크는 `/auth/callback` 코드 교환 후 `/reset-password`로 연결됨(AUTH-05와 연계).

---

## AUTH-05 비밀번호 재설정

| 항목 | 내용 |
|------|------|
| 경로 | /reset-password |
| 파일 | app/(auth)/reset-password/page.tsx |
| 유형 | 클라이언트 컴포넌트 (Suspense 래핑) |
| 접근권한 | 인증 세션 필요 (재설정 링크로 교환된 세션) |

- **주요 기능**: 재설정 링크를 통해 진입한 세션에서 새 비밀번호를 설정하고 `password_changed` 플래그를 갱신.
- **입력 항목**: 새 비밀번호(password, 필수 — 최소 8자·영문·숫자), 비밀번호 확인(password, 필수 — 일치 검증).
- **처리 흐름**: 제출 시 `validatePassword` 및 일치 검증 → `supabase.auth.updateUser({password})` → 성공 시 `getUser()`로 사용자 취득 후 `user_profiles.password_changed=true` 업데이트 → toast + `/admin` push. 실패는 toast 에러.
- **연동 API/테이블**: Supabase Auth(`updateUser`, `getUser`), `user_profiles`(UPDATE password_changed).
- **주요 컴포넌트**: 직접 마크업 폼, sonner toast.
- **주의사항**: `ResetPasswordForm`이 `<Suspense>`로 감싸짐. 유효한 인증 세션이 없으면 `updateUser`가 실패(비밀번호 찾기 링크 경유 전제). 비밀번호 정책은 가입 화면과 동일.

---

## AUTH-06 카카오 OAuth 콜백

| 항목 | 내용 |
|------|------|
| 경로 | /auth/kakao/complete |
| 파일 | app/auth/kakao/complete/page.tsx |
| 유형 | 클라이언트 컴포넌트 |
| 접근권한 | 비인증 공개 (OAuth 완료 처리 전용) |

- **주요 기능**: 카카오 임플리싯 플로우에서 URL fragment(`#access_token`, `#refresh_token`)로 반환된 토큰을 Supabase 세션으로 설정하고 `/admin`으로 이동.
- **입력 항목**: URL fragment(`access_token`, `refresh_token`). 폼 입력 없음.
- **처리 흐름**: mount `useEffect`에서 `window.location.hash` 파싱 → hash 없거나 토큰 누락 시 `/login?error=kakao_no_token`으로 replace → `supabase.auth.setSession({access_token, refresh_token})` → 오류 시 `/login?error=kakao_session_failed`, 성공 시 `/admin`으로 replace. 처리 중 스피너 표시.
- **연동 API/테이블**: Supabase Auth(`setSession`).
- **주요 컴포넌트**: 로딩 스피너(직접 마크업).
- **주의사항**: fragment(`#`)는 클라이언트에서만 접근 가능하므로 클라이언트 컴포넌트 필수. 오류 코드는 로그인 화면(AUTH-01) `errorMessages` 맵과 매칭. 배경색이 `style={{background:'#0F172A'}}`로 하드코딩되어 있어 라이트 테마 미대응(개선 대상).

---

## AUTH-07 네이버 OAuth 콜백

| 항목 | 내용 |
|------|------|
| 경로 | /auth/naver/complete |
| 파일 | app/auth/naver/complete/page.tsx |
| 유형 | 클라이언트 컴포넌트 |
| 접근권한 | 비인증 공개 (OAuth 완료 처리 전용) |

- **주요 기능**: 네이버 임플리싯 플로우에서 fragment 토큰을 Supabase 세션으로 설정하고 `/admin`으로 이동(AUTH-06 카카오와 동일 패턴).
- **입력 항목**: URL fragment(`access_token`, `refresh_token`). 폼 입력 없음.
- **처리 흐름**: mount `useEffect`에서 hash 파싱 → 없거나 토큰 누락 시 `/login?error=naver_no_token`으로 replace → `setSession()` → 오류 시 `/login?error=naver_session_failed`, 성공 시 `/admin`으로 replace. 처리 중 스피너 표시.
- **연동 API/테이블**: Supabase Auth(`setSession`).
- **주요 컴포넌트**: 로딩 스피너(직접 마크업).
- **주의사항**: 클라이언트 컴포넌트 필수(fragment 접근). 오류 코드는 AUTH-01 `errorMessages`와 매칭. 배경색 `#0F172A` 하드코딩으로 라이트 테마 미대응(개선 대상).
