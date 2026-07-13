# 화면 요구사항정의서 — 관리자 기타

포함 화면: **ADM-E01** 관리자 대시보드 · **ADM-E02** 대회별 Q&A 관리 · **ADM-E03** 메인 Q&A 관리 · **ADM-E04** 일회성 게임(숏게임) 관리 · **ADM-E05** 시스템 회원 관리 · **ADM-E06** 비밀번호 변경

---

## ADM-E01 관리자 대시보드

| 항목 | 내용 |
|------|------|
| 경로 | /admin |
| 파일 | app/admin/page.tsx |
| 유형 | 서버 컴포넌트 (async) |
| 접근권한 | 로그인 사용자(미로그인 시 /login 리다이렉트). system_admin 여부에 따라 표시 차등 |

- **주요 기능**: 로그인 관리자의 홈. 내 대회의 상태별 카운트(준비/접수/진행/종료), 메인 Q&A 미답변 카운트 바로가기, 내 대회 목록(최근 20개), system_admin이면 사용자 관리 링크를 제공.
- **입력 항목**: 없음(조회 전용 대시보드).
- **처리 흐름**: `getAuthUser()`로 세션 확인 → 없으면 `/login`. `user_profiles`로 role 조회 + `main_questions`의 미답변(`answer is null`) count(head)를 병렬 조회. system_admin이면 전체 대회 20개, 아니면 `admin_id`/`created_by`/공동관리자(`tournament_admins`)로 필터한 대회 20개를 `created_at desc`로 조회. 상태별 개수 집계 후 카드/목록 렌더.
- **연동 API/테이블**: Supabase 직접 — `user_profiles`, `main_questions`(count), `tournament_admins`(공동관리 대회 id), `tournaments`(목록). `/api` 미사용.
- **주요 컴포넌트**: `components/admin/TournamentDashboardList`(대회 목록 카드 리스트). lucide(Plus/Trophy/ArrowRight/MessageCircle/Clock).
- **주의사항**: 대회 목록 SELECT는 필요한 컬럼만(`id,name,venue,start_date,end_date,status`) 조회. 미답변 Q&A 0건이면 배지 숨김. 목록 비었을 때 "첫 대회 등록하기" 안내. 사용자 관리 링크는 system_admin에게만 노출.

---

## ADM-E02 대회별 Q&A 관리

| 항목 | 내용 |
|------|------|
| 경로 | /admin/tournaments/[id]/qna |
| 파일 | app/admin/tournaments/[id]/qna/page.tsx |
| 유형 | 클라이언트 컴포넌트 (`use(params)`) |
| 접근권한 | 해당 대회 소유자/관리자(is_tournament_admin) |

- **주요 기능**: 특정 대회에 등록된 질문(`tournament_questions`)을 미답변/답변 완료로 나눠 표시하고, 답변 저장·공개(is_public) 토글·삭제를 수행.
- **입력 항목**: 질문별 답변 textarea(공백만이면 저장 버튼 disabled). 그 외 토글·삭제 버튼.
- **처리 흐름**: 로드 시 대회명 + 해당 대회 질문 전체를 created_at 순 조회. 답변 저장 `saveAnswer()` → `answer`, `answered_by`(auth.uid), `answered_at` update 후 재로드 + 토스트. 공개 토글 → `is_public` 반전 update(낙관적). 삭제 → confirm 후 delete. 미답변/답변완료 개수를 헤더에 표시.
- **연동 API/테이블**: Supabase 직접 — `tournaments`(name), `tournament_questions`(select/update/delete). `/api` 미사용.
- **주요 컴포넌트**: lucide(MessageCircle/Send/Trash2/CheckCircle/Clock), sonner. 인라인 카드 UI.
- **주의사항**: 공개 방문자 노출은 RLS의 `is_public` 기준(답변 여부 무관, 등록 즉시 노출). 답변 저장은 `answered_by=user.id`로 기록. 삭제는 hard delete. 이 화면은 대회 단위(부수와 무관).

---

## ADM-E03 메인 Q&A 관리

| 항목 | 내용 |
|------|------|
| 경로 | /admin/qna |
| 파일 | app/admin/qna/page.tsx |
| 유형 | 클라이언트 컴포넌트 |
| 접근권한 | system_admin (RLS로 전체 SELECT/UPDATE/DELETE 제한) |

- **주요 기능**: 대회와 무관한 사이트 공통 Q&A(`main_questions`)를 미답변/답변 완료로 관리. 답변 저장·공개/비공개 토글·삭제. 홈 `MainQnaSection`에 공개 노출되는 질문의 관리자 측 화면.
- **입력 항목**: 질문별 답변 textarea(공백만이면 저장 disabled). 공개/비공개 토글·삭제 버튼.
- **처리 흐름**: 로드 시 `main_questions` 전체를 created_at 순 조회. 답변 저장 → `answer`/`answered_by`/`answered_at` update 후 재로드 + 토스트. 공개 토글 → `is_public` 반전 update. 삭제 → confirm 후 delete. 헤더에 미답변/답변완료 개수 표시.
- **연동 API/테이블**: Supabase 직접 — `main_questions`(select/update/delete). `/api` 미사용.
- **주요 컴포넌트**: lucide(MessageCircle/Send/Trash2/CheckCircle/Clock), sonner. ADM-E02와 거의 동일한 카드 UI(대회명 헤더 없음).
- **주의사항**: 이 화면은 AdminSidebar "Q&A 관리" 메뉴 및 대시보드(ADM-E01) 미답변 카운트와 연동. 페이지 자체에 역할 가드 코드는 없고 RLS/사이드바 노출로 접근 통제(system_admin 전용). 삭제는 hard delete.

---

## ADM-E04 일회성 게임(숏게임) 관리

| 항목 | 내용 |
|------|------|
| 경로 | /admin/games |
| 파일 | app/admin/games/page.tsx |
| 유형 | 클라이언트 컴포넌트 |
| 접근권한 | 관리자(admin 레이아웃 인증). 수정/삭제는 소유자·system_admin(API에서 검사) |

- **주요 기능**: 대회 구조와 독립된 1:1 단식 경기(`casual_games`)의 목록 조회 및 등록/수정/삭제. 다이얼로그 폼으로 세트별 점수를 입력하고 세트 승수를 자동 계산.
- **입력 항목**(Dialog 폼): player1_name/player2_name(필수) · player1_club/player2_club(선택) · games_per_match(세트 수 3/5/7 버튼) · points_per_game(세트당 점수 11/21 버튼) · sets(세트별 score1/score2 number, 세트 추가/삭제 가능, 점수 0인 세트는 저장 시 제외) · played_at(경기 날짜 date, 기본 오늘) · venue(장소) · notes(메모).
- **처리 흐름**: 마운트 시 `GET /api/games`로 목록 로드. "숏게임 등록"→빈 폼 다이얼로그, 행 연필→수정 다이얼로그(기존 값 채움). 저장 `handleSave()` → 이름 미입력/유효 세트 0이면 토스트 에러 → 등록 `POST /api/games` / 수정 `PUT /api/games/[id]` (payload = form + validSets) → 성공 토스트 후 목록 재로드. 삭제 → confirm 후 `DELETE /api/games/[id]` → 낙관적 목록 제거. 세트 승수는 `computeScores`로 실시간 미리보기 표시.
- **연동 API/테이블**: `/api/games`(GET/POST), `/api/games/[id]`(PUT/DELETE). 테이블 `casual_games`(score1/score2=세트 승수, sets=JSONB).
- **주요 컴포넌트**: `components/ui`의 Button/Dialog/Input/Label. lucide(Plus/Pencil/Trash2/Minus), sonner. 목록은 반응형 table(세트 상세는 sm+, 장소는 md+에서 노출).
- **주의사항**: 유효 세트(점수>0) 최소 1개 필요. 세트 수 변경 시 세트 배열 초기화(`buildInitialSets`). 등록은 비인증도 가능한 API지만 이 화면은 관리자 레이아웃 하위. 수정/삭제 권한은 API에서 소유자/`system_admin` 검사(화면에서는 실패 시 토스트).

---

## ADM-E05 시스템 회원 관리

| 항목 | 내용 |
|------|------|
| 경로 | /admin/system/users |
| 파일 | app/admin/system/users/page.tsx (+ AddAdminForm.tsx, UserList.tsx) |
| 유형 | 서버 컴포넌트(page) + 클라이언트 컴포넌트(하위 폼/목록) |
| 접근권한 | system_admin 전용 (아니면 /admin 리다이렉트) |

- **주요 기능**: 대회 관리자 계정을 이메일 초대로 생성하고, 등록된 사용자 목록에서 역할 변경·삭제. system_admin 전용 화면.
- **입력 항목**:
  - AddAdminForm: name(이름, 필수) · email(이메일, 필수).
  - UserList: 사용자별 role select(tournament_admin/system_admin), 삭제 버튼.
- **처리 흐름**: page에서 `getAuthUser()` → 미로그인 `/login`, role≠system_admin이면 `/admin` 리다이렉트. `user_profiles` 전체를 created_at desc로 조회해 UserList에 전달. 초대(AddAdminForm) → `POST /api/admin/create-user {email,name}` → 성공 시 초대 링크 발송 토스트. 역할 변경 → `PATCH /api/admin/users/[id] {role}`(낙관적 반영). 삭제 → confirm 후 `DELETE /api/admin/users/[id]`.
- **연동 API/테이블**: Supabase 직접 — `user_profiles`(초기 목록). API: `/api/admin/create-user`(POST, service_role), `/api/admin/users/[id]`(PATCH/DELETE).
- **주요 컴포넌트**: `AddAdminForm`(초대 폼), `UserList`(아바타/provider 배지/role select/삭제). lucide(Send/Trash2/ChevronDown/ShieldCheck), sonner.
- **주의사항**: system_admin 계정은 UserList에서 역할이 잠금 배지로 표시되어 변경 불가, 삭제 버튼도 비활성. 본인 계정(isSelf)은 삭제 불가. provider(google/naver/email)별 배지 표시. 아바타 이미지는 `referrerPolicy="no-referrer"`.

---

## ADM-E06 비밀번호 변경

| 항목 | 내용 |
|------|------|
| 경로 | /admin/change-password |
| 파일 | app/admin/change-password/page.tsx |
| 유형 | 클라이언트 컴포넌트 |
| 접근권한 | 로그인 사용자(admin 레이아웃 인증) |

- **주요 기능**: 로그인 사용자가 자신의 비밀번호를 변경(초대받은 관리자의 초기 비밀번호 교체 용도). 변경 성공 시 프로필의 `password_changed` 플래그를 true로 갱신.
- **입력 항목**: password(새 비밀번호, 필수, 검증: 최소 8자·영문 포함·숫자 포함) · confirm(비밀번호 확인, 필수, password와 일치해야 함).
- **처리 흐름**: 제출 → `validatePassword()`로 규칙 검증(실패 시 토스트) → password≠confirm이면 토스트 → `supabase.auth.updateUser({password})` → 성공 시 현재 user 조회 후 `user_profiles.password_changed=true` update → 성공 토스트 → `/admin`으로 이동 + `router.refresh()`.
- **연동 API/테이블**: Supabase Auth `auth.updateUser`, 테이블 `user_profiles`(password_changed update). `/api` 미사용.
- **주요 컴포넌트**: lucide(KeyRound), sonner. 단일 카드 폼.
- **주의사항**: 비밀번호 규칙(8자+영문+숫자)은 클라이언트 검증만 존재. `password_changed` 플래그는 초기 비밀번호 강제 변경 흐름과 연동되는 값. 변경 후 세션 갱신을 위해 refresh 호출.
