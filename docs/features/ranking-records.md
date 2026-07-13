# 기능 정의서 — 랭킹 · 전적 (백엔드)

> 선수 레이팅/전적 기능. 대회 경기(`matches`)와 일회성 게임(`casual_games`)을 합산하며, 레이팅 포인트 계산은 순수 함수 `lib/utils/rating.ts`에 위임한다. 모든 라우트는 공개 읽기(`createClientSafe`, 미설정 시 503).
>
> 포함 기능ID: **FEAT-RNK-01**(전체 랭킹 집계) · **FEAT-RNK-02**(선수 개인 전적) · **FEAT-RNK-03**(선수 검색) · **FEAT-RNK-04**(레이팅 포인트 규칙)

---

## FEAT-RNK-01 전체 랭킹 집계

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `GET /api/players/rankings` (`app/api/players/rankings/route.ts`) |
| 관련 함수 | `getMatchRatingPoints()` (`lib/utils/rating.ts`) |
| 권한 | 공개(비인증). `createClientSafe()` — Supabase 미설정 시 503 |

- **역할**: 전 선수의 누적 레이팅 포인트를 합산·정렬해 랭킹 목록을 반환. 개인전·단체전·일회성 게임을 모두 포함.
- **입력**: 쿼리 `q`(선택) — 이름 또는 클럽 부분 일치 필터(집계 후 적용).
- **출력**: `{ rankings: PlayerRanking[], total }`. 각 항목 `{ rank, name, club, total_points, total_wins, total_games, breakdown: { casual, preliminary, main } }`. **HTTP 캐시**: `Cache-Control: s-maxage=60, stale-while-revalidate=120` (CDN 60초 캐시).
- **비즈니스 규칙**:
  - 선수 식별 키 = `` `${name}|${club ?? ''}` `` (이름 + 클럽). 동일 키는 하나의 누적 항목으로 병합.
  - **개인전**: `matches` 중 `status='completed'`, `participant1_type='player'`, `winner_id` 존재. 각 경기 양쪽 선수에 `total_games++`, 승자 `total_wins++`, `getMatchRatingPoints()` 결과 포인트 가산.
  - **단체전**: `participant1_type='team'`. 팀의 `team_members` 각 멤버에게 팀 클럽 기준으로 포인트를 동일 배분(멤버별 `total_games++`).
  - **일회성 게임**: `casual_games` — `score1 !== score2`인 게임만. 승자에게 `CASUAL_WIN(10)` 가산.
  - `total_rounds`는 phase별 `max(round)`로 계산(레이팅 라운드 포인트 산정용, FEAT-RNK-04).
  - 정렬: `total_points` 내림차순 → 동점 시 `total_wins` 내림차순. `total_games > 0`만 포함. `rank`는 정렬 순서 index+1.
- **관련 테이블**: 읽기 `matches`(+ 조인 `tournament_phases(phase_type, format)`), `players`, `teams`(+ `team_members`), `casual_games`. 쓰기 없음.
- **주의사항**: 병렬 2단계 쿼리(1차: 매치·일회성, 2차: 참가자 정보). `q` 필터는 집계 완료 후 적용하므로 rank는 전체 기준이 아닌 필터 결과 내 순번으로 재부여됨.

---

## FEAT-RNK-02 선수 개인 전적

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `GET /api/players/records` (`app/api/players/records/route.ts`) |
| 관련 함수 | `getMatchRatingPoints()` (`lib/utils/rating.ts`) |
| 권한 | 공개(비인증). `createClientSafe()` — 미설정 시 503 |

- **역할**: 한 선수의 전체 경기 이력(대회 + 일회성), 승패 합계, 레이팅 포인트, 상대전적(h2h)을 반환.
- **입력** (쿼리):
  - `ids` — 콤마 구분 `players.id`(UUID 형식 검증). 대회 전적 조회용.
  - `name`, `club` — 일회성 게임 매칭용(이름/클럽).
  - `include_tournament`(기본 true), `include_casual`(기본 true) — `'false'`로 각 소스 제외.
  - `casual_game_ids` — 있으면 "내가 등록한 게임만" 필터(UUID 검증). 값이 있는데 빈 배열이면 일회성 전적 skip.
  - `ids`와 `name` 둘 다 없으면 400.
- **출력**: `{ player: {name, club?}, total_wins, total_losses, rating_points, rating_breakdown: {casual, preliminary, main}, h2h[], matches[] }`. 없으면 404(선수 못 찾음).
- **비즈니스 규칙**:
  - **대회 전적**(`ids` && include_tournament): `matches`에서 `participant1_id.in(ids) OR participant2_id.in(ids)`, `status='completed'`, `participant1_type='player'`. 각 경기에서 "내 관점"으로 점수/세트 재배열(`isP1` 여부), `won = winner_id ∈ ids`. `points_earned = getMatchRatingPoints(...)`, `total_rounds`는 phase별 `max(round)`. 조인으로 `tournaments(name, start_date)`, `divisions(name)` 라벨 확보.
  - **일회성 전적**(`name` && include_casual): `casual_game_ids`가 있으면 `id.in(...)`, 없으면 `player1_name.eq OR player2_name.eq`. 이름(+선택적 클럽) 일치하는 쪽을 "나"로 매핑. `points_earned = won ? 10 : 0`, `phase_type='casual'`, `tournament_name='숏게임'`.
  - **정렬**: `tournament_start`(일회성은 `played_at`) 내림차순, null은 뒤로.
  - **상대전적(h2h)**: 키 `` `${opponent_name}|${opponent_club ?? ''}` ``로 그룹핑, `wins`/`losses`/`matches` 누적. 총 대전 수(`wins+losses`) 내림차순 정렬.
  - **집계**: `rating_points` = 전 경기 `points_earned` 합, `rating_breakdown`은 phase_type별 합.
- **관련 테이블**: 읽기 `players`(본인·상대), `matches`(+ `match_sets`, 조인 `tournament_phases → divisions → tournaments`), `casual_games`. 쓰기 없음.
- **주의사항**: 동명이인은 `ids`(대회) 또는 `name+club`(일회성)으로 구분. `playerInfo`는 대회 조회 실패 시 `name/club` 파라미터로 폴백.

---

## FEAT-RNK-03 선수 검색

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `GET /api/players/search` (`app/api/players/search/route.ts`) |
| 관련 함수 | — |
| 권한 | 공개(비인증). `createClientSafe()` — 미설정 시 503 |

- **역할**: 이름으로 선수 후보를 검색. 대회 등록 선수(`players`)와 일회성 게임 등장 이름(`casual_games`)을 이름+클럽으로 그룹핑해 반환(전적 조회 진입점).
- **입력**: 쿼리 `name`(필수, 부분 일치). 없으면 `[]`.
- **출력**: 배열 `[{ name, club, player_ids[], registrations: [{tournament_name, division_name}], has_casual_games }]`.
- **비즈니스 규칙**:
  - `players`: `name ilike %name%`, `confirmed=true`, 최대 50건. 조인으로 `divisions → tournaments` 등록 이력 수집. 키 `` `${name}|${club ?? ''}` ``로 그룹핑, `player_ids` 누적(동명이인·다중 등록 대응 → FEAT-RNK-02의 `ids`로 전달).
  - `casual_games`: `player1_name ilike OR player2_name ilike`, 최대 100건. 이름이 매칭되는 쪽을 후보로 추가하고 `has_casual_games=true` 설정(대회 기록 없이 일회성만 있는 선수도 노출).
- **관련 테이블**: 읽기 `players`(+ 조인 `divisions → tournaments`), `casual_games`. 쓰기 없음.
- **주의사항**: 두 쿼리는 병렬. 검색 결과의 `player_ids`/`name`+`club`을 전적 API에 전달하는 것이 표준 흐름.

---

## FEAT-RNK-04 레이팅 포인트 규칙

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `lib/utils/rating.ts` — `RATING_POINTS`, `getMatchRatingPoints()` (순수 함수) |
| 관련 함수 | FEAT-RNK-01/02에서 호출 |
| 권한 | 해당 없음 |

- **역할**: 경기 컨텍스트(단계·포맷·라운드·승패)로 레이팅 포인트를 결정하는 단일 소스. 랭킹 집계와 개인 전적이 동일 규칙을 공유.
- **입력**: `RatingMatchContext { phase_type: 'preliminary'|'main'|'casual', format, round, total_rounds, won }`.
- **출력**: 획득 포인트(number).
- **비즈니스 규칙** (`RATING_POINTS`):
  - `casual`: 승리 `10`(CASUAL_WIN), 패배 0.
  - `preliminary`: 승리 `15`(PRELIMINARY_WIN), 패배 0.
  - `main` && `format !== 'single_elimination'`(예: round_robin 본선): 예선과 동일하게 승리 15, 패배 0.
  - `main` && `single_elimination`: `diff = total_rounds - round` 기준.
    - 승리: `diff=0` 결승승(우승) `150`(MAIN_FINAL_WIN) / `diff=1` 준결승 `80`(MAIN_SF_WIN) / `diff=2` 8강 `50`(MAIN_QF_WIN) / `diff=3` 16강 `30`(MAIN_R16_WIN) / `diff>=4`(32강 이상) `20`(MAIN_EXTRA_WIN).
    - 패배: `diff=0` 결승패(준우승)만 `100`(MAIN_RUNNER_UP), 그 외 패배는 0.
- **관련 테이블**: 없음(순수 계산).
- **주의사항**: `diff`는 `total_rounds`(phase별 max round)에 의존하므로 호출부는 정확한 `total_rounds`를 넘겨야 함. 라운드가 결승에 가까울수록(diff 작을수록) 포인트가 크고, 준우승만 예외적으로 무승부성 보상을 받는다.
