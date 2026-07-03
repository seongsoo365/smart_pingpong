# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 가이드입니다.

@AGENTS.md
@ARCHITECT.md

## 명령어

```bash
npm run dev      # 개발 서버 시작 (localhost:3000)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint 실행
```

## 기술 스택

Next.js 16.2 (App Router) + React 19 + Tailwind CSS 4 + Supabase (PostgreSQL + Auth + SSR).

## Next.js 16 비동기 params

Next.js 16에서 `params`와 `searchParams`는 일반 객체가 아닌 `Promise<{...}>`입니다. 이전 버전과의 호환성을 깨는 변경 사항입니다.

- **서버 컴포넌트 / API 라우트**: `const { id } = await params`
- **클라이언트 컴포넌트**: `const { id } = use(params)` (React의 `use()` 훅) — 또는 `next/navigation`의 `useParams()` 사용

```ts
// 서버 컴포넌트
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}

// 클라이언트 컴포넌트
import { use } from 'react'
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)   // 또는: const { id } = useParams<{ id: string }>()
}

// API 라우트
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
}
```

## 아키텍처

### 라우트 구조

- `app/(public)/` — 비인증 페이지 (홈, 대회 목록/상세, 일회성 게임 기록 등록, 선수 전적); 서버 컴포넌트
- `app/(public)/games/new/` — 일회성 게임 기록 등록 (로그인 불필요, 약식/세트별 모드); 등록 성공 시 게임 ID를 `localStorage['my_casual_games']`에 저장하고 하단에 "내가 등록한 기록" 목록 표시
- `app/admin/` — 보호된 페이지; `app/admin/layout.tsx`에서 인증 리다이렉트 처리
- `app/admin/games/` — 일회성 게임 관리 (목록, 등록/수정/삭제)
- `app/auth/login/` — 로그인 페이지
- `app/(public)/tournaments/[id]/my-registration/` — 신청 정보 수정 페이지 (미승인 상태일 때만 접근 가능, 이름·부수 변경)
- `app/admin/qna/` — 메인 Q&A 관리 페이지 (미답변·답변완료 목록, 답변 저장, 공개/비공개 토글, 삭제)
- `app/api/` — API 라우트: `/admin/create-user`, `/tournaments/[id]`, `/tournaments/[id]/admins`(공동 관리자 GET/POST), `/tournaments/[id]/admins/[userId]`(공동 관리자 DELETE), `/divisions`, `/divisions/[id]`, `/games`(GET `?ids=` 파라미터로 특정 ID 필터 지원), `/games/[id]`, `/players/records`, `/players/search`

### Supabase 클라이언트 패턴

서버 컴포넌트는 반드시 `lib/supabase/server.ts`의 `createClientSafe()`를 사용해야 합니다 — 환경 변수가 없으면 `null`을 반환하여 공개 페이지가 graceful하게 동작합니다. 클라이언트 컴포넌트는 `lib/supabase/client.ts`의 `createClient()`를 사용합니다.

`supabaseConfigured`(`lib/supabase/server.ts`에서 export)는 불리언 가드입니다. Supabase 없이도 접근 가능해야 하는 서버 페이지에서는 Supabase 호출 전에 반드시 확인하세요.

### 인증 흐름

`proxy.ts`는 Next.js 16에서 `middleware.ts`를 대체합니다 — 모든 요청마다 Supabase 세션 쿠키를 갱신하며, Supabase가 설정되지 않으면 즉시 종료됩니다. 리다이렉트는 하지 않으며, 인증 리다이렉트는 레이아웃 파일(`app/admin/layout.tsx`)에 위치합니다.

### RLS / 역할

두 개의 SECURITY DEFINER 헬퍼 함수로 재귀 방지:
- `get_my_role()` — `user_profiles` 조회 재귀 방지 (`002_fix_rls_recursion.sql`)
- `is_tournament_admin(tournament_id)` — 대회 관리 권한 통합 판별 (`019_tournament_co_admins.sql`): `admin_id`, `created_by`, `tournament_admins` 테이블, `system_admin` 중 하나라도 해당하면 `true`

RLS 정책 내에서 `user_profiles`를 직접 조회하지 마세요. 대회 쓰기 권한은 반드시 `is_tournament_admin()`을 사용하세요.

역할: `system_admin`(전체 관리), `tournament_admin`(자기 대회 + 공동 관리자로 초대된 대회). 모든 대회 데이터는 인증 없이 공개 읽기 가능합니다.

**신청자 자기수정**: `players` / `teams` / `team_members`의 `confirmed = false` 레코드는 비인증 사용자도 UPDATE/DELETE 가능 (`018_registration_self_edit.sql`). UUID가 사실상 비밀번호 역할.

### API 라우트 권한 검사 패턴

API 라우트는 수동으로 소유권을 확인합니다 — 관리자 라우트에 별도의 인증 미들웨어가 없습니다. 패턴은 다음과 같습니다:
1. `supabase.auth.getUser()`로 `user` 취득
2. `user_profiles.role`을 조회하여 `system_admin` 여부 확인
3. `tournament.admin_id/created_by` 또는 `tournament_admins` 테이블로 소유권 확인
4. `admin_id` 변경(위임)은 `created_by` 또는 `system_admin`만 허용

### Q&A 데이터 모델

#### 대회 Q&A (`tournament_questions`)

대회에 직접 연결됩니다 (부수와 무관). 이메일 필드 없음.

- **공개 방문자**: `answer IS NOT NULL AND is_public = TRUE` 인 행만 SELECT, INSERT는 누구나 가능
- **대회 소유자(admin_id / created_by)**: 전체 SELECT, UPDATE(답변 저장), DELETE 가능
- 관리자 페이지(`app/admin/tournaments/[id]/qna/page.tsx`)에서 답변 저장 시 `answered_by`(auth.uid), `answered_at`도 함께 저장
- 공개 컴포넌트: `components/tournament/QnaSection.tsx` (클라이언트 컴포넌트, 공개 대회 상세 페이지에 임베드)

#### 메인 Q&A (`main_questions`)

대회와 무관한 사이트 공통 Q&A. 마이그레이션: `020_main_qna.sql`, `022_drop_main_qna_email.sql`.

- **공개 방문자**: `answer IS NOT NULL AND is_public = TRUE` 인 행만 SELECT, INSERT 비인증 허용
- **system_admin 전용**: 전체 SELECT, UPDATE(답변 저장 + is_public 토글), DELETE 가능
- 관리자 페이지: `app/admin/qna/page.tsx` (미답변·답변완료 목록, 답변 저장, 공개/비공개 토글, 삭제)
- 공개 컴포넌트: `components/MainQnaSection.tsx` (클라이언트 컴포넌트, 홈 페이지 하단 임베드)
- AdminSidebar에 "Q&A 관리" 메뉴 항목 추가 완료, 대시보드에 미답변 카운트 표시

### 대회 데이터 모델

```
tournament (대회)
  ├─ tournament_questions (Q&A, 1:N)
  ├─ tournament_admins (공동 관리자, N:M) — user_id, added_by, added_at
  └─ division (부수, 1:N)  ← match_type: 'individual' | 'team'
       ├─ [개인전] player (선수, 1:N, player.division_id)
       ├─ [단체전] team (팀, 1:N, team.division_id)
       │    └─ team_member (팀원, 1:N, team_member.team_id)
       └─ tournament_phase (단계, 1:N, phase_type: 'preliminary'예선 | 'main'본선)
            ├─ group (조, 1:N, 리그 풀)
            │    └─ player / team  (group_id로 배정)
            └─ match (경기, 1:N, round + match_number로 위치 식별)
                  └─ match_set (세트별 점수)
```

모든 대진 라운드는 추첨 시점에 미리 생성됩니다. 2라운드 이후 경기는 참가자 슬롯이 null로 시작하며, 승자가 진출하면 채워집니다 — 아래 점수 진출 처리 항목 참고.

### 관리자 대회 운영 흐름

대회 생성 → 부수 추가(추첨 전에 각 부수에 `tournament_phase` 행 필요) → 부수별 선수/팀 등록 → 대진표 생성 → 결과 입력.

**개인전/단체전 등록 분기** (`app/admin/tournaments/[id]/players/page.tsx`):
- `division.match_type === 'individual'`이면 `players` 테이블 CRUD (선수 목록, 개별 추가, 일괄 등록, 시드)
- `division.match_type === 'team'`이면 `teams` + `team_members` 테이블 CRUD (팀 목록, 팀 추가, 팀원 수정, 시드)
- 팀원 수 제약은 `division.team_match_format`을 `TEAM_SIZE` 맵으로 조회하여 min/max 적용
- 부수 탭 버튼에 "단체" 레이블을 표시해 구분

`tournament_phases`는 `format`(round_robin / single_elimination), `games_per_match`, `points_per_game`, `advancement_count`를 정의합니다. 대진 페이지에서 브라켓을 생성하려면 이 값들이 미리 존재해야 합니다.

### 대진표 생성 및 점수 진출 처리 방식

**대진표 생성** (`app/admin/tournaments/[id]/draw/page.tsx`):
- 재생성 전에 기존 경기와 조를 모두 삭제
- 예선 단계가 있는 경우: 원형법(circle method) 리그로 조를 생성한 후, 본선 전체 라운드를 빈(TBD) 슬롯으로 미리 생성
- 예선 없는 경우: 1라운드에 `generateSeededBracket()` 적용, 나머지 라운드를 미리 생성하고 부전승 선수를 즉시 2라운드 슬롯에 채움

**점수 저장** (`app/admin/tournaments/[id]/scores/page.tsx`):
- 본선 경기 결과 저장 시 승자를 다음 라운드 해당 슬롯에 자동으로 채움
- 예선 조의 모든 경기가 완료되면 `checkPrelimAdvancement()`가 실행되어 순위에 따라 본선 1라운드 슬롯을 채움
- 경계에 동률이 있으면 자동 진출을 차단하고 수동 순위 확정 UI를 표시
- `loadData()` 호출마다 본선 부전승 전파도 재확인

### 브라켓 및 일정 유틸리티

- `lib/utils/bracket.ts` — 시드 단일 토너먼트. `generateSeededBracket(ids)`는 `[p1|null, p2|null][]` 반환; `null`은 부전승. `getBracketRounds(n)`과 `nextPowerOfTwo(n)`으로 전체 라운드를 한 번에 미리 생성.
- `lib/utils/roundrobin.ts` — 원형법 일정 생성; `distributeIntoGroups(players, n)`은 뱀 시드 방식 사용.
- `lib/utils/standings.ts` — 승수 → 세트 득실 → 점수 득실 순으로 순위 계산. `hasTieAtBoundary()`와 `getTieGroups()`로 동률 감지.
- `lib/utils/myGames.ts` — 비로그인 사용자가 등록한 게임 ID를 `localStorage`에 보관. `addMyGame(id)` / `getMyGameIds()` / `removeMyGame(id)`. SSR 환경에서 안전하게 동작(`typeof window` 가드 포함).
- `lib/utils/myRegistrations.ts` — 비로그인 사용자의 대회 신청 ID를 `localStorage['my_registrations']`에 보관. `addMyRegistration({id, type, tournament_id})` / `getMyRegistrations()` / `getMyRegistrationsByTournament(tournamentId)` / `removeMyRegistration(id)`.

### 컴포넌트

- `components/ui/` — shadcn 스타일 기본 컴포넌트 (Button, Card, Badge, Tabs, Dialog 등)
- `components/layout/` — `Header`, `AdminSidebar`, `MobileBottomNav`, `SetupBanner`
- `components/MainQnaSection.tsx` — 홈 페이지용 메인 Q&A (질문 목록 + 등록 폼, 비인증 허용, `main_questions` 테이블)
- `components/tournament/` — `TournamentCard`, `StandingsTable`, `BracketView`, `GroupMatrix`, `QnaSection`, `MyGameHistory`(내가 등록한 일회성 게임 목록, localStorage 기반), `MyRegistrationStatus`(내 신청 내역 표시 + 수정/취소 버튼, 대회 상세 페이지에 임베드)

### UI 규칙

다크 테마: `#0F172A` 배경, `#3B82F6` 기본색(primary), `#F97316` 강조색(accent). 글래스 카드는 `glass` CSS 유틸리티 사용(`rgba(255,255,255,0.05) + backdrop-blur`). 토스트 알림은 `sonner`. 모바일 우선 레이아웃: 모바일에서는 `MobileBottomNav`, 데스크톱에서는 `AdminSidebar`.

## 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # /api/admin/create-user에서만 사용
```

Supabase가 설정되지 않은 경우, `app/layout.tsx`는 오류 대신 안내 메시지가 포함된 `SetupBanner`를 렌더링합니다.
