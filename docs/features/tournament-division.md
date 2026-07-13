# 기능 정의서(백엔드) — 대회·부수 (Tournament / Division)

> 포함 기능ID: FEAT-TRN-01 대회 수정/삭제/위임 · FEAT-TRN-02 공동관리자 관리 · FEAT-TRN-03 부수 생성/수정/삭제

대회 및 부수의 생성·변경·삭제는 service_role 또는 소유권 판별이 필요해 API Route로 처리한다. 조회/실시간 표시는 클라이언트가 Supabase에 직접 접근하며 공개 SELECT RLS로 허용된다.

---

## FEAT-TRN-01 대회 수정 / 삭제 / 위임

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `PATCH·DELETE /api/tournaments/[id]` (`app/api/tournaments/[id]/route.ts`) |
| 관련 함수 | `supabase.auth.getUser()`, `user_profiles.role`·`tournament_admins` 수동 조회, service_role `createAdminClient` (DELETE) |
| 권한 | 수정: `system_admin` / `admin_id` / `created_by` / 공동관리자 · 위임(admin_id 변경): `created_by` 또는 `system_admin`만 |

- **역할**: 대회 정보를 수정하거나 대회를 삭제하고, 대표 관리자(`admin_id`)를 다른 사용자에게 위임한다.
- **입력**:
  - `PATCH` — JSON 바디. 허용 필드: `name`, `venue`, `description`, `regulations`, `start_date`, `end_date`, `registration_start`, `registration_end`, `status`. (추가로 `admin_id` — 위임용)
  - `DELETE` — 경로 파라미터 `id`.
- **출력**:
  - `PATCH` → 갱신된 tournament 행. 실패 시 `400 { error }`.
  - `DELETE` → `{ ok: true }`. 실패 시 `500 { error }`.
  - 공통 실패: `401 인증 필요`, `403 권한 없음`, `404 대회 없음`.
- **비즈니스 규칙**:
  1. `getUser()` 없으면 `401`.
  2. 대상 `tournaments`에서 `admin_id, created_by` 조회, 없으면 `404`.
  3. 권한 판별: `profile.role === 'system_admin'`(isAdmin) 또는 `admin_id === user.id || created_by === user.id || 공동관리자(tournament_admins에 존재)`(isOwner). 둘 다 아니면 `403`.
  4. **PATCH**: 허용 필드만 `updates`에 반영(빈 값은 `null`). `admin_id` 위임은 **isAdmin 또는 created_by 본인만** 가능(아니면 `403`), 그 외에는 `admin_id` 무시.
  5. **DELETE**: 권한 확인 후 service_role `adminClient`로 `tournaments.delete()`(CASCADE로 하위 부수/경기 등 함께 삭제). service_role 키 미설정 시 `503`.
- **관련 테이블**:
  - `tournaments` (SELECT admin_id/created_by, UPDATE, DELETE)
  - `user_profiles` (SELECT role)
  - `tournament_admins` (SELECT — 공동관리자 판별)
  - RLS: `Admins manage tournaments` = `is_tournament_admin(id)` (019). PATCH는 사용자 세션 클라이언트로 UPDATE(RLS 적용), DELETE는 service_role로 RLS 우회.
- **주의사항**:
  - **위임(admin_id 변경)** 은 대표 관리자(admin_id 본인)나 공동관리자는 할 수 없고, 오직 원본 생성자(created_by) 또는 system_admin만 가능.
  - DELETE는 CASCADE 삭제이므로 복구 불가. service_role을 사용하는 유일한 대회 라우트.

---

## FEAT-TRN-02 공동관리자 관리

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `GET·POST /api/tournaments/[id]/admins` (`app/api/tournaments/[id]/admins/route.ts`), `DELETE /api/tournaments/[id]/admins/[userId]` (`.../admins/[userId]/route.ts`) |
| 관련 함수 | `getPermissions()` (내부 헬퍼) — `tournaments`+`user_profiles` 병렬 조회 |
| 권한 | GET: 공개 · POST/DELETE: `system_admin` / `admin_id` / `created_by`만 (공동관리자는 불가) |

- **역할**: 대회의 공동 관리자 목록 조회, 추가, 제거.
- **입력**:
  - `GET /api/tournaments/[id]/admins` — 경로 `id`.
  - `POST /api/tournaments/[id]/admins` — 바디 `{ userId }` (추가할 대상 사용자 ID).
  - `DELETE /api/tournaments/[id]/admins/[userId]` — 경로 `id`, `userId`.
- **출력**:
  - `GET` → `tournament_admins` 배열(각 행에 `user:user_id(id, name, email, role)` 조인), `added_at` 오름차순. 데이터 없으면 `[]`.
  - `POST` → 추가된 행(user 조인 포함), `201`.
  - `DELETE` → `{ ok: true }`.
- **비즈니스 규칙**:
  - `getPermissions()`: `tournaments(admin_id, created_by)` + `user_profiles(role)` 병렬 조회. `canManage = isSystemAdmin || isPrimaryAdmin(admin_id 또는 created_by 본인)`. — **공동관리자(tournament_admins)는 canManage에 포함되지 않음**.
  - **POST**: 미인증 `401`, 대회 없음 `404`, `!canManage` `403`, `userId` 없음 `400`. 대상이 이미 `created_by`/`admin_id`이면 `409 이미 관리자입니다`. INSERT 시 `added_by: user.id` 기록. 유니크 위반(`23505`) 시 `409 이미 추가된 관리자입니다`.
  - **DELETE**: 미인증 `401`, 대회 없음 `404`, `isSystemAdmin || isPrimaryAdmin` 아니면 `403`. `tournament_admins`에서 (`tournament_id`, `user_id`) 삭제.
  - **GET**: 권한 검사 없이 누구나 조회 가능(대시보드 등에서 사용). RLS `Public read tournament_admins`(SELECT true)에 대응.
- **관련 테이블**:
  - `tournament_admins` (SELECT/INSERT/DELETE) — PK (`tournament_id`, `user_id`), `added_by`, `added_at`. RLS: 공개 SELECT, 쓰기 `is_tournament_admin(tournament_id)`.
  - `tournaments`(SELECT admin_id/created_by), `user_profiles`(SELECT role + 조인).
- **주의사항**:
  - 공동관리자 자신은 다른 공동관리자를 추가/삭제할 수 없다(대표 관리자·생성자·system_admin만).
  - 대표 관리자/생성자/system_admin은 이미 권한이 있으므로 `tournament_admins`에 중복 추가할 필요가 없고, POST 시 `409`로 거부된다.
  - 검색 대상 사용자는 FEAT-AUTH-06의 `GET /api/admin/users/search`로 조회한다.

---

## FEAT-TRN-03 부수 생성 / 수정 / 삭제

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `POST /api/divisions` (`app/api/divisions/route.ts`), `PATCH·DELETE /api/divisions/[id]` (`app/api/divisions/[id]/route.ts`) |
| 관련 함수 | `canManageTournament()` (내부 헬퍼), `tournament_phases` 자동 생성 |
| 권한 | `system_admin` / `admin_id` / `created_by` (공동관리자 미포함) |

- **역할**: 대회 부수(division)를 생성·수정·삭제하고, 생성 시 본선(main) 단계를 자동으로 만든다.
- **입력**:
  - `POST` — 바디 `{ tournament_id, name, gender?, match_type?, team_match_format?, display_order?, max_teams? }`. (`tournament_id`, `name` 필수)
  - `PATCH /api/divisions/[id]` — 바디 `{ name, gender, match_type, team_match_format?, max_teams? }`.
  - `DELETE /api/divisions/[id]` — 경로 `id`.
- **출력**:
  - `POST` → 생성된 division 행, `201`.
  - `PATCH` → 갱신된 division 행.
  - `DELETE` → `{ ok: true }`.
  - 실패: `400`(필수 누락/DB 오류), `401`, `403`, `404 부수 없음`, `409`(경기 존재).
- **비즈니스 규칙**:
  - **권한 판별 (`canManageTournament`)**: `tournaments(admin_id, created_by)` + `user_profiles(role)` 조회 → `system_admin || admin_id 본인 || created_by 본인`. **공동관리자(tournament_admins)는 포함되지 않음**.
  - **POST**: 미인증 `401`, `tournament_id`/`name` 누락 `400`, 권한 없음 `403`. 기본값 — `gender: 'male'`, `match_type: 'individual'`, `team_match_format: null`, `display_order: 0`, `max_teams: null`. INSERT 성공 직후 **본선 단계 자동 생성**: `tournament_phases`에 `{ division_id, phase_type: 'main', phase_order: 1, format: 'single_elimination', games_per_match: 3, points_per_game: 11 }` INSERT.
  - **PATCH**: 부수 조회 없으면 `404`, 소속 대회로 권한 판별 후 `name, gender, match_type, team_match_format(?? null), max_teams(?? null)` 갱신.
  - **DELETE**: 권한 확인 후 **경기 존재 검사** — 부수의 `tournament_phases` id들을 모은 뒤 `matches`에서 `phase_id in (...)` count > 0이면 `409 이미 경기가 생성된 부수는 삭제할 수 없습니다`. 없으면 `divisions.delete()`.
- **관련 테이블**:
  - `divisions` (SELECT/INSERT/UPDATE/DELETE). RLS: `is_tournament_admin(tournament_id)` 하위 EXISTS.
  - `tournament_phases` (POST 시 INSERT — 본선 자동 생성 / DELETE 시 SELECT — 경기 존재 확인).
  - `matches` (DELETE 시 count 확인 — 경기 있으면 삭제 거부).
  - `tournaments`(SELECT admin_id/created_by), `user_profiles`(SELECT role).
- **주의사항**:
  - 부수 생성 시 본선 단계만 자동 생성되고 예선(preliminary) 단계는 자동 생성되지 않는다. 예선/대진 생성은 draw 페이지에서 별도 처리.
  - **경기가 이미 생성된 부수는 삭제 불가(409)** — 대진표 재생성 전에 이 제약이 걸린다.
  - 이 API는 공동관리자에게 권한을 주지 않는다(RLS는 허용하지만 API 수동 검사는 대표/생성자/system_admin만). 클라이언트가 API 대신 직접 Supabase로 접근하면 RLS(`is_tournament_admin`)에 따라 공동관리자도 가능해질 수 있으므로 경로에 유의.
