# 기능 정의서 — 인덱스

> **에이전트 진입점.** 백엔드/기능 작업 시 아래 표에서 기능을 찾아 **해당 파일 1개만 Read**하세요.
> 각 기능 섹션은 `엔드포인트/위치 / 관련 함수 / 권한` 표와 `역할·입력·출력·비즈니스 규칙·관련 테이블·주의사항` 항목으로 구성됩니다.

**아키텍처 특징**: 이 프로젝트는 API Route를 최소로만 사용합니다. 대부분의 CRUD·실시간 데이터는 클라이언트가 Supabase에 **직접 접근**하고 **RLS로 권한을 강제**합니다. API Route는 (1) service_role 키가 필요한 작업, (2) 외부 연동(이메일/디스코드), (3) 복잡한 집계(랭킹/전적)에만 존재합니다. 대진표 생성·점수 진출 같은 핵심 로직은 API가 아니라 **admin 페이지(client component)** 안에 있습니다.

DB 스키마·테이블·마이그레이션은 [`../data-model.md`](../data-model.md) 참고 (단일 출처).

## 인증·권한 → [`auth-authz.md`](./auth-authz.md)

| 기능ID | 기능명 | 위치 |
|--------|--------|------|
| FEAT-AUTH-01 | 로그인 흐름(이메일/구글/카카오/네이버) + 세션 갱신 | `app/(auth)/login`, `app/auth/*`, `proxy.ts` |
| FEAT-AUTH-02 | RLS 헬퍼 함수 | `get_my_role()`, `is_tournament_admin()` |
| FEAT-AUTH-03 | API 라우트 권한 검사 4단계 패턴 | (공통 패턴) |
| FEAT-AUTH-04 | 제공자 조회 | `GET /api/auth/provider` |
| FEAT-AUTH-05 | 관리자 초대 생성 | `POST /api/admin/create-user` |
| FEAT-AUTH-06 | 유저 역할변경/삭제/검색 | `/api/admin/users/[id]`, `/api/admin/users/search` |

## 대회·부수 → [`tournament-division.md`](./tournament-division.md)

| 기능ID | 기능명 | 위치 |
|--------|--------|------|
| FEAT-TRN-01 | 대회 수정/삭제/위임 | `PATCH·DELETE /api/tournaments/[id]` |
| FEAT-TRN-02 | 공동관리자 관리 | `/api/tournaments/[id]/admins`, `.../[userId]` |
| FEAT-TRN-03 | 부수 생성/수정/삭제 | `POST /api/divisions`, `PATCH·DELETE /api/divisions/[id]` |

## 참가신청 → [`registration.md`](./registration.md)

| 기능ID | 기능명 | 위치 |
|--------|--------|------|
| FEAT-REG-01 | 개인전 신청 | `players` 직접 insert (confirmed=false) |
| FEAT-REG-02 | 단체전 신청 | `teams` + `team_members` |
| FEAT-REG-03 | 미승인 신청자 본인 수정/취소 RLS | migrations/018_registration_self_edit |
| FEAT-REG-04 | 접수 승인/거절 처리 | `app/admin/.../registrations` |
| FEAT-REG-05 | 승인/거절 이메일 발송 | `POST /api/notify` (Resend) |

## 대진·점수 (핵심 로직) → [`draw-scores.md`](./draw-scores.md)

| 기능ID | 기능명 | 위치 |
|--------|--------|------|
| FEAT-DRW-01 | 대진표 생성 | `app/admin/.../draw/page.tsx` |
| FEAT-DRW-02 | 점수 입력/승자 진출 | `app/admin/.../scores/page.tsx` |
| FEAT-DRW-03 | 예선 진출 처리 | `checkPrelimAdvancement`, `getPrelimSlotPlacements` |
| FEAT-DRW-04 | 동점 수동 순위확정 | `confirmRanking()` |
| FEAT-DRW-05 | 브라켓/리그/순위 유틸 | `lib/utils/{bracket,roundrobin,standings}.ts` |

## 랭킹·전적 → [`ranking-records.md`](./ranking-records.md)

| 기능ID | 기능명 | 위치 |
|--------|--------|------|
| FEAT-RNK-01 | 전체 랭킹 집계 | `GET /api/players/rankings` |
| FEAT-RNK-02 | 선수 개인 전적 | `GET /api/players/records` |
| FEAT-RNK-03 | 선수 검색 | `GET /api/players/search` |
| FEAT-RNK-04 | 레이팅 포인트 규칙 | `lib/utils/rating.ts` |

## Q&A·알림 → [`qna-notify.md`](./qna-notify.md)

| 기능ID | 기능명 | 위치 |
|--------|--------|------|
| FEAT-QNA-01 | 대회 Q&A | `tournament_questions`, `QnaSection.tsx` |
| FEAT-QNA-02 | 메인 Q&A | `main_questions`, `MainQnaSection.tsx` |
| FEAT-QNA-03 | Q&A 등록 Discord 알림 | `POST /api/notify/discord` |

---

## 공통: API 라우트 권한 검사 패턴

관리자 라우트에 별도 인증 미들웨어는 없고, 각 라우트가 수동으로 소유권을 확인합니다:
1. `supabase.auth.getUser()` → `user` 취득
2. `user_profiles.role` 조회 → `system_admin` 여부
3. `tournament.admin_id/created_by` 또는 `tournament_admins` 테이블 → 소유권
4. `admin_id` 변경(위임)은 `created_by` 또는 `system_admin`만 허용

## 공통: Supabase 클라이언트

| 컨텍스트 | 함수 | 파일 |
|----------|------|------|
| 서버 컴포넌트 / API 라우트 | `createClient()` | `lib/supabase/server.ts` |
| 공개 서버 컴포넌트(미설정 시 동작) | `createClientSafe()` → **null 체크 필수** | `lib/supabase/server.ts` |
| 클라이언트 컴포넌트 | `createClient()` | `lib/supabase/client.ts` |
| 설정 여부 가드 | `supabaseConfigured` (boolean) | `lib/supabase/server.ts` |
