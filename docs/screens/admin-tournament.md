# 화면 요구사항정의서 — 관리자 대회운영

포함 화면: **ADM-T01** 대회 등록 · **ADM-T02** 대회 정보 수정/부수관리/삭제 · **ADM-T03** 선수/팀 관리 · **ADM-T04** 대진표 생성 · **ADM-T05** 경기 결과 입력 · **ADM-T06** 참가 접수 관리

> 이 문서는 화면(UI) 관점의 요구사항만 다룹니다. 대진표 생성·점수 진출 등 비즈니스 로직 상세는 [docs/features/draw-scores.md](../features/draw-scores.md)를 참고하세요.

---

## ADM-T01 대회 등록

| 항목 | 내용 |
|------|------|
| 경로 | /admin/tournaments/new |
| 파일 | app/admin/tournaments/new/page.tsx |
| 유형 | 클라이언트 컴포넌트 |
| 접근권한 | 관리자(admin 레이아웃 인증) |

- **주요 기능**: 대회 기본 정보와 부수(division) 목록을 한 화면에서 입력해 대회를 신규 생성. 저장 시 대회 → 각 부수 → 부수별 단계(`tournament_phases`)를 순차 생성하고 편집 화면으로 이동.
- **입력 항목**:
  - 대회 기본: `name`(대회명, 필수) · `venue`(장소, 필수) · `start_date`/`end_date`(시작·종료일, date, 필수) · `registration_start`/`registration_end`(접수 시작·마감, date, 선택) · `status`(상태 select: draft/registration/in_progress/completed, 기본 draft) · `description`(대회 소개, textarea) · `regulations`(대회요강, textarea)
  - 부수 배열(최소 1개, 부수 추가/삭제 버튼): `name`(부수명, 기본 '1부') · `gender`(male/female/mixed) · `match_type`(individual/team) · 개인전이면 `games_per_match`(3/5/7판) select, 단체전이면 `team_match_format`(6종 select) — 방식 선택 시 `games_per_match` 자동 설정(olympic=5, swaythling=9 등) · `has_preliminary`(예선전 있음 체크박스) · 예선 체크 시 `prelim_format`(round_robin/group_knockout) + `advancement_count`(조당 진출 수 number, 1~8)
- **처리 흐름**: 제출 → 부수 0개면 토스트 에러 → `tournaments` insert(`created_by`/`admin_id` = 현재 user) → 각 부수 `divisions` insert(display_order=index) → 예선 체크 시 preliminary phase insert(points_per_game 고정 11), main phase insert(phase_order는 예선 유무에 따라 1 또는 2) → 성공 토스트 후 `/admin/tournaments/[id]/edit`로 이동.
- **연동 API/테이블**: Supabase 직접 접근 — `tournaments`(insert), `divisions`(insert), `tournament_phases`(insert). 별도 `/api` 라우트 미사용.
- **주요 컴포넌트**: lucide 아이콘(Plus/Trash2/ChevronLeft), sonner 토스트. 별도 공용 컴포넌트 없이 인라인 폼.
- **주의사항**: 단체전 부수에서 `team_match_format` 미선택 시 null로 저장됨(단계 방식이 비어 있을 수 있음). `match_type`을 individual로 되돌리면 team_match_format이 초기화되고 games_per_match=3으로 재설정. `points_per_game`은 11로 하드코딩(등록 화면에서 조정 불가, 이후 edit 화면에서 변경). 스타일에 하드코딩 `border-white/10` 사용 중(테마 토큰 규칙과 상충하는 레거시).

---

## ADM-T02 대회 정보 수정 / 부수 관리 / 삭제

| 항목 | 내용 |
|------|------|
| 경로 | /admin/tournaments/[id]/edit |
| 파일 | app/admin/tournaments/[id]/edit/page.tsx |
| 유형 | 클라이언트 컴포넌트 (params: `use(params)`) |
| 접근권한 | 대회 관리 권한자(is_tournament_admin). 위임/삭제 등 일부 액션은 created_by 또는 system_admin 한정 |

- **주요 기능**: 대회 운영의 허브 화면. (1) 하위 운영 화면으로 가는 퀵액션 카드, (2) 대회 정보 수정, (3) 관리자 위임 + 공동 관리자 관리, (4) 부수 CRUD + 부수별 단계(예선/본선) 설정, (5) 대회 삭제(위험 구역).
- **입력 항목**:
  - 대회 정보 수정 폼: name(필수), venue(필수), start_date/end_date(필수), registration_start/registration_end, status(select), description, regulations.
  - 부수 추가/수정 폼: name(필수), gender, match_type, 단체전이면 team_match_format(6종) + max_teams(최대 참가팀, number, 빈값=제한 없음).
  - 단계 설정(부수별 ⚙): `hasPrelim`(예선 사용 체크) · 예선 `format`(round_robin/group_knockout)·`games_per_match`·`points_per_game`·`advancement_count`·`ranking_method`(승수 우선/세트 득실 우선) · 예선 단체전이면 team_match_format · 본선 `format`(single_elimination/double_elimination/round_robin)·games_per_match·points_per_game · 본선 단체전이면 team_match_format.
  - 관리자 위임: 이름/이메일 검색 입력. 공동 관리자: 이름/이메일 검색 입력.
- **처리 흐름**:
  - 대회 저장 → `PATCH /api/tournaments/[id]` (form 전체) → 응답으로 상태 갱신 + 토스트.
  - 부수 추가 → `POST /api/divisions`, 수정 → `PATCH /api/divisions/[id]`, 삭제 → `DELETE /api/divisions/[id]`(경기 생성 시 삭제 불가, 서버 에러 메시지 토스트).
  - 단계 저장 `savePhases()`는 Supabase 직접 접근 — 예선/본선 phase upsert(존재 시 update, 없으면 insert), 예선 해제 시 기존 예선 phase delete.
  - 관리자 위임 `handleSaveDelegate()` → `PATCH /api/tournaments/[id]` body `{admin_id}`. "권한 회수"는 admin_id를 현재 사용자로 되돌림.
  - 공동 관리자 추가 → `POST /api/tournaments/[id]/admins {userId}`, 제거 → `DELETE /api/tournaments/[id]/admins/[userId]`. 검색은 `GET /api/admin/users/search?q=`.
  - 대회 삭제 → 확인 UI 노출 후 `DELETE /api/tournaments/[id]` → `/admin`으로 이동.
- **연동 API/테이블**: `/api/tournaments/[id]`(PATCH/DELETE), `/api/divisions`(POST), `/api/divisions/[id]`(PATCH/DELETE), `/api/tournaments/[id]/admins`(GET/POST), `/api/tournaments/[id]/admins/[userId]`(DELETE), `/api/admin/users/search`(GET). 직접 Supabase: `tournaments`/`divisions`(초기 로드), `user_profiles`(역할·위임 프로필), `tournament_phases`(단계 저장).
- **주요 컴포넌트**: `components/ui/help-popover`(HelpPopover — 부수/순위기준 도움말), lucide 아이콘, sonner.
- **주의사항**: 퀵액션 카드 링크 5개 = 선수 관리/접수 관리/대진표 생성/결과 입력/Q&A 관리. 위임/공동관리자 섹션은 `isSystemAdmin || created_by===me || admin_id===me`일 때만 렌더, 그중 대표 관리자 변경(위임)은 created_by 또는 system_admin만 가능. admin_id가 created_by와 다를 때만 위임 프로필을 별도 로드해 표시. 검색 드롭다운은 onBlur setTimeout(150ms)으로 닫아 클릭 처리 보장. 부수 삭제는 하위 경기가 있으면 FK로 실패 → 서버가 에러 반환. 파일 곳곳에 레거시 `border-white/10`/`bg-white/5` 하드코딩 존재.

---

## ADM-T03 선수 / 팀 관리

| 항목 | 내용 |
|------|------|
| 경로 | /admin/tournaments/[id]/players (`?divId=` 진입 지원) |
| 파일 | app/admin/tournaments/[id]/players/page.tsx |
| 유형 | 클라이언트 컴포넌트 (useParams / useSearchParams) |
| 접근권한 | 대회 관리 권한자(is_tournament_admin) |

- **주요 기능**: 부수 탭을 선택해 개인전이면 `IndividualSection`, 단체전이면 `TeamSection`을 렌더. 참가자 목록·추가·수정·삭제·승인·시드 지정, 다른 부수로 이동, (개인전) 일괄 등록을 제공.
- **입력 항목**:
  - 개인전 추가: name(선수명, 필수) + club(소속, 선택). 수정: name·club·division(같은 개인전 부수 이동 select)·memo(관리자 메모). 시드: number(onBlur 저장). 일괄 등록: `이름,소속` 줄 단위 textarea(중복 이름 자동 감지·제외 미리보기).
  - 단체전 추가: name(팀명, 필수)·club(소속)·선수 명단(이름 + level 부수, `TEAM_SIZE`의 min~max 강제). 수정: 위 + division(같은 단체전 부수 이동 select)·memo. 시드 number.
- **처리 흐름**: 부수 목록 로드 후 `divId`(쿼리) 또는 첫 부수 자동 선택. 개인 추가/수정/삭제/승인/시드/일괄등록은 `players` 직접 CRUD; 팀은 `teams` + `team_members` CRUD(수정 시 팀원 전체 삭제 후 재삽입). 부수 이동 시 목록에서 제거하고 "다른 부수로 이동" 토스트. 관리자 추가 선수는 `confirmed: true`로 즉시 확정. 낙관적 상태 갱신 + sonner 토스트.
- **연동 API/테이블**: Supabase 직접 — `divisions`(부수 탭), `players`(개인전 CRUD), `teams`(단체전) + `team_members`(팀원). `/api` 라우트 미사용.
- **주요 컴포넌트**: 파일 내부 `IndividualSection`/`TeamSection` 분리. lucide 아이콘(Pencil/Check/X/Clock/StickyNote/Users 등), sonner.
- **주의사항**: **[알려진 버그 이력]** 좁은 모바일에서 팀 카드(`overflow-hidden`) 안 flex 행의 부수 select/선수 이름 input이 잘려 보이지 않던 문제 → `flex-1` 요소에 `min-w-0` 명시로 해결(수정/추가 폼 모두 min-w-0 적용됨). 팀원 수는 `team_match_format`의 min/max로 추가/삭제 버튼 활성 제어(min 미만 삭제 불가, max 초과 추가 불가). `memo`는 관리자 전용(참가자 비노출). 팀원 수정은 전량 재삽입 방식이라 순서(player_order) 재계산됨.

---

## ADM-T04 대진표 생성

| 항목 | 내용 |
|------|------|
| 경로 | /admin/tournaments/[id]/draw |
| 파일 | app/admin/tournaments/[id]/draw/page.tsx |
| 유형 | 클라이언트 컴포넌트 (useParams) |
| 접근권한 | 대회 관리 권한자(is_tournament_admin) |

- **주요 기능**: 부수를 선택해 대진표를 생성/재생성. 예선이 있으면 조 수·조당 진출 수를 정하고 조 편성/본선 규모를 미리보기; 예선이 없으면 바로 시드 토너먼트 생성. (생성/진출 알고리즘 상세는 draw-scores.md 참고.)
- **입력 항목**: 부수 탭 선택. 예선 있는 부수: `groupCount`(조 수, 2/3/4/6/8 버튼) · `advanceCount`(조당 진출 수, 1~7 버튼). 확정 관련 폼 입력 없음(버튼 기반).
- **처리 흐름**: 부수 선택 시 승인된(`confirmed=true`) 선수/팀과 phases 로드. 조 편성 미리보기는 `distributeIntoGroups`로 조별 인원·진출 수·본선 규모(2의 거듭제곱)·부전승 수를 계산해 색상 카드로 표시. "대진표 생성" 클릭 → 완료된 경기 존재 시 재생성 확인 → 기존 groups/matches 삭제 후 재생성(예선: 원형법 조 + 본선 TBD 라운드 / 예선 없음: 시드 브라켓 + 부전승 자동 진출) → 성공 토스트, "공개 페이지에서 확인" 링크 노출.
- **연동 API/테이블**: Supabase 직접 — `divisions`, `players`/`teams`(confirmed), `tournament_phases`, `groups`(insert/delete), `matches`(insert/delete/update). 유틸 `lib/utils/roundrobin.ts`, `lib/utils/bracket.ts`.
- **주요 컴포넌트**: lucide(Shuffle/CheckCircle/AlertCircle/Info), `cn` 유틸, sonner.
- **주의사항**: 참가자 2 미만이면 생성 불가. 빈 조(조 수 > 참가자) 또는 1인 조가 생기면 `hasBlockingError`로 버튼 비활성 + 경고 표시. 재생성 시 참가자 `group_id`를 먼저 null로 초기화해야 FK 때문에 조 삭제가 막히지 않음(주석 명시). 완료 결과가 있으면 확인창으로 덮어쓰기 경고. 상세 배정 로직은 화면 범위 밖 → draw-scores.md.

---

## ADM-T05 경기 결과 입력

| 항목 | 내용 |
|------|------|
| 경로 | /admin/tournaments/[id]/scores |
| 파일 | app/admin/tournaments/[id]/scores/page.tsx |
| 유형 | 클라이언트 컴포넌트 (useParams) |
| 접근권한 | 대회 관리 권한자(is_tournament_admin) |

- **주요 기능**: 부수·단계(예선/본선) 탭을 선택해 경기 결과를 입력. 예선은 조별 경기 입력 + 순위표/상대전적 매트릭스 + 동률 시 수동 순위 확정 및 본선 진출 처리, 본선은 라운드별 브라켓 경기 입력 + 승자 자동 진출. 개인전 선수 이름 인라인 수정도 제공. (진출/부전승/동률 처리 상세는 draw-scores.md 참고.)
- **입력 항목**:
  - 개인전 경기: 세트별 점수 입력(phase.games_per_match 개수만큼, score1/score2 number).
  - 단체전 경기: 방식별 개인경기(단식/복식) 목록에서 승자 토글(팀1승=1:0, 팀2승=0:1, 재클릭 해제).
  - 개인전 선수 이름 수정: name·club.
  - 예선 동률 시 수동 순위: tie-break 순서 조정 UI.
- **처리 흐름**: 부수 선택 → phases/participants/groups/matches/match_sets/standings 로드. 저장 `saveScore()` → 승리 세트 수로 finalScore·winner 계산 → `match_sets` 전량 삭제 후 재삽입, `matches` update(score/winner/status='completed'/ended_at) → 본선이면 승자를 다음 라운드 슬롯에 자동 배치. 예선 조 전 경기 완료 & 경계 동률 없으면 "순위 확정 및 본선 진출 처리" 버튼으로 standings 저장 + 본선 1라운드 슬롯 배정; 동률이면 경고 + 수동 순위 조정 요구. `loadData` 시 본선 부전승(구조적/직접) 전파 재확인.
- **연동 API/테이블**: Supabase 직접 — `divisions`, `tournament_phases`, `players`/`teams`(+team_members level), `groups`, `matches`, `match_sets`, `standings`. 유틸 `lib/utils/standings.ts`(calculateStandings/getTieGroups/hasTieAtBoundary), `lib/utils/bracket.ts`(getRoundName/getPrelimSlotPlacements), `lib/utils/team.ts`(formatTeamLevelSum).
- **주요 컴포넌트**: `components/tournament/GroupMatrix`(상대 전적 매트릭스, 토글). lucide, `cn`, sonner.
- **주의사항**: `confirmedGroupIdsRef`로 확정 조를 추적해 동률 감지 useEffect의 경쟁 조건을 방지. 구조적 부전승은 진출 총원이 2의 거듭제곱이 아닐 때만, 그리고 모든 예선 조가 진출 완료됐을 때만 처리(빈 슬롯 오배정 방지). 예상 진출 라벨(`getProjectedLabel`)과 실제 배정은 동일한 `getPrelimSlotPlacements` 매핑을 써야 일치. 세부 알고리즘은 화면 범위 밖 → draw-scores.md.

---

## ADM-T06 참가 접수 관리

| 항목 | 내용 |
|------|------|
| 경로 | /admin/tournaments/[id]/registrations |
| 파일 | app/admin/tournaments/[id]/registrations/page.tsx |
| 유형 | 클라이언트 컴포넌트 (`use(params)`) |
| 접근권한 | 대회 관리 권한자(is_tournament_admin) |

- **주요 기능**: 온라인으로 접수된 미승인(`confirmed=false`) 선수·팀을 부수 탭별로 검토해 승인/거절, 승인 완료 목록에서 승인 취소. 단체전은 신청 시간순 대기열과 최대 참가팀(`max_teams`) 슬롯을 관리.
- **입력 항목**: 부수 필터 탭(전체/부수별). 폼 입력 없음 — 승인/거절/일괄승인/시간순승인/승인취소 버튼 조작.
- **처리 흐름**: 로드 시 개인전 부수는 `players`, 단체전 부수는 `teams(+members)`를 미승인/승인으로 각각 조회하고 부수별 승인 팀 수를 집계. 개인전: 개별 승인(`confirmed=true`)·거절(delete)·전체 승인. 단체전: 개별 승인(슬롯 초과 시 차단)·거절·"시간순 승인"(빈 슬롯만큼 created_at 오름차순 승인). 승인/거절 성공 시 이메일 알림 `POST /api/notify`(type approved/rejected, email 있을 때만). 승인 취소는 `confirmed=false`로 되돌려 미승인 목록으로 이동(신청자 재수정 가능해짐). 낙관적 상태 갱신 + 토스트.
- **연동 API/테이블**: Supabase 직접 — `divisions`, `tournaments`(name), `players`, `teams`(+`team_members`). API: `/api/notify`(승인/거절 이메일, fire-and-forget).
- **주요 컴포넌트**: lucide(Check/Trash2/CheckCheck/Users/Clock/ShieldCheck/RotateCcw/ChevronDown), sonner. 승인 완료 목록은 `<details>` 접이식.
- **주의사항**: 단체전은 `max_teams` 초과 승인 차단(승인 버튼 disabled + 토스트). 시간순 승인은 이미 created_at 오름차순으로 정렬된 대기열을 슬롯 수만큼 slice. 이메일이 없는 신청은 알림 skip. 거절은 hard delete(복구 불가) → confirm 필수. 승인 취소 시 부수별 승인 카운트 감소 반영.
