# ARCHITECT.md — Smart Pingpong 프로젝트 아키텍처

> 이 파일은 코드베이스 전체 구조를 설명합니다. Claude Code 에이전트가 작업 전 반드시 참고합니다.

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 16.2.6 (App Router, Turbopack) |
| 런타임 | React 19 |
| 스타일 | Tailwind CSS 4 |
| UI 컴포넌트 | shadcn/ui (@base-ui/react 기반) |
| 백엔드/DB | Supabase (PostgreSQL + Auth + Realtime + RLS) |
| 애니메이션 | framer-motion |
| 토스트 | sonner |
| 아이콘 | lucide-react |
| 타입 | TypeScript (strict, any 금지) |

---

## 디렉터리 구조

```
smart_pingpong/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx              # 로그인 페이지 (Google/Naver/이메일)
│   ├── (public)/                       # 비인증 공개 페이지 (서버 컴포넌트)
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # 홈
│   │   ├── players/page.tsx            # 선수 전적 조회 (이름 검색 → 즉시 합산 전적 표시)
│   │   ├── games/new/page.tsx          # 일회성 게임 기록 등록 (로그인 불필요, 약식/세트별 모드, 내가 등록한 기록 localStorage 조회)
│   │   └── tournaments/
│   │       ├── page.tsx                # 대회 목록 (연도 필터: 2026년 시작, 현재 연도까지)
│   │       └── [id]/
│   │           ├── page.tsx            # 대회 상세
│   │           ├── register/page.tsx   # 온라인 참가 신청 (개인/단체)
│   │           ├── my-registration/page.tsx  # 신청 정보 수정 (미승인 상태일 때 이름·부수 변경)
│   │           └── divisions/[divId]/page.tsx  # 부수 상세 (예선 매트릭스, 본선 브라켓)
│   ├── admin/                          # 보호된 관리자 페이지
│   │   ├── layout.tsx                  # 인증 확인 + AdminSidebar + MobileBottomNav
│   │   ├── page.tsx                    # 관리자 대시보드 (메인 Q&A 미답변 카운트 표시)
│   │   ├── qna/page.tsx                # 메인 Q&A 관리 (미답변·답변완료 목록, 답변 저장, 공개/비공개 토글, 삭제)
│   │   ├── system/users/               # system_admin 전용
│   │   │   ├── page.tsx
│   │   │   ├── AddAdminForm.tsx        # 관리자 계정 생성 폼
│   │   │   └── UserList.tsx            # 관리자 목록 (권한 잠금 포함)
│   │   └── tournaments/[id]/
│   │       ├── edit/page.tsx           # 대회 정보 + 부수 설정 편집
│   │       ├── players/page.tsx        # 선수/팀 등록 관리 (match_type 분기)
│   │       ├── registrations/page.tsx  # 온라인 접수 관리 (승인/거절)
│   │       ├── draw/page.tsx           # 대진표 생성
│   │       ├── scores/page.tsx         # 결과 입력 (세트별 점수, 승자 자동 진출)
│   │       └── qna/page.tsx            # 대회 Q&A 관리
│   ├── api/
│   │   ├── admin/
│   │   │   ├── create-user/route.ts    # 관리자 계정 생성 (service_role 사용)
│   │   │   └── users/[id]/route.ts     # 관리자 정보 수정/삭제
│   │   ├── divisions/
│   │   │   ├── route.ts                # 부수 생성
│   │   │   └── [id]/route.ts           # 부수 수정/삭제
│   │   ├── tournaments/[id]/
│   │   │   ├── route.ts                # 대회 수정/삭제
│   │   │   └── admins/
│   │   │       ├── route.ts            # 공동 관리자 GET(목록) / POST(추가)
│   │   │       └── [userId]/route.ts   # 공동 관리자 DELETE(제거)
│   │   ├── games/
│   │   │   ├── route.ts                # 일회성 게임 GET(목록, ?ids=로 특정 ID 필터) / POST(등록, 비인증 허용)
│   │   │   └── [id]/route.ts           # 일회성 게임 PUT(수정) / DELETE(삭제, 소유자·admin)
│   │   ├── players/
│   │   │   ├── records/route.ts        # 선수 전적 조회 (대회 + 일회성 게임 합산, ?ids=&name=&club=)
│   │   │   └── search/route.ts         # 선수 검색 (players 테이블 + casual_games 이름 통합)
│   │   └── notify/route.ts             # 승인/거절 이메일 알림 (Resend)
│   └── auth/
│       ├── callback/route.ts           # OAuth 코드 교환 (Google)
│       ├── callback/naver/route.ts     # 네이버 OAuth 콜백
│       └── naver/route.ts              # 네이버 OAuth 시작점
├── components/
│   ├── layout/
│   │   ├── Header.tsx                  # 공개 페이지 헤더 (홈·대회 목록·게임 기록 등록·전적 조회)
│   │   ├── AdminSidebar.tsx            # 관리자 데스크톱 사이드바 (대시보드·대회 등록·일회성 게임·Q&A 관리·사용자 관리)
│   │   ├── MobileBottomNav.tsx         # 모바일 하단 네비 (홈·대회·게임·전적·관리)
│   │   ├── SetupBanner.tsx             # Supabase 미설정 시 안내 배너
│   │   └── ThemeToggle.tsx             # 다크/라이트 모드 토글 버튼
│   ├── providers/
│   │   └── ThemeProvider.tsx           # next-themes ThemeProvider 클라이언트 래퍼
│   ├── MainQnaSection.tsx              # 홈 페이지용 메인 Q&A 공개 컴포넌트 (질문 목록 + 등록 폼, 비인증 허용)
│   ├── tournament/
│   │   ├── TournamentCard.tsx          # 대회 카드 (목록용)
│   │   ├── BracketView.tsx             # 본선 브라켓 시각화
│   │   ├── GroupMatrix.tsx             # 예선 전적 매트릭스
│   │   ├── StandingsTable.tsx          # 조별 순위표
│   │   ├── DivisionRealtimeContent.tsx # 부수 상세 실시간 구독 클라이언트 컴포넌트
│   │   ├── QnaSection.tsx              # 대회 Q&A 공개 섹션
│   │   ├── MyGameHistory.tsx           # 내가 등록한 일회성 게임 기록 목록 (localStorage 기반)
│   │   └── MyRegistrationStatus.tsx    # 내 신청 내역 (localStorage 기반, 수정·취소 버튼 포함)
│   └── ui/                             # shadcn 기본 컴포넌트
│       ├── button, card, badge, tabs, dialog, select
│       ├── input, label, textarea, separator
│       ├── avatar, dropdown-menu, table, sonner
│       └── help-popover.tsx            # 커스텀 도움말 팝오버
├── lib/
│   ├── supabase/
│   │   ├── client.ts                   # 클라이언트 컴포넌트용 createClient()
│   │   └── server.ts                   # 서버용 createClient() / createClientSafe() / supabaseConfigured
│   ├── types/index.ts                  # 전체 TypeScript 타입 정의
│   ├── utils.ts                        # cn() 유틸
│   └── utils/
│       ├── bracket.ts                  # 시드 브라켓 생성 (generateSeededBracket, getBracketRounds)
│       ├── roundrobin.ts               # 원형법 리그 일정 (distributeIntoGroups)
│       ├── standings.ts                # 순위 계산 + 동률 감지 (hasTieAtBoundary, getTieGroups)
│       ├── myGames.ts                  # 내 일회성 게임 ID localStorage 관리 (addMyGame, getMyGameIds, removeMyGame)
│       └── myRegistrations.ts          # 내 대회 신청 ID localStorage 관리 (addMyRegistration, getMyRegistrations, removeMyRegistration)
├── supabase/migrations/                # 순서대로 실행해야 하는 DB 마이그레이션
│   ├── 001_initial_schema.sql          # 기본 테이블 + RLS + 트리거
│   ├── 002_fix_rls_recursion.sql       # get_my_role() SECURITY DEFINER 함수
│   ├── 003_team_match_format.sql       # divisions.team_match_format 컬럼
│   ├── 004_player_registration.sql     # players.confirmed 컬럼
│   ├── 005_team_registration.sql       # teams.confirmed + email 컬럼
│   ├── 006_team_slots.sql              # divisions.max_teams
│   ├── 008_enable_realtime.sql         # Realtime publication 활성화
│   ├── 009_email_notify.sql            # players/teams.email 컬럼
│   ├── 010_qna.sql                     # tournament_questions 테이블
│   ├── 011_social_auth.sql             # user_profiles.provider, avatar_url
│   ├── 012_tournament_regulations.sql  # tournaments.regulations 컬럼
│   ├── 016_casual_games.sql            # casual_games 테이블 + RLS (인증 필요 쓰기)
│   ├── 017_casual_games_public.sql     # casual_games INSERT RLS 공개 허용 (비인증 등록)
│   ├── 018_phase_team_match_format.sql # tournament_phases.team_match_format 컬럼
│   ├── 018_registration_self_edit.sql  # 미승인 신청자 본인 UPDATE/DELETE 허용 RLS
│   ├── 019_tournament_co_admins.sql    # tournament_admins 테이블 + is_tournament_admin() 함수 + RLS 전면 재작성
│   ├── 020_main_qna.sql                # main_questions 테이블 + RLS (공개 읽기/비인증 등록/system_admin 관리)
│   ├── 021_drop_qna_email.sql          # tournament_questions.author_email 컬럼 제거
│   └── 022_drop_main_qna_email.sql     # main_questions.author_email 컬럼 제거
├── proxy.ts                            # Next.js 16 middleware 대체 (세션 쿠키 갱신)
└── CLAUDE.md / AGENTS.md / ARCHITECT.md / roadmap.md
```

---

## 데이터 모델 (ERD 요약)

```
user_profiles (auth.users 확장)
  id, email, name, phone, role(system_admin|tournament_admin), provider, avatar_url

tournament
  ├─ tournament_questions (Q&A, 1:N)
  ├─ tournament_admins (공동 관리자, N:M) — user_id, added_by, added_at
  └─ division (부수, 1:N)  match_type: 'individual' | 'team'
       ├─ [개인전] player (1:N, division_id)  — confirmed, seed, group_id
       │    RLS: confirmed=false인 미승인 레코드는 공개 UPDATE/DELETE 허용 (신청자 수정·취소)
       ├─ [단체전] team (1:N, division_id)    — confirmed, seed, group_id, max_teams
       │    RLS: 동일 (미승인 팀은 공개 UPDATE/DELETE 허용)
       │    └─ team_member (1:N, team_id)    — player_name, player_order, player_level
       └─ tournament_phase (1:N)  phase_type: 'preliminary'|'main'
            ├─ group (1:N, 리그 풀)
            │    └─ player/team (group_id로 배정)
            └─ match (1:N, round + match_number)
                  └─ match_set (세트별 점수)

casual_games (일회성 게임 — 대회 구조 독립)
  id, player1_name, player2_name, player1_club, player2_club,
  score1(세트 승수), score2(세트 승수), sets(JSONB [{score1,score2},...]),
  games_per_match, points_per_game, played_at, venue, notes,
  created_by(auth.users 참조, nullable), created_at
  RLS: 전체 공개 SELECT / INSERT 비인증 허용 / UPDATE·DELETE는 소유자·system_admin

main_questions (메인 Q&A — 대회와 무관한 사이트 공통)
  id, author_name, question, answer, answered_by(auth.users 참조, nullable),
  answered_at, is_public(기본 TRUE), created_at
  RLS: answer IS NOT NULL AND is_public=TRUE인 행만 공개 SELECT
       INSERT 비인증 허용 (누구나 질문 가능)
       system_admin만 SELECT 전체·UPDATE·DELETE 가능
  - 홈 페이지 하단 MainQnaSection.tsx 에 공개 노출
  - 관리자: /admin/qna 에서 답변·공개/비공개 토글·삭제
```

### 주요 타입 (lib/types/index.ts)

| 타입 | 값 |
|------|-----|
| `UserRole` | `'system_admin' \| 'tournament_admin' \| 'viewer'` |
| `TournamentStatus` | `'draft' \| 'registration' \| 'in_progress' \| 'completed'` |
| `MatchType` | `'individual' \| 'team'` |
| `PhaseType` | `'preliminary' \| 'main'` |
| `PhaseFormat` | `'round_robin' \| 'single_elimination' \| ...` |
| `MatchStatus` | `'pending' \| 'in_progress' \| 'completed' \| 'bye'` |
| `TeamMatchFormat` | `'olympic' \| 'swaythling' \| ...` 6종 |
| `TournamentAdmin` | `{ tournament_id, user_id, added_by?, added_at, user?: UserProfile }` |
| `MyRegistration` | `{ id, type: 'player'\|'team', tournament_id }` — localStorage 저장용 |
| `MainQuestion` | `{ id, author_name, question, answer?, answered_by?, answered_at?, is_public, created_at }` |

---

## 인증 흐름

```
이메일 로그인:
  /login → supabase.auth.signInWithPassword() → /admin

Google OAuth:
  /login → supabase.auth.signInWithOAuth(provider:'google')
         → Supabase OAuth → /auth/callback?code=xxx → exchangeCodeForSession → /admin

Naver OAuth:
  /login → /auth/naver (state 쿠키 세팅, Naver 인가 URL로 redirect)
         → /auth/callback/naver (토큰 교환 → Supabase signInWithPassword 또는 계정 생성) → /admin

세션 갱신:
  proxy.ts (middleware 대체) — 모든 요청마다 supabase.auth.getUser() 호출로 쿠키 갱신
  인증 리다이렉트: app/admin/layout.tsx 에서 처리 (proxy.ts는 리다이렉트 안 함)
```

---

## Supabase 클라이언트 사용 규칙

| 컨텍스트 | 사용 함수 | 파일 |
|----------|-----------|------|
| 서버 컴포넌트 / API 라우트 | `createClient()` | `lib/supabase/server.ts` |
| 공개 서버 컴포넌트 (Supabase 없어도 동작해야 함) | `createClientSafe()` → null 체크 필수 | `lib/supabase/server.ts` |
| 클라이언트 컴포넌트 | `createClient()` | `lib/supabase/client.ts` |
| Supabase 설정 여부 확인 | `supabaseConfigured` (boolean) | `lib/supabase/server.ts` |

---

## RLS / 권한 구조

- 모든 대회 데이터(tournaments, divisions, players, matches 등): **인증 없이 공개 읽기(SELECT)**
- `user_profiles` 재귀 방지: `get_my_role()` (`002_fix_rls_recursion.sql`, SECURITY DEFINER) 사용
- **대회 쓰기 권한**: `is_tournament_admin(tournament_id)` (`019_tournament_co_admins.sql`, SECURITY DEFINER) 함수로 통합 판별
  - `admin_id = auth.uid()` — 대표 관리자
  - `created_by = auth.uid()` — 원본 생성자
  - `tournament_admins` 테이블에 존재 — 공동 관리자
  - `user_profiles.role = 'system_admin'` — 시스템 관리자
- tournaments, divisions, players, teams, team_members, matches, match_sets, standings 등 **모든 하위 테이블 쓰기 정책이 `is_tournament_admin()` 기반으로 통일**

### 관리자 권한 계층

| 역할 | 대회 데이터 수정 | 공동관리자 추가/삭제 | admin_id 변경 |
|------|----------------|-------------------|--------------|
| `system_admin` | ✅ | ✅ | ✅ |
| `created_by` (원본 생성자) | ✅ | ✅ | ✅ |
| `admin_id` (대표 관리자) | ✅ | ✅ | ❌ |
| `tournament_admins` (공동 관리자) | ✅ | ❌ | ❌ |

### API 라우트 권한 패턴
```ts
1. supabase.auth.getUser() → user
2. user_profiles.role 조회 → system_admin 여부
3. tournament.admin_id/created_by 또는 tournament_admins 테이블 → 소유권
// admin_id 변경(위임)은 created_by 또는 system_admin만 가능
```

### 신청자 자기수정 RLS (`018_registration_self_edit.sql`)
- `players` / `teams`: `confirmed = false` 조건 하에 공개 UPDATE / DELETE 허용
- `team_members`: 소속 팀이 `confirmed = false`이면 공개 UPDATE / DELETE 허용
- UUID 기반 레코드 ID로 사실상 본인 확인 (브루트포스 방지)

---

## Next.js 16 비동기 params 패턴

```ts
// 서버 컴포넌트
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}

// 클라이언트 컴포넌트
import { use } from 'react'
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)   // 또는 useParams<{ id: string }>()
}

// API 라우트
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
```

**주의:** `useSearchParams()`는 반드시 `<Suspense>`로 감싸야 프로덕션 빌드 통과.

---

## 대진표 생성 로직

### 파일: `app/admin/tournaments/[id]/draw/page.tsx`

1. 재생성 전 기존 경기·조 전체 삭제
2. **예선 있는 경우**: 원형법(`roundrobin.ts`) 조 생성 → 본선 전체 라운드를 빈(TBD) 슬롯으로 미리 생성
3. **예선 없는 경우**: `generateSeededBracket()` → 1라운드 배정, 나머지 라운드 미리 생성, 부전승 즉시 2라운드 채움

### 파일: `app/admin/tournaments/[id]/scores/page.tsx`

- 본선 경기 결과 저장 → 승자를 다음 라운드 슬롯 자동 채움
- 예선 조 전경기 완료 → `checkPrelimAdvancement()` → 본선 1라운드 슬롯 채움
- 경계 동률 → 자동 진출 차단 → 수동 순위 확정 UI

### 유틸리티

| 파일 | 역할 |
|------|------|
| `lib/utils/bracket.ts` | `generateSeededBracket(ids)` → `[p1\|null, p2\|null][]`, `getBracketRounds(n)`, `nextPowerOfTwo(n)` |
| `lib/utils/roundrobin.ts` | `distributeIntoGroups(players, n)` 뱀 시드 방식 |
| `lib/utils/standings.ts` | 승수→세트 득실→점수 득실 순위, `hasTieAtBoundary()`, `getTieGroups()` |
| `lib/utils/myGames.ts` | 비로그인 사용자의 등록 게임 ID를 localStorage에 보관 (`addMyGame`, `getMyGameIds`, `removeMyGame`) |

---

## UI 규칙

### 테마 시스템

`next-themes` + Tailwind 4 CSS 변수 기반 다크/라이트 모드 지원.

- `app/layout.tsx` — `<ThemeProvider>` (`components/providers/ThemeProvider.tsx`) 로 전체 감싸기. `defaultTheme="dark"`, `attribute="class"`.
- `html` 태그에 `dark` 클래스 유무로 테마 전환 (`suppressHydrationWarning` 필수).
- `components/layout/ThemeToggle.tsx` — Sun/Moon 토글 버튼. `Header`(공개, 모바일 포함) 및 `AdminSidebar`(관리자 데스크톱) 에 배치.

### CSS 변수 구조 (`app/globals.css`)

| 선택자 | 역할 |
|--------|------|
| `:root` | 라이트 모드 기본값 (흰 배경, 어두운 텍스트) |
| `.dark` | 다크 모드 값 (Deep Navy `#0F172A`, 밝은 텍스트) |
| `--bracket-line` | 브라켓 연결선 — 라이트: 블루 계열 / 다크: 화이트 계열 |

| 항목 | 값 |
|------|-----|
| Primary | `#3B82F6` (라이트/다크 공통) |
| Accent | `#F97316` (라이트/다크 공통) |
| 다크 배경 | `oklch(0.1 0.02 250)` ≈ `#0F172A` |
| 라이트 배경 | `oklch(0.98 0.005 250)` ≈ `#F8FAFC` |
| 글래스 카드 | `.glass` CSS 유틸 — 다크: `rgba(white/5%) + blur`, 라이트: `rgba(black/3%) + blur` |
| 토스트 | `sonner` |
| 레이아웃 | 모바일: `MobileBottomNav` / 데스크톱: `AdminSidebar` |

> **주의:** 하드코딩된 `rgba(255,255,255,0.x)` / `border-white/N` 사용 금지. 대신 `border-border`, `bg-muted`, `text-muted-foreground` 등 CSS 변수 토큰을 사용해야 테마 전환 시 정상 동작함.

---

## 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL        # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # 공개 anon 키
SUPABASE_SERVICE_ROLE_KEY       # 서버 전용 (api/admin/create-user만 사용)
RESEND_API_KEY                  # (선택) 이메일 알림, 없으면 silent skip
```

---

## 마이그레이션 실행 순서

Supabase SQL Editor에서 번호 순서대로 실행:
`001 → 002 → 003 → 004 → 005 → 006 → 008 → 009 → 010 → 011 → 012 → 016 → 017 → 018_phase_team_match_format → 018_registration_self_edit → 019 → 020 → 021 → 022 → 023 → 024`

> 007은 결번 (team_member_level은 009에 통합됨)  
> 013·014·015는 소셜 로그인/비밀번호 관련 마이그레이션 (별도 실행됨)  
> 018이 두 파일(phase_team_match_format, registration_self_edit)이므로 둘 다 실행 필요  
> 019는 기존 RLS 정책을 DROP 후 재생성하므로 반드시 018 이후에 실행  
> 020은 main_questions 테이블 신규 생성  
> 021은 tournament_questions.author_email 컬럼 제거 (020 이후 실행)  
> 022는 main_questions.author_email 컬럼 제거 (021 이후 실행)  
> 023은 tournament_phases.ranking_method 컬럼 추가 (예선 순위 결정 기준: 승수 우선/세트 득실 우선, 기본값 wins_first)  
> 024는 players/teams.memo 컬럼 추가 (관리자 전용 신청자 메모, 단체전은 팀 단위)
