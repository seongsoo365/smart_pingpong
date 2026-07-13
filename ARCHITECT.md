# ARCHITECT.md — Smart Pingpong 아키텍처 (포인터)

> 이 문서의 상세 내용은 컨텍스트 절감을 위해 **`docs/` 로 분산 이전**되었습니다.
> `CLAUDE.md`는 더 이상 이 파일을 `@import` 하지 않습니다. 작업 시 아래 문서 맵에서 필요한 것만 `Read` 하세요.

## 프로젝트 개요

탁구 대회 운영·관리 웹 서비스. 대회 개최 → 참가 신청 접수 → 대진표 생성 → 경기 결과 입력 → 순위/전적 조회까지 전 과정을 온라인 처리.

기술 스택: **Next.js 16.2 (App Router, Turbopack) + React 19 + Tailwind CSS 4 + shadcn/ui + Supabase(PostgreSQL/Auth/Realtime/RLS)**, TypeScript strict.

## 문서 맵

| 주제 | 문서 |
|------|------|
| 화면(UI) 요구사항정의서 | `docs/screens/README.md` → `public` / `auth` / `admin-tournament` / `admin-etc` |
| 백엔드 기능 정의서 | `docs/features/README.md` → 도메인별 파일 |
| 데이터 모델(ERD·테이블·RLS·마이그레이션) | `docs/data-model.md` |
| 대진표/점수/순위 로직 | `docs/features/draw-scores.md` |
| 인증·권한 | `docs/features/auth-authz.md` |
| 기능 로드맵/버전 이력 | `roadmap.md` |

## 디렉터리 구조 (요약)

```
app/
  (public)/   비인증 공개 페이지 (서버 컴포넌트 중심) — 화면 상세: docs/screens/public.md
  (auth)/     로그인·가입·비밀번호 — 화면 상세: docs/screens/auth.md
  auth/       소셜 OAuth 콜백(kakao/naver) 및 라우트 핸들러
  admin/      보호된 관리자 페이지 (layout.tsx 인증 가드) — docs/screens/admin-*.md
  api/        최소 API 라우트 (service_role/외부연동/집계) — docs/features/*
components/   layout · tournament · admin · providers · ui(shadcn)
lib/          supabase(server/client) · types · utils(bracket/roundrobin/standings/rating/…)
supabase/migrations/  001~026 순서 실행 — docs/data-model.md
proxy.ts      Next.js 16 middleware 대체 (세션 쿠키 갱신)
```

핵심 규칙·주의사항은 `CLAUDE.md`(상시 로드)에 요약되어 있습니다.
