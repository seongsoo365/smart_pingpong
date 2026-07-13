# 기능 정의서 — 대진표 · 점수 (백엔드)

> 대회 운영의 핵심 로직. 대진표 생성과 점수 입력·진출 처리는 **API 라우트가 아니라 admin 페이지(클라이언트 컴포넌트)** 안에서 Supabase 클라이언트로 직접 수행되며, 순수 계산은 `lib/utils`의 함수(`bracket.ts`, `roundrobin.ts`, `standings.ts`)에 위임한다.
>
> 포함 기능ID: **FEAT-DRW-01**(대진표 생성) · **FEAT-DRW-02**(점수 입력/승자 진출) · **FEAT-DRW-03**(예선 진출 처리) · **FEAT-DRW-04**(동점 수동 순위확정) · **FEAT-DRW-05**(브라켓/리그/순위 유틸)

---

## FEAT-DRW-01 대진표 생성

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `app/admin/tournaments/[id]/draw/page.tsx` — `generateDraw()` (클라이언트 함수) |
| 관련 함수 | `distributeIntoGroups()`, `generateRoundRobin()` (`lib/utils/roundrobin.ts`), `generateSeededBracket()`, `getBracketRounds()`, `nextPowerOfTwo()` (`lib/utils/bracket.ts`) |
| 권한 | 대회 관리 권한자 (RLS `is_tournament_admin()`); 화면 접근은 `app/admin/layout.tsx`에서 인증 리다이렉트 |

- **역할**: 선택한 부수(division)의 확정 참가자(개인 `players` 또는 단체 `teams`, `confirmed = true`)로 예선 조 + 본선 브라켓을 한 번에 생성한다. 예선 유무는 해당 부수의 `tournament_phases` 존재 여부로 분기한다.
- **입력**:
  - `selectedDivId` — 부수 선택(탭). `division.match_type`으로 개인전/단체전 판별.
  - `groupCount` — 조 수 (버튼 선택: 2, 3, 4, 6, 8). 예선이 있을 때만 사용.
  - `advanceCount` — 조당 본선 진출 수 (버튼 선택: 1~7). 초기값은 `preliminary.advancement_count`.
  - 참가자 목록: `confirmed = true`, `seed` 오름차순(`nullsFirst: false`)으로 로드.
- **출력 / 부수효과** (모두 Supabase 쓰기):
  - 재생성 시 기존 데이터 삭제: 먼저 `players/teams.group_id`를 `null`로 초기화(그룹 삭제 FK 제약 회피) → 예선 조 소속 `matches`를 `group_id in (...)`로 일괄 삭제 → `groups` 삭제 → 본선 `matches`를 `phase_id`로 삭제.
  - `groups` batch insert (`name = "A조/B조…"`, `display_order = 조 인덱스`), 빈 조는 제외.
  - 예선 리그 `matches` insert (`participant1_type`, `round`, `match_number`, `status: 'pending'`), 참가자 `group_id` 갱신(조 단위 병렬).
  - 본선 `matches` 전체 라운드를 빈(TBD) 슬롯으로 미리 batch insert.
  - `advanceCount` 변경 시 `tournament_phases.advancement_count` 갱신.
- **비즈니스 규칙**:
  - **예선 있는 경우**:
    1. `distributeIntoGroups(participants, groupCount)` — 뱀 시드(snake seeding)로 참가자를 조에 분배.
    2. 조마다 `generateRoundRobin(ids)` — 원형법(circle method) 리그 일정 생성, `round`/`match_number` 순번 부여.
    3. 본선은 `totalAdvancing = groupCount * advanceCount`, `mainSlots = nextPowerOfTwo(totalAdvancing)`, `mainTotalRounds = getBracketRounds(totalAdvancing)`. 라운드별 경기 수 = `mainSlots / 2^round`. 참가자 없이 TBD 슬롯으로만 생성(진출은 점수 입력 단계에서 채움 — FEAT-DRW-03).
  - **예선 없는 경우 (바로 본선)**:
    1. 참가자를 `seed`(없으면 9999) 오름차순 정렬 → id 배열.
    2. `generateSeededBracket(ids)` → 1라운드 대진 `[p1|null, p2|null][]` (표준 시드 배치, null = 부전승).
    3. 전체 라운드 batch insert. 1라운드는 참가자 배정, 부전승(`p1 && !p2`)이면 `status: 'bye'` + `winner_id = p1` 즉시 설정.
    4. 부전승 승자를 2라운드 슬롯에 즉시 채움: `nextMatchNum = ceil(matchNum/2)`, `matchNum` 홀수면 p1 슬롯 / 짝수면 p2 슬롯.
- **관련 테이블**: 읽기 `divisions`, `players`/`teams`, `tournament_phases`. 쓰기 `groups`, `matches`, `players`/`teams`(group_id), `tournament_phases`(advancement_count).
- **주의사항**:
  - 완료된(`status: 'completed'`) 본선 경기가 있으면 재생성 전 `confirm()`으로 경고(모든 결과 삭제됨).
  - 참가자 2 미만이면 차단. 예선에서 **빈 조**(참가자 0) 또는 **1인 조**(리그 편성 불가)가 생기면 생성 버튼 비활성화(`hasBlockingError`).
  - `totalAdvancing`이 2의 거듭제곱이 아니면 본선 1라운드에 부전승(빈 슬롯)이 `mainSlots - totalAdvancing`개 생김 — 안내만 표시하며 진행에는 문제없음.
  - 삭제 순서(참가자 group_id 초기화 → matches → groups)를 지켜야 `teams/players.group_id → groups(id)` FK 위반이 발생하지 않는다.

---

## FEAT-DRW-02 점수 입력 / 본선 승자 진출

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `app/admin/tournaments/[id]/scores/page.tsx` — `saveScore(match)` |
| 관련 함수 | `calculateStandings()` (`lib/utils/standings.ts`), `getRoundName()`·`getPrelimSlotPlacements()` (`lib/utils/bracket.ts`) |
| 권한 | 대회 관리 권한자 |

- **역할**: 개인전/단체전 경기의 세트별 점수를 입력·저장하고, 승자를 판정하며, 본선 경기면 승자를 다음 라운드 슬롯에 자동 진출시킨다.
- **입력**:
  - 개인전: 세트별 점수 `sets[{score1, score2}]` (세트 수 = `phase.games_per_match`, 기본 3). 세트 승수 `score1`/`score2`는 `s.score1 > s.score2`인 세트 수로 자동 집계.
  - 단체전: 개인경기별 승패(`sets[i]` = `{1,0}` 또는 `{0,1}`) 토글. 세트득실 우선(`ranking_method === 'setdiff_first'`)이면 실제 점수 입력. 경기 구성/개수는 `phase.team_match_format || division.team_match_format`을 `TEAM_MATCH_GAMES`/`TEAM_FORMAT_GAMES` 맵으로 조회(olympic·traditional_4s1d=5, swaythling=9, singles_2_doubles_1·three_doubles·three_singles=3).
- **출력 / 부수효과**:
  - `match_sets` 삭제 후 재insert(`score1 > 0 || score2 > 0`인 세트만).
  - `matches` 갱신: `score1`, `score2`, `winner_id`, `status: 'completed'`, `ended_at`.
  - 본선 승자 진출(아래 규칙). 예선이면 `checkPrelimAdvancement()` 호출(FEAT-DRW-03).
  - 완료 후 `loadData()` 재호출로 부전승 캐스케이드/화면 재계산.
- **비즈니스 규칙**:
  - **승자 판정**: 필요 승수 `needed = ceil(gamesPerMatch/2)`(단체전은 `ceil(totalGames/2)`). `score1 >= needed`면 참가자1, `score2 >= needed`면 참가자2, 아니면 `winner_id = null`(미결).
  - **본선 승자 진출**: `phase_type === 'main'` && `winner_id` 존재 시, 다음 라운드(`round + 1`) 경기들을 `match_number` 정렬 → `slot = floor((match_number - 1) / 2)`번째 경기가 대상 → 현재 `match_number`가 홀수면 p1 슬롯, 짝수면 p2 슬롯에 승자 기록.
  - 단체전 세트득실 우선 방식은 승부가 결정된 뒤에도 모든 게임을 입력해야 총 세트 득실을 계산할 수 있어 잠그지 않는다(그 외 방식은 `needed` 달성 후 나머지 게임 입력칸을 잠금 표시).
- **관련 테이블**: 읽기 `divisions`, `tournament_phases`, `players`/`teams`, `groups`, `matches`, `match_sets`, `standings`. 쓰기 `match_sets`, `matches`.
- **주의사항**:
  - `loadData()`는 매 로드마다 본선 부전승 전파를 재확인한다(아래 두 종류): ① 직접 브라켓 부전승(draw 시 `status: 'bye'` 설정) → 2라운드 슬롯 채움. ② 예선 경로 구조적 부전승(1라운드에 참가자 1명만 있는 경기) → **모든 예선 조가 진출 완료(`standings` 저장)했고 `totalAdvancing`이 2의 거듭제곱이 아닐 때만** `status: 'bye'`로 처리 후 다음 라운드 진출. 이 가드는 조 진출 저장과 `advanceGroup` 완료 사이의 경쟁 조건을 막기 위함.

---

## FEAT-DRW-03 예선 진출 처리

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `app/admin/tournaments/[id]/scores/page.tsx` — `checkPrelimAdvancement()` → `advanceGroup()` |
| 관련 함수 | `calculateStandings()`, `hasTieAtBoundary()` (`lib/utils/standings.ts`), `getPrelimSlotPlacements()` (`lib/utils/bracket.ts`) |
| 권한 | 대회 관리 권한자 |

- **역할**: 한 예선 조의 모든 경기가 완료되면 순위를 계산하고, 경계 동률이 없으면 순위를 확정 저장한 뒤 상위 진출자를 본선 1라운드의 정해진 슬롯에 배정한다.
- **입력**: `groupId`, `phase`(예선), 방금 저장된 경기의 승자·점수·세트. 조 진출 수 `advanceCount = phase.advancement_count ?? 2`, 순위 기준 `phase.ranking_method ?? 'wins_first'`.
- **출력 / 부수효과**:
  - `standings` upsert(`onConflict: 'group_id,participant_id'`) — `wins/losses/sets_won/sets_lost/points_won/points_lost/ranking`. 이 저장이 FEAT-DRW-02의 구조적 부전승 가드(`allPrelimGroupsAdvanced`) 기준점.
  - `advanceGroup()`이 본선 1라운드 `matches`의 슬롯을 채움(진출자별 병렬 update).
- **비즈니스 규칙**:
  - **완료 판정**: 방금 편집한 경기를 반영한 조 경기 전체가 `status === 'completed'`여야 진행. 아니면 즉시 return.
  - **순위 계산**: `calculateStandings(matches, ids, ranking_method, isTeam)`. 정렬 기준은 FEAT-DRW-05 참조(`wins_first` 또는 `setdiff_first`).
  - **동점 차단**: `hasTieAtBoundary(standings, advanceCount)`가 `true`(진출 경계 = advanceCount번째와 그 다음이 동일 tier)면 자동 진출을 중단하고 저장하지 않음 → 수동 순위 확정(FEAT-DRW-04) 유도.
  - **슬롯 배정** (`advanceGroup`): `getPrelimSlotPlacements(groupCount, advanceCount)`로 (조 인덱스, 순위) → 본선 1라운드 슬롯 매핑 배열을 얻고, 진출자 `i`(0-based)에 대해 `placement.group === groupIndex && placement.rank === i`인 슬롯 인덱스를 찾음. 대상 경기 = `mainMatches[floor(slotIndex/2)]`, `slotIndex` 짝수면 p1, 홀수면 p2. `groupIndex`는 예선 그룹을 `display_order` 오름차순 정렬한 위치.
- **관련 테이블**: 읽기 `matches`, `groups`, `tournament_phases`. 쓰기 `standings`, `matches`(본선 1라운드 슬롯).
- **주의사항**:
  - 실제 배정(`advanceGroup`)과 예상 라벨 표시(`getProjectedLabel` — 미배정 슬롯에 "A조 1위" 등 예고)가 **동일한 `getPrelimSlotPlacements`** 를 쓰므로 배정과 표시가 항상 일치. 반환 배열은 캐시되어 공유되므로 변형 금지(읽기 전용).
  - `placement`가 `null`인 슬롯은 매핑상 영구히 비는 슬롯 = 구조적 부전승. `getProjectedLabel`은 이를 "부전승"으로 표시.

---

## FEAT-DRW-04 동점 수동 순위 확정

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `app/admin/tournaments/[id]/scores/page.tsx` — `confirmRanking(groupId)`, 보조: `moveInTie()`, `reopenTieBreak()` |
| 관련 함수 | `calculateStandings()`, `getTieGroups()` (`lib/utils/standings.ts`), `getPrelimSlotPlacements()` |
| 권한 | 대회 관리 권한자 |

- **역할**: 순위 계산에서 동률이 발생한 조에 대해 관리자가 순서를 직접 조정·확정하고, 그 순서대로 본선에 진출시킨다.
- **입력**: `tieBreaks[groupId]` — 관리자가 조정한 `participant_id` 순서 배열. `moveInTie(groupId, fromIdx, dir)`로 위/아래 이동하되 **같은 동률 그룹(`getTieGroups`) 내에서만** 교환 허용(`canSwap` 검사).
- **출력 / 부수효과**:
  - `standings` upsert — 통계값은 재계산(`calculateStandings`)에서 가져오되 `ranking`은 반드시 관리자가 정한 `orderedIds` 순서(`idx + 1`)로 저장.
  - `advanceGroup(groupId, phase, orderedIds)` 호출로 본선 슬롯 배정 → 확정 후 `tieBreaks[groupId]` 제거, `loadData()` 재호출.
- **비즈니스 규칙**:
  - `tieBreaks` 상태는 조 전 경기 완료 && `getTieGroups(standings).length > 0` && 아직 미확정(`confirmedGroupIdsRef`에 없음)일 때 자동 세팅(useEffect). 초기 순서는 계산 순위.
  - **동률 그룹 밖 이동 금지**: 실제 순위(`standings`) 인덱스 기준으로 두 항목이 같은 tie 그룹에 속할 때만 swap. 서로 다른 tier 간 순서 뒤집기는 불가.
  - `reopenTieBreak(groupId)` — 이미 확정된 조의 순위를 재조정. DB 저장 순서(`confirmedRankings`)가 있으면 그것을, 없으면 재계산 순위를 초기값으로.
- **관련 테이블**: 읽기 `matches`, `groups`, `standings`, `tournament_phases`. 쓰기 `standings`, `matches`.
- **주의사항**: 통계(wins/sets/points)는 계산값, 순위(ranking)는 사용자 지정값을 저장하는 이원 구조. 저장 실패 시 toast로 알리고 진출을 진행하지 않음.

---

## FEAT-DRW-05 브라켓 / 리그 / 순위 유틸리티

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `lib/utils/bracket.ts`, `lib/utils/roundrobin.ts`, `lib/utils/standings.ts` (순수 함수, 부수효과 없음) |
| 관련 함수 | 아래 export 목록 |
| 권한 | 해당 없음(순수 계산) |

- **역할**: 대진 생성·진출·순위 계산에 쓰이는 결정적(deterministic) 순수 함수 모음. 동일 입력에 항상 동일 결과 → 배정과 예상 표시의 일관성을 보장.

### `lib/utils/bracket.ts`

| 시그니처 | 역할 |
|----------|------|
| `nextPowerOfTwo(n: number): number` | `n` 이상인 최소 2의 거듭제곱(브라켓 슬롯 수). |
| `generateSeededBracket<T>(ids: T[]): Array<[T\|null, T\|null]>` | 표준 시드 배치로 1라운드 대진 반환. 내부 `bracketSeedOrder(slots)`가 `[1, 8, 5, 4, 3, 6, 7, 2]` 식 순서를 생성 — 1번 시드 맨 앞, 2번 맨 뒤, 상위 시드가 앞뒤 교차 분산되어 결승에 가까운 라운드에서만 만남. **부전승(null)은 항상 p2 쪽**(`[p2, null]`로 스왑)이라 기존 부전승 처리와 호환. |
| `getBracketRounds(n: number): number` | 참가자 `n`명의 본선 총 라운드 수 = `ceil(log2(nextPowerOfTwo(n)))`. |
| `getRoundName(round, totalRounds): string` | 라운드명("결승/준결승/8강/16강/N라운드"), `diff = totalRounds - round` 기준. |
| `getPrelimSlotPlacements(groupCount, advanceCount): (PrelimSlot\|null)[]` | 예선 (조, 순위) → 본선 1라운드 슬롯 매핑. 슬롯 인덱스 = `(matchNumber-1)*2 + (p2?1:0)`, 값 = `{group, rank}` 또는 `null`(구조적 부전승). **캐시됨, 반환 배열 변형 금지.** |

- **`getPrelimSlotPlacements` 상세 규칙**:
  1. `(rank, group)` 순으로 placeholder 배열 생성(순위 우선 → 각 순위 안에서 조 순회) 후 `generateSeededBracket`으로 슬롯 배치. → 각 조 1위가 서로 다른 쿼터에 분산.
  2. 진출 총원이 2의 거듭제곱이 아니면 상위 시드부터 부전승(null) 배정. 부전승은 항상 실제 진출자와 짝지어져 양쪽이 모두 빈 경기가 생기지 않음(빈 경기는 승자를 다음 라운드로 못 보냄).
  3. `optimizeGroupSpread()` — 결정적 탐욕 보정. **같은 순위끼리만** 자리 교환(시드 등급·부전승 위치 불변)하며 `groupSpreadCost`가 줄지 않을 때까지 반복.
  4. `groupSpreadCost()` — 경기(2슬롯)→4슬롯→…→절반 구역까지 같은 조가 2팀 이상 몰리면 벌점. 1라운드 같은 경기(2슬롯)의 같은 조 대결은 `1_000_000` 벌점으로 사실상 금지, 그 외는 `placements.length/size` 가중치(이른 라운드일수록 큼). 조가 1개뿐이면 보정 불가.

### `lib/utils/roundrobin.ts`

| 시그니처 | 역할 |
|----------|------|
| `generateRoundRobin(ids: string[]): Array<[string,string][]>` | 원형법(circle method) 리그 일정. 홀수면 `'bye'` 추가 후 라운드마다 position 0 고정·나머지 회전, `'bye'` 매치는 제외. |
| `distributeIntoGroups<T>(participants, groupCount): T[][]` | 뱀 시드(snake seeding): `1→A, 2→B, 3→C, 4→C, 5→B, 6→A …` 방식으로 균등 분배. |

### `lib/utils/standings.ts`

| 시그니처 | 역할 |
|----------|------|
| `calculateStandings(matches, participantIds, rankingMethod='wins_first', isTeam=false): StandingRow[]` | `completed` 경기만 집계. 정렬 기준: `wins_first` = 승수 → 세트 득실 → 점수 득실 / `setdiff_first` = 세트 득실 → 승수 → 점수 득실. **단체전 + `setdiff_first`** 이면 게임 승수 대신 개인경기 실제 세트 점수 합(`match.sets`)으로 세트 득실 계산. `ranking` = 정렬 순서 index+1. |
| `hasTieAtBoundary(standings, advanceCount): boolean` | 진출 경계(`advanceCount-1`번째와 `advanceCount`번째)가 동일 tier인지 — 자동 진출 차단 여부 판정. |
| `getTieGroups(standings): number[][]` | 동일 tier 연속 구간(길이 2 이상)의 인덱스 묶음 배열 — 수동 순위조정 대상. |

- **동일 tier 판정(`isSameTier`)**: `wins` 동일 && `sets_won - sets_lost` 동일 && `points_won - points_lost` 동일.
- **주의사항**: `calculateStandings`의 세트/점수는 `match.sets`(match_sets)를 사전에 부착해야 정확하다(scores 페이지 `loadData`가 로드 시 부착). `participant1_id`/`participant2_id`가 없는 미배정 경기는 건너뜀.
