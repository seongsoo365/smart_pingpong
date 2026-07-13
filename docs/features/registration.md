# 기능 정의서(백엔드) — 참가신청 (Registration)

> 포함 기능ID: FEAT-REG-01 개인전 신청 · FEAT-REG-02 단체전 신청 · FEAT-REG-03 미승인 신청자 본인 수정/취소 RLS · FEAT-REG-04 접수 승인/거절 처리 · FEAT-REG-05 승인/거절 이메일 발송

참가신청은 **로그인 없이** 클라이언트가 Supabase에 직접 INSERT하며, RLS로 비인증 등록을 허용한다. 승인/거절은 관리자 페이지에서 `confirmed` 플래그를 토글하는 방식이다. 이메일 발송만 API Route(`/api/notify`)를 사용한다.

---

## FEAT-REG-01 개인전 신청

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `app/(public)/tournaments/[id]/register/page.tsx` (클라이언트가 `players`에 직접 INSERT) |
| 관련 함수 | `supabase.from('players').insert(...)`, `addMyRegistration()` |
| 권한 | 비인증 허용 (누구나 신청) |

- **역할**: 개인전 부수에 선수를 참가 신청한다. 로그인 불필요.
- **입력**: 폼 입력 → `players` INSERT 페이로드 `{ division_id, name, club|null, phone|null, email|null, confirmed: false }`.
  - `name` 필수, `phone`/`club`/`email` 선택. `phone`은 `010-XXXX-XXXX` 형식 검증(`validatePhone`), 자동 포맷팅(`formatPhone`).
- **출력**: 신규 player 행. 성공 시 `addMyRegistration({ id, type: 'player', tournament_id })`로 localStorage(`my_registrations`)에 저장, 완료 화면 표시.
- **비즈니스 규칙**:
  - 대회 `status !== 'registration'`이면 신청 페이지 접근 차단(대회 상세로 replace).
  - `name` 미입력 시 신청 거부(toast).
  - **중복 확인(FEAT-14)**: 같은 `division_id` 내 `name`(전화 있으면 `name`+`phone`) 일치 레코드가 있으면 "이미 신청된 내역" 거부.
  - `confirmed: false`로 저장(운영진 승인 대기).
- **관련 테이블**: `players` (INSERT). RLS: 공개 INSERT 허용(참가 신청). 등록 직후 조회는 `division_id`로 중복 체크.
- **주의사항**:
  - 신청 ID(UUID)가 사실상 본인 확인 수단(수정/취소용) — FEAT-REG-03 참조.
  - 이메일은 승인 결과 수신용(선택). 미입력 시 알림 발송 생략.

---

## FEAT-REG-02 단체전 신청

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `app/(public)/tournaments/[id]/register/page.tsx` (클라이언트가 `teams` + `team_members`에 직접 INSERT) |
| 관련 함수 | `supabase.from('teams').insert(...)`, `supabase.from('team_members').insert(...)`, `getTeamSize()`, `addMyRegistration()` |
| 권한 | 비인증 허용 |

- **역할**: 단체전 부수에 팀과 팀원을 참가 신청한다.
- **입력**:
  - `teams` INSERT: `{ division_id, name(팀명), club|null, email|null, confirmed: false }`.
  - `team_members` INSERT(팀 생성 후): `{ team_id, player_name, player_order(1부터), player_level|null }[]`.
- **출력**: 팀 행 + 팀원 행. 성공 시 `addMyRegistration({ id: team.id, type: 'team', tournament_id })`.
- **비즈니스 규칙**:
  - 팀원 수는 `division.team_match_format`의 `TEAM_SIZE` 맵(min/max)으로 제약(예: olympic 3인, traditional_4s1d 4~6인). min~max 사이 인원 선택 UI 제공.
  - `teamName` 미입력 또는 유효 팀원 수 < `min`이면 거부.
  - **팀명 중복 확인(FEAT-14)**: 같은 `division_id` 내 동일 `name` 팀이 있으면 거부.
  - 팀 INSERT 실패 시 팀원 INSERT 진행 안 함(오류 반환).
- **관련 테이블**: `teams` (INSERT), `team_members` (INSERT, `team_id` FK). RLS: 공개 INSERT 허용.
- **주의사항**:
  - 팀과 팀원 INSERT는 2단계(트랜잭션 아님). 팀원 INSERT 실패 시 팀 레코드가 남을 수 있어 재신청 시 팀명 중복으로 걸릴 수 있음.
  - `confirmed: false`로 저장, 승인은 `max_teams` 슬롯 제약을 받음(FEAT-REG-04).

---

## FEAT-REG-03 미승인 신청자 본인 수정 / 취소 RLS

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `supabase/migrations/018_registration_self_edit.sql` (RLS 정책) / `app/(public)/tournaments/[id]/my-registration/page.tsx` |
| 관련 함수 | (RLS 정책만, DB 함수 없음) |
| 권한 | 비인증 사용자 — 단, `confirmed = false`인 레코드만 |

- **역할**: 승인 전(`confirmed = false`) 신청 레코드에 한해, 비로그인 신청자가 본인의 신청을 수정/취소할 수 있게 한다.
- **입력**: 신청 UUID로 대상 지정(localStorage `my_registrations`에 저장된 ID). 수정 시 이름·부수 등 변경.
- **출력**: UPDATE/DELETE 반영.
- **비즈니스 규칙 (RLS 정책)**:
  - `players`: `Public self update players`(UPDATE `USING confirmed = false` + `WITH CHECK confirmed = false`), `Public self delete players`(DELETE `USING confirmed = false`).
  - `teams`: 동일하게 `confirmed = false` 조건으로 공개 UPDATE/DELETE 허용.
  - `team_members`: 소속 팀이 `confirmed = false`인 경우에만 공개 UPDATE/DELETE (`EXISTS (SELECT 1 FROM teams t WHERE t.id = team_id AND t.confirmed = false)`).
- **관련 테이블**: `players`, `teams`, `team_members` (UPDATE/DELETE, `confirmed = false` 조건).
- **주의사항**:
  - UUID가 사실상 비밀번호 역할(브루트포스 방지).
  - `WITH CHECK confirmed = false`이므로 신청자가 스스로 `confirmed = true`로 승격할 수 없다(승인 전 상태 유지).
  - **승인된 뒤에는(confirmed=true) 신청자 수정/취소 불가** — 관리자가 승인 취소(FEAT-REG-04)로 되돌려야 수정 가능.

---

## FEAT-REG-04 접수 승인 / 거절 처리

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `app/admin/tournaments/[id]/registrations/page.tsx` (클라이언트가 `players`/`teams`의 `confirmed` 토글) |
| 관련 함수 | `supabase.from('players'/'teams').update({ confirmed })`, `.delete()`, `notify()` |
| 권한 | 대회 관리 권한자 (RLS `is_tournament_admin`) |

- **역할**: 관리자가 미승인 신청을 승인(`confirmed=true`)/거절(삭제)/승인취소(`confirmed=false`)한다. 개인·단체 모두 지원.
- **입력**: 대상 player/team 레코드. 부수(division)별 필터 및 전체/시간순 일괄 처리 지원.
- **출력**: `confirmed` 갱신 또는 레코드 삭제. 성공 시 toast + 이메일 알림(FEAT-REG-05).
- **비즈니스 규칙**:
  - **개인전**: `approvePlayer`(1건 `confirmed=true`), `rejectPlayer`(`delete()`), `approveAllPlayers(divId)`(해당 부수 전체 `confirmed=true` 일괄), `revokePlayer`(`confirmed=false`로 승인 취소).
  - **단체전**: `approveTeam`(1팀 승인 — `div.max_teams` 도달 시 거부), `rejectTeam`(`delete()`), `approveOldestTeams(divId)`(신청 시간(created_at) 오름차순으로 남은 슬롯(`max_teams - approved`)만큼 일괄 승인), `revokeTeam`(승인 취소 + 슬롯 카운트 감소).
  - **슬롯 제약**: 단체전은 `max_teams`가 설정된 경우 승인 팀 수가 이를 초과할 수 없다. 도달 시 "마감" 표시 및 승인 버튼 비활성화.
  - 승인 취소 시 `confirmed=false`가 되어 신청자가 다시 수정 가능(FEAT-REG-03).
  - 데이터 로딩: 미승인/승인 목록을 개인(`players`)·단체(`teams`+`team_members` 조인) 각각 `confirmed` 기준으로 병렬 조회.
- **관련 테이블**: `players` (UPDATE confirmed / DELETE), `teams` (UPDATE confirmed / DELETE), `team_members` (조인 SELECT), `divisions`(max_teams), `tournaments`(name). RLS: 쓰기 `is_tournament_admin()`.
- **주의사항**:
  - 거절은 레코드 **삭제**(복구 불가). 승인 취소는 상태만 되돌림.
  - 승인/거절/승인취소는 사용자 세션 클라이언트로 수행되므로 RLS(`is_tournament_admin`)로 권한 강제 — 권한 없으면 update/delete가 0건 반영된다.
  - 이메일 알림은 `email`이 있을 때만 발송(fire-and-forget, 실패해도 승인 자체엔 영향 없음).

---

## FEAT-REG-05 승인 / 거절 이메일 발송: POST /api/notify

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `POST /api/notify` (`app/api/notify/route.ts`) |
| 관련 함수 | Resend API (`https://api.resend.com/emails`), `buildHtml()` |
| 권한 | (내부 호출 전용) 인증 검사 없음 — 관리자 페이지에서 fire-and-forget 호출 |

- **역할**: 참가 신청 승인/거절 결과를 신청자 이메일로 발송한다.
- **입력**: JSON 바디 `{ type: 'approved' | 'rejected', email, name, tournamentName, divisionName }`.
- **출력**: 성공 `{ ok: true }`. 키 없음 시 `{ ok: true, skipped: true }`. 실패 시 `400`(필드 누락/JSON 오류), `502`(발송 실패).
- **비즈니스 규칙**:
  - `RESEND_API_KEY` 미설정 시 **조용히 skip**(`{ ok: true, skipped: true }`) — 이메일 없이도 승인 흐름 정상 동작.
  - 필수 필드(`type`, `email`, `name`, `tournamentName`) 누락 시 `400`.
  - 발신자: `NOTIFY_FROM_EMAIL` 환경변수 또는 기본값 `Smart Pingpong <noreply@smart-pingpong.vercel.app>`.
  - 제목: `[{tournamentName}] 참가 신청 {승인|거절} 안내`. 본문은 `buildHtml()`로 상태별(승인=파랑 #3B82F6 / 거절=빨강 #EF4444) HTML 템플릿 생성.
  - Resend 응답 실패 시 콘솔 로그 + `502`.
- **관련 테이블**: 없음(이메일 발송 전용, DB 접근 없음).
- **주의사항**:
  - 인증/권한 검사가 없는 라우트지만 실제 호출은 관리자 페이지의 `notify()`에서만 이뤄지며 fire-and-forget(응답 무시). 외부에서 임의 호출 가능성은 있으나 부수효과는 이메일 발송뿐.
  - `divisionName`은 관리자 페이지에서 `{성별라벨} {부수명}` 형태로 조합해 전달.
