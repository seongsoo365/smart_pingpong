# 기능 정의서(백엔드) — 인증·권한 (Auth / Authz)

> 포함 기능ID: FEAT-AUTH-01 로그인 흐름 · FEAT-AUTH-02 RLS 헬퍼 함수 · FEAT-AUTH-03 API 라우트 권한 검사 4단계 패턴 · FEAT-AUTH-04 제공자 조회 · FEAT-AUTH-05 관리자 초대 생성 · FEAT-AUTH-06 유저 역할변경/삭제/검색

이 프로젝트는 API Route를 최소로 사용하고, 대부분의 클라이언트가 Supabase에 직접 접근하며 **RLS(Row Level Security)로 권한을 강제**합니다. 아래 문서는 인증(로그인) 흐름과 권한 판별 로직, 그리고 service_role 키가 필요한 소수의 관리자 API 라우트를 정의합니다.

---

## FEAT-AUTH-01 로그인 흐름 (이메일 / 구글 / 카카오 / 네이버)

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `app/(auth)/login/page.tsx`, `app/auth/callback/route.ts`, `app/auth/naver/route.ts`, `app/auth/callback/naver/route.ts`, `app/auth/kakao/route.ts`, `app/auth/callback/kakao/route.ts`, `proxy.ts` |
| 관련 함수 | `supabase.auth.signInWithPassword()`, `signInWithOAuth()`, `exchangeCodeForSession()`, `admin.generateLink()` (magiclink) |
| 권한 | 비인증 사용자 (로그인 진입점) |

- **역할**: 4가지 방식으로 관리자 로그인을 처리하고, 성공 시 `/admin`으로 이동시킨다. 모든 요청마다 세션 쿠키를 갱신한다.
- **입력**:
  - 이메일: `{ email, password }` — 클라이언트에서 직접 `signInWithPassword` 호출
  - 구글: `signInWithOAuth({ provider: 'google', options: { redirectTo: '{origin}/auth/callback?next=/admin' } })` (Supabase OAuth)
  - 네이버: `GET /auth/naver` → 네이버 인가 URL로 redirect (state 쿠키 CSRF 세팅)
  - 카카오: `GET /auth/kakao` → 카카오 인가 URL로 redirect (state 쿠키 CSRF 세팅)
- **출력**: 인증 세션 쿠키 설정 후 `/admin` 리다이렉트. 실패 시 `/login?error=<code>`로 이동하며 `login/page.tsx`의 `errorMessages` 맵으로 한국어 메시지 표시.
- **비즈니스 규칙**:
  - **이메일 로그인 실패 시**: `GET /api/auth/provider?email=`로 소셜 가입 여부를 조회해, 해당 계정이 google/naver 가입이면 "해당 버튼으로 로그인" 힌트(`providerHint`)를 표시(FEAT-AUTH-04 연계).
  - **구글**: Supabase OAuth → `/auth/callback?code=xxx&next=/admin` → `exchangeCodeForSession(code)` → `{origin}{next}` 리다이렉트. 코드 교환 실패 시 `/login?error=auth_callback_failed`.
  - **네이버**: `/auth/naver`에서 `randomBytes(16)` state를 `naver_oauth_state` httpOnly 쿠키(maxAge 300s)에 저장 후 `https://nid.naver.com/oauth2.0/authorize`로 이동. 콜백(`/auth/callback/naver`)에서 (1) state 쿠키 비교로 CSRF 검증(불일치 시 `invalid_state`), (2) code→access_token 교환, (3) `openapi.naver.com/v1/nid/me`로 프로필 조회, (4) service_role `admin.createUser`로 유저 생성(이메일 미제공 시 `naver_{id}@naver.user` 합성, 소문자 정규화), (5) `user_profiles` upsert(`provider: 'naver'`, `role: 'tournament_admin'`, `password_changed: true`), (6) `admin.generateLink({ type: 'magiclink' })`로 세션 생성 링크를 만들어 그 action_link로 redirect. state 쿠키는 삭제.
  - **카카오**: `/auth/kakao`도 동일 패턴(`kakao_oauth_state` 쿠키, `kauth.kakao.com/oauth/authorize`, 콜백 `/auth/callback/kakao`).
  - **세션 갱신 (`proxy.ts`)**: Next.js 16의 middleware 대체. 매 요청마다 `supabase.auth.getUser()`로 세션 쿠키 갱신. Supabase 미설정(URL/KEY 없거나 https 아님) 시 즉시 통과. `/admin` 접근 시 이메일 가입 계정이면서 `password_changed === false`이고 `provider === 'email'`이면 `/admin/change-password`로 강제 리다이렉트(첫 로그인 비밀번호 변경 유도).
- **관련 테이블**: `user_profiles`(읽기: `provider`, `password_changed`, `role` / 소셜 콜백에서 쓰기: upsert). `auth.users`(Supabase Auth 관리).
- **주의사항**:
  - `proxy.ts`는 **리다이렉트를 원칙적으로 하지 않으나** password_changed 예외 케이스에서만 리다이렉트한다. 그 외 `/admin` 접근 인증 리다이렉트는 `app/admin/layout.tsx`에서 처리.
  - 네이버는 `app_metadata.provider`가 `email`로 반환되므로, provider 판별은 반드시 `user_profiles.provider` 컬럼으로 해야 정확하다.
  - state 쿠키 maxAge는 5분. 만료 시 재시도 필요.
  - 소셜 콜백은 service_role 키가 필수(미설정 시 `missing_supabase_service_key` 등으로 리다이렉트).

---

## FEAT-AUTH-02 RLS 헬퍼 함수: get_my_role() / is_tournament_admin()

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `supabase/migrations/002_fix_rls_recursion.sql`, `supabase/migrations/019_tournament_co_admins.sql` |
| 관련 함수 | `get_my_role()`, `is_tournament_admin(t_id UUID)` (둘 다 `SECURITY DEFINER`) |
| 권한 | RLS 정책 내부에서 호출 (DB 함수) |

- **역할**: RLS 정책 안에서 `user_profiles`를 직접 조회할 때 발생하는 무한 재귀를 방지하고, 대회 관리 권한 판별을 단일 함수로 통합한다.
- **입력**:
  - `get_my_role()` — 인자 없음. 내부에서 `auth.uid()` 사용.
  - `is_tournament_admin(t_id UUID)` — 대회 ID.
- **출력**:
  - `get_my_role()` → 현재 사용자의 `role` 텍스트(`system_admin` / `tournament_admin` / …).
  - `is_tournament_admin(t_id)` → BOOLEAN.
- **비즈니스 규칙**:
  - `get_my_role()`: `SELECT role FROM user_profiles WHERE id = auth.uid()` — `SECURITY DEFINER STABLE`로 RLS를 우회해 재귀 차단(002).
  - `is_tournament_admin(t_id)`: 다음 중 하나라도 참이면 `true`(019) —
    1. `tournaments.admin_id = auth.uid()` (대표 관리자)
    2. `tournaments.created_by = auth.uid()` (원본 생성자)
    3. `tournament_admins` 테이블에 (`tournament_id`, `auth.uid()`) 존재 (공동 관리자)
    4. `user_profiles.role = 'system_admin'` (시스템 관리자)
  - 019에서 tournaments / divisions / division_merges / tournament_phases / groups / players / teams / team_members / matches / match_sets / standings **모든 쓰기(FOR ALL) 정책을 `is_tournament_admin()` 기반으로 재작성**(기존 정책 DROP 후 재생성).
- **관련 테이블**:
  - `user_profiles` (SELECT — SECURITY DEFINER로 RLS 우회)
  - `tournaments`, `tournament_admins` (SELECT — 권한 판별용)
  - `tournament_admins`: `Public read tournament_admins`(SELECT USING true), 쓰기는 `is_tournament_admin(tournament_id)`.
  - 모든 대회 하위 테이블: 공개 SELECT + 쓰기 `is_tournament_admin()`.
- **주의사항**:
  - RLS 정책 내부에서 절대 `user_profiles`를 직접 조회하지 말 것(재귀). 반드시 헬퍼 함수 사용.
  - 마이그레이션 실행 순서 중요: 019는 기존 정책을 DROP 후 재생성하므로 018 이후에 실행해야 한다.
  - 002는 `get_my_role()` 기반, 019는 `is_tournament_admin()` 기반으로 정책을 **덮어쓴다**. 최종 유효 정책은 019.

---

## FEAT-AUTH-03 API 라우트 권한 검사 4단계 패턴

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | 모든 관리자 API 라우트 공통 패턴 (`app/api/**/route.ts`) |
| 관련 함수 | `supabase.auth.getUser()`, `user_profiles.role` 조회, `tournament_admins` 조회 |
| 권한 | 관리자 API 라우트 진입 시 수동 검사 |

- **역할**: 관리자 라우트에는 별도 인증 미들웨어가 없으므로, 각 라우트가 수동으로 인증·소유권을 검사한다.
- **입력**: 요청 쿠키의 세션(서버 `createClient()`가 읽음).
- **출력**: 실패 시 표준 JSON 에러 — `401 { error: '인증 필요' }`, `403 { error: '권한 없음' }`, `404 { error: '대회 없음' }`.
- **비즈니스 규칙 (4단계)**:
  1. `supabase.auth.getUser()`로 `user` 취득 → 없으면 `401`.
  2. `user_profiles.role` 조회 → `system_admin` 여부 판별.
  3. `tournament.admin_id` / `created_by`, 또는 `tournament_admins` 테이블 조회로 소유권 판별.
  4. `admin_id` 변경(위임)은 `created_by` 또는 `system_admin`만 허용.
- **관련 테이블**: `user_profiles`(role), `tournaments`(admin_id, created_by), `tournament_admins`.
- **주의사항**:
  - 일부 라우트(divisions, admins DELETE 등)는 3단계에서 `tournament_admins`(공동 관리자)를 확인하지 않고 `admin_id`/`created_by`/`system_admin`만 확인하는 경우가 있으니 라우트별 정의를 참고할 것.
  - 클라이언트 직접 접근 경로는 이 4단계 대신 RLS(FEAT-AUTH-02)가 강제한다.

### 권한 계층표

| 역할 | 대회 데이터 수정 | 공동관리자 추가/삭제 | admin_id 변경(위임) | 부수 CRUD | 유저 관리 |
|------|:---:|:---:|:---:|:---:|:---:|
| `system_admin` | O | O | O | O | O |
| `created_by` (원본 생성자) | O | O | O | O | X |
| `admin_id` (대표 관리자) | O | O | X | O | X |
| `tournament_admins` (공동 관리자) | O (RLS) | X | X | X (API는 미허용) | X |

> 참고: 부수(divisions) API(`FEAT-TRN-03`)와 공동관리자 관리 API(`FEAT-TRN-02`)는 공동 관리자에게 권한을 주지 않고 `system_admin` / `admin_id` / `created_by`만 허용한다(RLS와 별개의 API 수동 검사).

---

## FEAT-AUTH-04 제공자 조회: GET /api/auth/provider

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `GET /api/auth/provider` (`app/api/auth/provider/route.ts`) |
| 관련 함수 | service_role `createAdminClient` |
| 권한 | 비인증 허용 (조회 전용) |

- **역할**: 이메일로 가입한 계정의 소셜 로그인 제공자를 조회해, 로그인 실패 시 올바른 로그인 방법을 안내한다.
- **입력**: 쿼리스트링 `?email=<이메일>`.
- **출력**: `{ provider: string | null }` (예: `google`, `naver`, `email` 또는 `null`).
- **비즈니스 규칙**: `email` 없거나 `SUPABASE_SERVICE_ROLE_KEY` 미설정 시 `{ provider: null }`을 조용히 반환. 존재 시 service_role 클라이언트로 `user_profiles.provider`를 `maybeSingle()` 조회.
- **관련 테이블**: `user_profiles` (SELECT `provider`, service_role로 RLS 우회).
- **주의사항**: service_role 키를 쓰므로 서버 전용. 계정 존재 여부가 노출될 수 있으나 provider 값만 반환한다.

---

## FEAT-AUTH-05 관리자 초대 생성: POST /api/admin/create-user

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `POST /api/admin/create-user` (`app/api/admin/create-user/route.ts`) |
| 관련 함수 | `admin.inviteUserByEmail()` (service_role) |
| 권한 | `system_admin` 전용 |

- **역할**: 신규 관리자에게 초대 이메일을 발송하고, 수신자가 링크로 비밀번호를 직접 설정하게 한다.
- **입력**: JSON 바디 `{ email, name }` (둘 다 필수).
- **출력**: `{ ok: true }`. 실패 시 `400 { error }`, 인증/권한 실패 시 `401`/`403`.
- **비즈니스 규칙**:
  1. `getUser()` 없으면 `401`.
  2. 호출자 `user_profiles.role !== 'system_admin'`이면 `403`.
  3. `email`/`name` 누락 시 `400`.
  4. service_role `admin.inviteUserByEmail(email, { data: { name }, redirectTo: '{origin}/auth/callback?next=/reset-password' })`로 초대.
  5. 초대 계정은 `user_profiles`에 `name`, `password_changed: false`로 업데이트(첫 로그인 시 비밀번호 설정 강제 — proxy.ts와 연계).
- **관련 테이블**: `user_profiles`(UPDATE name, password_changed), `auth.users`(초대 생성).
- **주의사항**: service_role 키(`SUPABASE_SERVICE_ROLE_KEY`), `NEXT_PUBLIC_SUPABASE_URL` 필수. `password_changed: false`이므로 초대 계정은 첫 `/admin` 접근 시 `/admin/change-password`로 강제 이동.

---

## FEAT-AUTH-06 유저 역할변경 / 삭제 / 검색

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `PATCH·DELETE /api/admin/users/[id]` (`app/api/admin/users/[id]/route.ts`), `GET /api/admin/users/search` (`app/api/admin/users/search/route.ts`) |
| 관련 함수 | `getCallerRole()`, service_role `admin.deleteUser()` |
| 권한 | PATCH/DELETE: `system_admin` 전용 · search: 인증된 사용자 |

- **역할**: 관리자 계정의 역할 변경, 계정 삭제, 이름/이메일 검색.
- **입력**:
  - `PATCH /api/admin/users/[id]` — 바디 `{ role }` (`system_admin` | `tournament_admin`).
  - `DELETE /api/admin/users/[id]` — 경로 파라미터 `id`.
  - `GET /api/admin/users/search?q=` — 검색어(이름/이메일 부분 일치).
- **출력**: PATCH/DELETE → `{ ok: true }`. search → 유저 배열 `[{ id, name, email, role }]` (최대 10건).
- **비즈니스 규칙**:
  - **PATCH**: 호출자 `system_admin`이 아니면 `403`. 대상이 `system_admin`이면 `403`("시스템 관리자 계정은 변경할 수 없습니다"). `role`이 `system_admin`/`tournament_admin` 외 값이면 `400`.
  - **DELETE**: 호출자 `system_admin` 아니면 `403`. 본인 계정이면 `400`("본인 계정은 삭제할 수 없습니다"). 대상이 `system_admin`이면 `403`. 삭제 전 해당 유저의 `tournaments.admin_id`, `tournaments.created_by`를 `NULL`로 해제(FK 제약 해소) 후 service_role `admin.deleteUser(id)` 실행.
  - **search**: 미인증 시 `401`. `q` 비면 `[]`. `user_profiles`에서 `name.ilike.%q% OR email.ilike.%q%`, 본인 제외(`neq id`), `limit(10)`. (공동관리자 추가 대상 탐색용.)
- **관련 테이블**: `user_profiles`(SELECT/UPDATE role), `tournaments`(admin_id/created_by NULL 해제), `auth.users`(삭제).
- **주의사항**: DELETE는 service_role 키 필수(미설정 시 `503`). search는 RLS상 본인+system_admin만 `user_profiles` SELECT 가능하므로, 실제로는 system_admin이 호출해야 타 사용자 결과가 반환된다.
