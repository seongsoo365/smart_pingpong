# 데이터 모델 정의서 (단일 출처)

> 이 문서는 DB 스키마·ERD·마이그레이션의 **단일 출처(single source of truth)** 입니다.
> DB·테이블·RLS·마이그레이션 관련 작업은 이 문서를 먼저 참고하세요.

Supabase (PostgreSQL + Auth + Realtime + RLS) 기반. 모든 대회 데이터는 **인증 없이 공개 읽기(SELECT)** 가 가능하며, 쓰기 권한은 RLS 정책으로 강제됩니다.

---

## ERD 요약

```
user_profiles (auth.users 확장)
  id, email, name, phone, role(system_admin|tournament_admin), provider, avatar_url, password_changed

tournament (대회)
  ├─ tournament_questions (대회 Q&A, 1:N)
  ├─ tournament_admins (공동 관리자, N:M) — user_id, added_by, added_at
  └─ division (부수, 1:N)  match_type: 'individual' | 'team'
       ├─ [개인전] player (1:N, division_id)  — confirmed, seed, group_id, email, memo
       │    RLS: confirmed=false 미승인 레코드는 공개 UPDATE/DELETE 허용 (신청자 수정·취소)
       ├─ [단체전] team (1:N, division_id)    — confirmed, seed, group_id, max_teams, email, memo
       │    RLS: 동일 (미승인 팀은 공개 UPDATE/DELETE 허용)
       │    └─ team_member (1:N, team_id)     — player_name, player_order, player_level
       ├─ division_merges (부수 병합, 1:N)
       └─ tournament_phase (1:N)  phase_type: 'preliminary'|'main'
            format, games_per_match, points_per_game, advancement_count,
            team_match_format, ranking_method(wins_first|setdiff_first)
            ├─ group (1:N, 리그 풀)
            │    └─ player/team (group_id로 배정)
            └─ match (1:N, round + match_number)
                  └─ match_set (세트별 점수)
       (순위 계산 결과) standings

casual_games (일회성 게임 — 대회 구조 독립)
  id, player1_name, player2_name, player1_club, player2_club,
  score1(세트 승수), score2(세트 승수), sets(JSONB [{score1,score2},...]),
  games_per_match, points_per_game, played_at, venue, notes,
  created_by(auth.users, nullable), created_at
  RLS: 전체 공개 SELECT / INSERT 비인증 허용 / UPDATE·DELETE는 소유자·system_admin

main_questions (메인 Q&A — 대회와 무관한 사이트 공통)
  id, author_name, question, answer, answered_by(nullable), answered_at,
  is_public(기본 TRUE), created_at
  RLS: is_public=TRUE 행만 공개 SELECT / INSERT 비인증 허용 / system_admin만 전체·UPDATE·DELETE
```

**전체 테이블 (16개)**: `user_profiles`, `tournaments`, `tournament_admins`, `divisions`, `division_merges`, `tournament_phases`, `groups`, `players`, `teams`, `team_members`, `matches`, `match_sets`, `standings`, `tournament_questions`, `main_questions`, `casual_games`.

**DB 함수 3개**:
- `handle_new_user()` — 가입 시 `user_profiles` 자동 생성 트리거 (`on_auth_user_created`)
- `get_my_role()` — `user_profiles` RLS 재귀 방지 헬퍼 (SECURITY DEFINER)
- `is_tournament_admin(tournament_id)` — 대회 관리 권한 통합 판별 (SECURITY DEFINER)

---

## 권한 계층 (대회 쓰기)

`is_tournament_admin(tournament_id)` 이 `true`인 조건 (하나라도 해당):
- `admin_id = auth.uid()` — 대표 관리자
- `created_by = auth.uid()` — 원본 생성자
- `tournament_admins` 테이블에 존재 — 공동 관리자
- `user_profiles.role = 'system_admin'` — 시스템 관리자

| 역할 | 대회 데이터 수정 | 공동관리자 추가/삭제 | admin_id 변경(위임) |
|------|:---:|:---:|:---:|
| `system_admin` | ✅ | ✅ | ✅ |
| `created_by` (원본 생성자) | ✅ | ✅ | ✅ |
| `admin_id` (대표 관리자) | ✅ | ✅ | ❌ |
| `tournament_admins` (공동 관리자) | ✅ | ❌ | ❌ |

> RLS 정책 내에서 `user_profiles`를 직접 조회하지 마세요. 대회 쓰기 권한은 반드시 `is_tournament_admin()` 사용.

---

## 마이그레이션 목록 · 실행 순서

Supabase SQL Editor에서 번호 순서대로 실행:
`001 → 002 → 003 → 004 → 005 → 006 → 008 → 009 → 010 → 011 → 012 → 013 → 014 → 015 → 016 → 017 → 018_phase_team_match_format → 018_registration_self_edit → 019 → 020 → 021 → 022 → 023 → 024 → 025 → 026`

| 마이그레이션 | 정의 내용 |
|---|---|
| `001_initial_schema` | 핵심 12개 테이블 + 전 테이블 RLS(공개 읽기 + 인증 관리) + `handle_new_user()` 트리거 + 인덱스 |
| `002_fix_rls_recursion` | RLS 무한재귀 수정 — `get_my_role()` (SECURITY DEFINER), user_profiles 정책 재작성 |
| `003_team_match_format` | `divisions.team_match_format` 컬럼 |
| `004_player_registration` | `players.confirmed` + 공개 등록(insert) 정책 |
| `005_team_registration` | `teams.confirmed` + teams/team_members 공개 등록 정책 |
| `006_team_slots` | `teams.created_at`, `divisions.max_teams` |
| `008_enable_realtime` | Supabase Realtime publication (matches 등 실시간 구독) |
| `009_email_notify` | `players.email`, `teams.email` |
| `010_qna` | `tournament_questions` 테이블 + RLS |
| `011_social_auth` | `user_profiles.provider`, `avatar_url` + `handle_new_user()` 갱신 |
| `012_tournament_regulations` | `tournaments.regulations` |
| `013_password_changed` | `user_profiles.password_changed` (기본 FALSE) |
| `014_fix_password_changed_trigger` | 기본값 TRUE로 수정 + 트리거 갱신 |
| `015_fix_trigger_provider` | `handle_new_user()` provider 처리 수정 |
| `016_casual_games` | `casual_games` 테이블 + RLS(공개 읽기, 관리자 쓰기) |
| `017_casual_games_public` | casual_games 공개 insert / 작성자 update·delete |
| `018_phase_team_match_format` | `tournament_phases.team_match_format` |
| `018_registration_self_edit` | players/teams/team_members 신청자 본인 수정·삭제 RLS (UUID가 사실상 비밀번호 역할) |
| `019_tournament_co_admins` | `tournament_admins` 테이블 + `is_tournament_admin()` + 전 관리 정책 재정의 (018 이후 실행 필수) |
| `020_main_qna` | `main_questions` 테이블 + RLS |
| `021_drop_qna_email` | `tournament_questions.author_email` 제거 |
| `022_drop_main_qna_email` | `main_questions.author_email` 제거 |
| `023_phase_ranking_method` | `tournament_phases.ranking_method` (wins_first / setdiff_first) |
| `024_registration_memo` | `players.memo`, `teams.memo` (관리자 전용 신청자 메모) |
| `025_qna_show_unanswered` | Q&A 공개 SELECT를 is_public 기준으로 변경 (미답변도 등록 즉시 노출) |
| `026_missing_indexes` | 성능 인덱스 추가 (matches participant, questions, team_members 등) |

> 007은 결번 (team_member_level은 009에 통합).
> 013·014·015는 소셜 로그인/비밀번호 관련.
> 018이 두 파일이므로 둘 다 실행 필요.

---

## 상세 기능별 RLS · 데이터 규칙

기능별 입출력·RLS 조건 상세는 `docs/features/` 참고:
- 인증/권한/RLS 헬퍼 → `docs/features/auth-authz.md`
- 대회·부수 CRUD → `docs/features/tournament-division.md`
- 참가신청 자기수정 RLS → `docs/features/registration.md`
- Q&A 테이블 RLS → `docs/features/qna-notify.md`
