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
│   │   ├── players/page.tsx            # 선수 전적 조회
│   │   └── tournaments/
│   │       ├── page.tsx                # 대회 목록 (연도 필터: 2026년 시작, 현재 연도까지)
│   │       └── [id]/
│   │           ├── page.tsx            # 대회 상세
│   │           ├── register/page.tsx   # 온라인 참가 신청 (개인/단체)
│   │           └── divisions/[divId]/page.tsx  # 부수 상세 (예선 매트릭스, 본선 브라켓)
│   ├── admin/                          # 보호된 관리자 페이지
│   │   ├── layout.tsx                  # 인증 확인 + AdminSidebar + MobileBottomNav
│   │   ├── page.tsx                    # 관리자 대시보드
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
│   │       └── qna/page.tsx            # Q&A 관리
│   ├── api/
│   │   ├── admin/
│   │   │   ├── create-user/route.ts    # 관리자 계정 생성 (service_role 사용)
│   │   │   └── users/[id]/route.ts     # 관리자 정보 수정/삭제
│   │   ├── divisions/
│   │   │   ├── route.ts                # 부수 생성
│   │   │   └── [id]/route.ts           # 부수 수정/삭제
│   │   ├── tournaments/[id]/route.ts   # 대회 수정/삭제
│   │   ├── players/
│   │   │   ├── records/route.ts        # 선수 전적 조회
│   │   │   └── search/route.ts         # 선수 검색
│   │   └── notify/route.ts             # 승인/거절 이메일 알림 (Resend)
│   └── auth/
│       ├── callback/route.ts           # OAuth 코드 교환 (Google)
│       ├── callback/naver/route.ts     # 네이버 OAuth 콜백
│       └── naver/route.ts              # 네이버 OAuth 시작점
├── components/
│   ├── layout/
│   │   ├── Header.tsx                  # 공개 페이지 헤더 (홈·대회 목록·전적 조회)
│   │   ├── AdminSidebar.tsx            # 관리자 데스크톱 사이드바
│   │   ├── MobileBottomNav.tsx         # 모바일 하단 네비 (홈·대회·전적·관리)
│   │   ├── SetupBanner.tsx             # Supabase 미설정 시 안내 배너
│   │   └── ThemeToggle.tsx             # 다크/라이트 모드 토글 버튼
│   ├── providers/
│   │   └── ThemeProvider.tsx           # next-themes ThemeProvider 클라이언트 래퍼
│   ├── tournament/
│   │   ├── TournamentCard.tsx          # 대회 카드 (목록용)
│   │   ├── BracketView.tsx             # 본선 브라켓 시각화
│   │   ├── GroupMatrix.tsx             # 예선 전적 매트릭스
│   │   ├── StandingsTable.tsx          # 조별 순위표
│   │   ├── DivisionRealtimeContent.tsx # 부수 상세 실시간 구독 클라이언트 컴포넌트
│   │   └── QnaSection.tsx              # 공개 Q&A 섹션
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
│       └── standings.ts                # 순위 계산 + 동률 감지 (hasTieAtBoundary, getTieGroups)
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
│   └── 012_tournament_regulations.sql  # tournaments.regulations 컬럼
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
  └─ division (부수, 1:N)  match_type: 'individual' | 'team'
       ├─ [개인전] player (1:N, division_id)  — confirmed, seed, group_id
       ├─ [단체전] team (1:N, division_id)    — confirmed, seed, group_id, max_teams
       │    └─ team_member (1:N, team_id)    — player_name, player_order, player_level
       └─ tournament_phase (1:N)  phase_type: 'preliminary'|'main'
            ├─ group (1:N, 리그 풀)
            │    └─ player/team (group_id로 배정)
            └─ match (1:N, round + match_number)
                  └─ match_set (세트별 점수)
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
- `user_profiles` 재귀 방지: 모든 RLS 정책은 `get_my_role()` (`002_fix_rls_recursion.sql`, SECURITY DEFINER) 사용
- `system_admin`: 모든 유저·대회 관리 가능
- `tournament_admin`: `admin_id = auth.uid() OR created_by = auth.uid()` 인 대회만 관리

### API 라우트 권한 패턴
```ts
1. supabase.auth.getUser() → user
2. user_profiles.role 조회 → system_admin 여부
3. tournament.admin_id === user.id || tournament.created_by === user.id → 소유권
```

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
`001 → 002 → 003 → 004 → 005 → 006 → 008 → 009 → 010 → 011 → 012`

> 007은 결번 (team_member_level은 009에 통합됨)
