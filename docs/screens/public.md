# 화면 요구사항정의서 — 공개 화면

> 비인증 사용자가 접근 가능한 공개 화면 정의서입니다.
> 포함 화면: **PUB-01 홈**, **PUB-02 대회 목록**, **PUB-03 대회 상세**, **PUB-04 부수 상세(대진/순위 실시간)**, **PUB-05 참가 신청**, **PUB-06 내 신청정보 조회/수정**, **PUB-07 선수 랭킹**, **PUB-08 선수 전적 조회**, **PUB-09 일회성(캐주얼) 게임 등록**

---

## PUB-01 홈

| 항목 | 내용 |
|------|------|
| 경로 | / |
| 파일 | app/(public)/page.tsx |
| 유형 | 서버 컴포넌트 (async) |
| 접근권한 | 비인증 공개 |

- **주요 기능**: 진행 중·접수 중 대회, 최근 종료 대회(종료일 기준 최근 30일), 준비 중 대회를 섹션별로 카드 목록으로 노출한다. 하단에 메인 Q&A 섹션(질문 목록 + 등록 폼)을 임베드한다.
- **입력 항목**: 없음(파라미터 없음). 대회 전체보기 링크는 `/tournaments`(및 `?status=completed`, `?status=draft`)로 이동.
- **처리 흐름**: 서버에서 `createClientSafe()`로 Supabase 접근 → `Promise.all`로 active(`status in ['registration','in_progress']`, start_date 오름차순 6개) / recent(`status='completed'`, end_date ≥ 오늘-30일, 4개) / drafts(`status='draft'`, 6개) / main_questions(`is_public=true`, created_at 순) 병렬 조회 → 각 섹션 렌더. 세 목록이 모두 비어 있고 supabase가 있으면 "아직 등록된 대회가 없습니다" 빈 상태 표시.
- **연동 API/테이블**: Supabase 직접 접근 — `tournaments`, `main_questions`(SELECT).
- **주요 컴포넌트**: `components/tournament/TournamentCard`, `components/MainQnaSection`.
- **주의사항**: `createClientSafe()`가 `null`을 반환할 수 있으므로(Supabase 미설정) 모든 조회 전에 `if (supabase)` 가드가 필요. Q&A 섹션도 `supabase`가 있을 때만 렌더. 하드코딩 색상(`border-white/10` 등)이 일부 남아 있어 테마 토큰 전환 대상.

---

## PUB-02 대회 목록

| 항목 | 내용 |
|------|------|
| 경로 | /tournaments |
| 파일 | app/(public)/tournaments/page.tsx |
| 유형 | 서버 컴포넌트 (async) |
| 접근권한 | 비인증 공개 |

- **주요 기능**: 전체 대회를 상태·연도 필터 및 이름 검색으로 조회하는 카드 목록.
- **입력 항목**:
  - `searchParams.status`(문자열, 선택): `all | registration | in_progress | completed | draft` — 상태 필터.
  - `searchParams.year`(문자열, 선택): 시작일 연도 필터(2026년부터 현재 연도까지).
  - `searchParams.q`(문자열, 선택): 대회명 부분 일치 검색(`ilike`).
- **처리 흐름**: `searchParams`(Promise) await → `tournaments` 쿼리 빌드(start_date 내림차순, created_at 내림차순, limit 50) → status/year/q 조건 적용 → 카드 그리드 렌더. 결과 0건이면 "검색 결과가 없습니다".
- **연동 API/테이블**: Supabase 직접 접근 — `tournaments`(SELECT id, name, venue, start_date, end_date, status).
- **주요 컴포넌트**: `components/tournament/TournamentCard`, `components/tournament/TournamentSearchForm`(검색 입력 클라이언트 폼).
- **주의사항**: `createClientSafe()` null 가드 필요. 상태·연도·검색 필터 링크는 서로의 쿼리스트링을 유지하도록 조합됨. 필터 버튼에 활성 상태 강조(`bg-primary`/`bg-accent`).

---

## PUB-03 대회 상세

| 항목 | 내용 |
|------|------|
| 경로 | /tournaments/[id] |
| 파일 | app/(public)/tournaments/[id]/page.tsx |
| 유형 | 서버 컴포넌트 (async) |
| 접근권한 | 비인증 공개 |

- **주요 기능**: 대회 기본 정보(상태 배지, 기간, 장소, 접수기간, 대회요강), 단체전 부수의 참가 팀 현황(승인/대기), 부수별 대진 진입 링크, Q&A 섹션을 상태에 따라 순서·펼침을 조정해 표시. 접수 중이면 "참가 신청하기" CTA와 "내 신청 상태"를 노출.
- **입력 항목**: `params.id`(대회 UUID, 필수). 폼 입력 없음.
- **처리 흐름**: `params` await → `Promise.all`로 tournament(단일, admin 이름 join) / divisions(display_order) / tournament_questions(`is_public=true`) 조회. tournament 없으면 `notFound()`. 단체전 부수가 있으면 `teams`(+team_members) 추가 조회 후 승인/대기 팀 분리·팀원 정렬. 상태 플래그로 섹션 노출 제어: 요강·Q&A는 draft/registration에서 펼침, 참가 팀은 registration에서, 대진은 in_progress/completed에서 펼침. 진행중/종료 시 대진 섹션을 요강·팀 위로 재배치(`focusBracket`).
- **연동 API/테이블**: Supabase 직접 접근 — `tournaments`, `divisions`, `tournament_questions`, `teams`, `team_members`(SELECT).
- **주요 컴포넌트**: `components/tournament/QnaSection`(클라이언트), `components/tournament/MyRegistrationStatus`(클라이언트, localStorage 기반).
- **주의사항**: `createClientSafe()` null이면 `notFound()`. 팀원은 `player_order`로 정렬. 승인 팀 수가 `max_teams` 도달 시 "마감" 배지. `overflow-hidden` 카드 안 flex 항목은 `min-w-0`/`flex-1`로 잘림 방지 처리됨.

---

## PUB-04 부수 상세 (대진/순위 실시간)

| 항목 | 내용 |
|------|------|
| 경로 | /tournaments/[id]/divisions/[divId] |
| 파일 | app/(public)/tournaments/[id]/divisions/[divId]/page.tsx |
| 유형 | 서버 컴포넌트 (async) + 실시간 클라이언트 자식 |
| 접근권한 | 비인증 공개 |

- **주요 기능**: 특정 부수의 참가자(선수/팀) 목록, 단계(예선/본선) 요약, 예선 조 매트릭스·순위표, 본선 브라켓을 표시하며 Supabase Realtime으로 경기·순위 변동을 실시간 반영.
- **입력 항목**: `params.id`(대회 UUID), `params.divId`(부수 UUID) — 둘 다 필수. 폼 입력 없음.
- **처리 흐름**: `params` await → `Promise.all`로 division(단일) / tournament(name,status) / tournament_phases / players / teams(+members) 조회. division·tournament 없으면 `notFound()`. `match_type`으로 개인전/단체전 참가자 결정. phases에서 `preliminary`/`main` 추출 → groups / prelimMatches / mainMatches(`MATCH_SELECT`) 병렬 조회 → group들의 standings 조회 → 초기 데이터를 `DivisionRealtimeContent`에 전달해 클라이언트에서 실시간 구독.
- **연동 API/테이블**: Supabase 직접 접근 — `divisions`, `tournaments`, `tournament_phases`, `players`, `teams`, `team_members`, `groups`, `matches`(`lib/supabase/selects`의 `MATCH_SELECT`), `standings`.
- **주요 컴포넌트**: `components/tournament/DivisionRealtimeContent`(실시간 구독 래퍼) → 내부에서 `GroupMatrix`, `StandingsTable`, `BracketView` 활용.
- **주의사항**: `createClientSafe()` null이면 `notFound()`. 참가자 select를 id/name/club 등으로 좁혔으므로 Player/Team 전체 타입으로 캐스팅 시 주의(`as unknown as`). 참가자 패널은 `status==='registration'`일 때 기본 펼침.

---

## PUB-05 참가 신청

| 항목 | 내용 |
|------|------|
| 경로 | /tournaments/[id]/register |
| 파일 | app/(public)/tournaments/[id]/register/page.tsx |
| 유형 | 클라이언트 컴포넌트 |
| 접근권한 | 비인증 공개 (접수 중 대회만) |

- **주요 기능**: 개인전/단체전 부수를 선택해 온라인 참가 신청(미승인 상태로 접수). 성공 시 신청 ID를 localStorage에 저장하고 완료 화면 표시.
- **입력 항목**:
  - 신청 부수(select, 필수) — 부수 선택에 따라 개인/단체 폼 분기.
  - 공통: 연락처(tel, 선택, 자동 포맷 `010-0000-0000`, 정규식 검증), 이메일(email, 선택).
  - 개인전: 이름(필수), 소속(선택).
  - 단체전: 팀명(필수), 소속/클럽(선택), 참가 인원 수(min≠max일 때 버튼 선택), 선수 명단(이름 + 부수(number 1~99), 최소 `TEAM_SIZE[format].min`명 필수).
- **처리 흐름**: mount 시 tournament·divisions 조회 → 대회가 `registration` 상태 아니면 상세로 `router.replace`. 제출 시 연락처 형식 검증 → (단체) 팀명 중복 확인 후 `teams` insert → `team_members` insert / (개인) 이름+연락처 중복 확인 후 `players` insert. 성공 시 `addMyRegistration()`로 localStorage 기록 후 완료 화면(추가 접수/돌아가기). 실패는 `toast.error`.
- **연동 API/테이블**: Supabase 직접 접근 — `tournaments`, `divisions`(SELECT), `teams`, `team_members`, `players`(SELECT 중복확인 + INSERT). `confirmed=false`로 삽입(RLS 비인증 INSERT 허용).
- **주요 컴포넌트**: shadcn 기본 인풋(직접 마크업), `lib/utils/myRegistrations`(addMyRegistration), sonner toast.
- **주의사항**: `useParams`/`useRouter` 사용(Next 16 클라이언트). 연락처 오류 시 제출 버튼 비활성. 단체전 팀원 부수 select/input은 좁은 화면 잘림 방지 위해 `flex-1`/고정폭 사용. 중복 신청(팀명 또는 이름+연락처)은 차단.

---

## PUB-06 내 신청정보 조회/수정

| 항목 | 내용 |
|------|------|
| 경로 | /tournaments/[id]/my-registration |
| 파일 | app/(public)/tournaments/[id]/my-registration/page.tsx |
| 유형 | 클라이언트 컴포넌트 (Suspense 래핑) |
| 접근권한 | 비인증 공개 (미승인 신청 & localStorage 소유 검증) |

- **주요 기능**: localStorage에 저장된 본인 신청(개인/팀)을 불러와 이름·소속·연락처·이메일·부수·팀원을 수정. 승인 완료된 신청은 수정 불가 안내.
- **입력 항목**:
  - `searchParams.regId`(신청 UUID, 필수), `searchParams.type`(`player | team`, 기본 player).
  - 개인전: 신청 부수(select, 부수 2개 이상일 때), 이름(필수), 소속(선택), 연락처(선택·포맷/검증), 이메일(선택).
  - 단체전: 신청 부수(select), 팀명(필수), 소속/클럽(선택), 참가 인원 수(min≠max일 때), 선수 명단(최소 인원 검증), 이메일(선택).
- **처리 흐름**: mount 시 `regId` 없으면 notFound 상태. `getMyRegistrationsByTournament(id)`로 localStorage 소유 검증(없으면 notFound). `loadData()`로 divisions + 대상 레코드 조회 → `confirmed===true`면 `alreadyApproved` 화면. 저장 시 개인은 `players` update, 팀은 `teams` update 후 `team_members` 전체 삭제→재삽입. 성공 시 toast + 대회 상세로 `router.push`.
- **연동 API/테이블**: Supabase 직접 접근 — `divisions`, `players`(SELECT/UPDATE), `teams`(SELECT/UPDATE, division join), `team_members`(SELECT/DELETE/INSERT). RLS: `confirmed=false` 레코드만 공개 UPDATE/DELETE 허용.
- **주요 컴포넌트**: 직접 마크업 폼, `lib/utils/myRegistrations`(getMyRegistrationsByTournament), sonner toast.
- **주의사항**: `useSearchParams()` 사용으로 반드시 `<Suspense>` 래핑(파일 하단 `MyRegistrationPage`가 감쌈). 소유 검증은 localStorage 기반이며 실제 권한은 UUID+RLS로 보장. 승인 후 수정 차단.

---

## PUB-07 선수 랭킹

| 항목 | 내용 |
|------|------|
| 경로 | /rankings |
| 파일 | app/(public)/rankings/page.tsx |
| 유형 | 서버 컴포넌트 (async, revalidate 60초) |
| 접근권한 | 비인증 공개 |

- **주요 기능**: 대회 경기(개인/단체) 및 숏게임 결과를 합산해 라운드·단계별 가중치로 개인 포인트 순위를 산출·표시. 선수명/소속 검색 지원. 포인트 부여 기준 안내 및 승/전·내역(대회/예선/숏게임) breakdown 노출.
- **입력 항목**: `searchParams.q`(문자열, 선택) — 선수명 또는 소속 부분 일치 필터.
- **처리 흐름**: `searchParams` await → 완료된 개인전 매치, 단체전 매치, 전체 casual_games 병렬 조회 → 참가자 id로 players/teams(+members) 조회 → `getMatchRatingPoints()`(단계·포맷·라운드·총라운드·승패)로 매치별 포인트 계산, 단체전은 팀원 전원에 동일 부여, 숏게임 승리는 +10 → 이름|소속 키로 누적 집계 → 포인트·승수 내림차순 정렬 → (검색 시) 필터 → 순위 렌더(1~3위 메달). 60초 ISR.
- **연동 API/테이블**: Supabase 직접 접근 — `matches`(+tournament_phases join), `players`, `teams`(+team_members), `casual_games`(SELECT). `lib/utils/rating`의 `getMatchRatingPoints`.
- **주요 컴포넌트**: `components/tournament/RankingsSearchForm`(검색 클라이언트 폼).
- **주의사항**: `createClientSafe()` null 가드. 동점(무승부) 숏게임은 집계 제외. 패배는 포인트 차감 없음. 이름+소속 동일인 기준으로 병합되므로 동명이인/소속 누락 시 합산 주의. `export const revalidate = 60`.

---

## PUB-08 선수 전적 조회

| 항목 | 내용 |
|------|------|
| 경로 | /players |
| 파일 | app/(public)/players/page.tsx |
| 유형 | 클라이언트 컴포넌트 |
| 접근권한 | 비인증 공개 |

- **주요 기능**: 선수명을 검색해 상대별(H2H) 전적, 승/패/승률 요약, 전체 경기 이력을 조회. 대회등록/숏게임 포함 여부 토글, "내가 등록한 숏게임만" 필터. 로그인 사용자는 프로필 이름으로 자동 조회.
- **입력 항목**:
  - 선수명 검색어(text, Enter 또는 검색 버튼).
  - 필터 토글: 대회등록 포함(기본 on), 숏게임 포함(기본 on), 내가 등록한 숏게임만(off).
- **처리 흐름**: 검색 시 `/api/players/search?name=` 호출 → 동명 그룹의 모든 player_ids 수집 → `/api/players/records`(ids/name/club/include_tournament/include_casual/casual_game_ids 파라미터)로 전적 조회 → H2H·경기이력 렌더. 토글 변경 시 마지막 검색 상태로 재조회. mount 시 로그인 사용자면 `user_profiles.name`으로 자동 검색. "내 숏게임만"은 `getMyGameIds()`(localStorage)를 `casual_game_ids`로 전달하며 대회는 제외.
- **연동 API/테이블**: `/api/players/search`(GET), `/api/players/records`(GET). mount 자동조회용 Supabase 직접 접근 — `user_profiles`(SELECT name). `lib/utils/myGames`(getMyGameIds).
- **주요 컴포넌트**: `components/ui/button`(Button), lucide 아이콘. H2H 아코디언은 로컬 상태로 펼침 제어.
- **주의사항**: "내가 등록한 숏게임만" 활성 시 대회등록/숏게임 토글은 비활성(`opacity-30 pointer-events-none`). `useEffect` 자동조회 실패는 무시. 로딩은 검색·전적 조회 상태 OR.

---

## PUB-09 일회성(캐주얼) 게임 등록 — 숏게임

| 항목 | 내용 |
|------|------|
| 경로 | /games/new |
| 파일 | app/(public)/games/new/page.tsx |
| 유형 | 클라이언트 컴포넌트 |
| 접근권한 | 비인증 공개 |

- **주요 기능**: 로그인 없이 1:1 단식 경기 결과를 약식(최종 세트 점수) 또는 세트별 모드로 등록. 성공 시 게임 ID를 localStorage에 저장하고 완료 화면 + 내가 등록한 기록 목록 표시.
- **입력 항목**:
  - 선수 정보: 선수1 이름(필수)·소속(선택), 선수2 이름(필수)·소속(선택).
  - 모드 탭: 약식 등록 / 세트별 등록.
  - 약식: 선수1 세트 점수·선수2 세트 점수(number, 필수, 음수/0:0 불가).
  - 세트별: 세트 수(3/5/7), 세트당 점수(11/21), 세트별 점수 입력(가감 가능, 최소 1세트 유효값 필요) — 세트 승수는 자동 계산.
  - 기타: 경기 날짜(기본 오늘), 장소(선택), 메모(선택).
- **처리 흐름**: 제출 시 이름 검증 → 모드별 payload 구성(약식은 score1/score2 직접, 세트별은 유효 세트로 `computeDetailScores` 승수 계산) → `POST /api/games` → 성공 시 `addMyGame(data.id)`로 localStorage 기록, 완료 화면(더 등록/전적 조회) 표시. 실패는 화면 내 에러 메시지.
- **연동 API/테이블**: `/api/games`(POST, 비인증 허용) → `casual_games` 테이블. `lib/utils/myGames`(addMyGame).
- **주요 컴포넌트**: `components/ui/button`, `components/ui/input`, `components/ui/label`, `components/tournament/MyGameHistory`(refreshKey로 갱신).
- **주의사항**: 세트 수 변경 시 세트 배열 초기화. 세트별 모드에서 최소 1세트 유효 점수 필요. 완료 화면과 폼 하단 모두 `MyGameHistory`를 노출하며 등록 후 `refreshKey` 증가로 재조회.
