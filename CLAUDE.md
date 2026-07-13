# CLAUDE.md

이 파일은 Claude Code(claude.ai/code)가 이 저장소에서 작업할 때 참고하는 **진입점/라우터**입니다.
상세 내용은 상시 로드하지 않고, 아래 **문서 맵**을 보고 작업에 필요한 문서만 `Read`하세요.

@AGENTS.md

## 명령어

```bash
npm run dev      # 개발 서버 시작 (localhost:3000)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint 실행
```

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 16.2 (App Router, Turbopack) |
| 런타임 | React 19 |
| 스타일 | Tailwind CSS 4 |
| UI | shadcn/ui (@base-ui/react 기반) |
| 백엔드/DB | Supabase (PostgreSQL + Auth + Realtime + RLS) |
| 상태/폼 | (해당 시) react-hook-form, zod / 애니메이션 framer-motion / 토스트 sonner |
| 타입 | TypeScript (strict, **any 금지**) |

---

## 📂 문서 맵 — 작업 시 아래 문서를 먼저 Read하세요

작업 종류별로 **관련 문서 1~2개만** 읽으면 됩니다. 전체를 미리 읽지 마세요.

| 작업 종류 | 먼저 읽을 문서 |
|-----------|----------------|
| 화면(UI)·페이지 작업 | `docs/screens/README.md` → 화면ID 찾아 해당 파일 (`public` / `auth` / `admin-tournament` / `admin-etc`) |
| API·백엔드 기능 작업 | `docs/features/README.md` → 기능 찾아 해당 파일 |
| DB·테이블·마이그레이션·RLS | `docs/data-model.md` |
| 대진표 생성 / 점수 진출 / 순위 로직 | `docs/features/draw-scores.md` |
| 인증·권한 / RLS 헬퍼 / API 권한 검사 | `docs/features/auth-authz.md` |
| 대회·부수 CRUD | `docs/features/tournament-division.md` |
| 참가신청·접수·이메일 알림 | `docs/features/registration.md` |
| 랭킹·전적·레이팅 | `docs/features/ranking-records.md` |
| Q&A·Discord 알림 | `docs/features/qna-notify.md` |

> `roadmap.md` = 기능 로드맵/버전 이력 (필요 시 수동 참조).

---

## Next.js 16 필수 주의 (자주 틀리는 부분)

`params`·`searchParams`는 일반 객체가 아닌 `Promise<{...}>`입니다.

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

- `useSearchParams()`는 반드시 `<Suspense>`로 감싸야 프로덕션 빌드 통과.
- `proxy.ts`가 Next.js 16의 `middleware.ts`를 대체 — 매 요청 Supabase 세션 쿠키 갱신(리다이렉트 안 함). 인증 리다이렉트는 `app/admin/layout.tsx`에서 처리.
- 익숙한 Next.js와 다를 수 있으니, 불확실하면 `node_modules/next/dist/docs/`의 가이드를 확인 (AGENTS.md 참고).

---

## 핵심 불변 규칙 (상시 준수)

- **Supabase 가드**: 공개 서버 컴포넌트는 `createClientSafe()` 사용 + **null 체크 필수** (`supabaseConfigured` 가드). 클라이언트는 `lib/supabase/client.ts`의 `createClient()`.
- **쓰기 권한**: 대회 데이터 쓰기 RLS는 항상 `is_tournament_admin()` 기반. RLS 정책 내 `user_profiles` 직접 조회 금지 (재귀 방지 `get_my_role()` 사용). 상세 → `docs/data-model.md`.
- **타입**: `any` 금지. 도메인 타입은 `lib/types/index.ts`.
- **UI 테마**: 하드코딩 색상(`rgba(255,255,255,..)`, `border-white/N`) 금지 → CSS 토큰(`border-border`, `bg-muted`, `text-muted-foreground`). 모바일 `flex-1` select/input엔 `min-w-0` 필수.
- **언어**: 응답·주석·커밋·문서는 한국어, 변수/함수명은 영어(camelCase, PascalCase 컴포넌트), 들여쓰기 2칸.

---

## 환경 변수

```
NEXT_PUBLIC_SUPABASE_URL        # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # 공개 anon 키
SUPABASE_SERVICE_ROLE_KEY       # 서버 전용 (api/admin/* 등 service_role 필요 작업)
RESEND_API_KEY                  # (선택) 참가 승인/거절 이메일, 없으면 silent skip
DISCORD_WEBHOOK_URL             # (선택, 서버 전용) Q&A 질문 등록 알림, 없으면 silent skip
```

Supabase 미설정 시 `app/layout.tsx`가 오류 대신 `SetupBanner`를 렌더링합니다.
