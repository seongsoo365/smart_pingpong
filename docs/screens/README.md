# 화면 요구사항정의서 — 인덱스

> **에이전트 진입점.** 화면(UI) 작업 시 아래 표에서 화면ID를 찾아 **해당 파일 1개만 Read**하세요.
> 각 화면 섹션은 `경로 / 파일 / 유형 / 접근권한` 표와 `주요 기능·입력 항목·처리 흐름·연동 API/테이블·주요 컴포넌트·주의사항` 항목으로 구성됩니다.

전체 화면 28개. 라우트 그룹별로 4개 문서로 분할.

## 공개 화면 → [`public.md`](./public.md)

| 화면ID | 화면명 | 경로 |
|--------|--------|------|
| PUB-01 | 홈 | `/` |
| PUB-02 | 대회 목록 | `/tournaments` |
| PUB-03 | 대회 상세 | `/tournaments/[id]` |
| PUB-04 | 부수 상세(대진/순위 실시간) | `/tournaments/[id]/divisions/[divId]` |
| PUB-05 | 참가 신청 | `/tournaments/[id]/register` |
| PUB-06 | 내 신청정보 조회/수정 | `/tournaments/[id]/my-registration` |
| PUB-07 | 선수 랭킹 | `/rankings` |
| PUB-08 | 선수 전적 조회 | `/players` |
| PUB-09 | 일회성 게임 등록 | `/games/new` |

## 인증 화면 → [`auth.md`](./auth.md)

| 화면ID | 화면명 | 경로 |
|--------|--------|------|
| AUTH-01 | 로그인 | `/login` |
| AUTH-02 | 관리자 가입 | `/register` |
| AUTH-03 | 이메일 인증 | `/register/verify` |
| AUTH-04 | 비밀번호 찾기 | `/forgot-password` |
| AUTH-05 | 비밀번호 재설정 | `/reset-password` |
| AUTH-06 | 카카오 OAuth 콜백 | `/auth/kakao/complete` |
| AUTH-07 | 네이버 OAuth 콜백 | `/auth/naver/complete` |

## 관리자 대회운영 화면 → [`admin-tournament.md`](./admin-tournament.md)

| 화면ID | 화면명 | 경로 |
|--------|--------|------|
| ADM-T01 | 대회 등록 | `/admin/tournaments/new` |
| ADM-T02 | 대회 정보 수정/부수관리/삭제 | `/admin/tournaments/[id]/edit` |
| ADM-T03 | 선수/팀 관리 | `/admin/tournaments/[id]/players` |
| ADM-T04 | 대진표 생성 | `/admin/tournaments/[id]/draw` |
| ADM-T05 | 경기 결과 입력 | `/admin/tournaments/[id]/scores` |
| ADM-T06 | 참가 접수 관리 | `/admin/tournaments/[id]/registrations` |

> 대진표 생성·점수 진출 **비즈니스 로직 상세**는 화면 문서가 아니라 [`../features/draw-scores.md`](../features/draw-scores.md) 참고.

## 관리자 기타 화면 → [`admin-etc.md`](./admin-etc.md)

| 화면ID | 화면명 | 경로 |
|--------|--------|------|
| ADM-E01 | 관리자 대시보드 | `/admin` |
| ADM-E02 | 대회별 Q&A 관리 | `/admin/tournaments/[id]/qna` |
| ADM-E03 | 메인 Q&A 관리 | `/admin/qna` |
| ADM-E04 | 일회성 게임 관리 | `/admin/games` |
| ADM-E05 | 시스템 회원 관리 | `/admin/system/users` |
| ADM-E06 | 비밀번호 변경 | `/admin/change-password` |

---

## 공통 UI 규칙 (모든 화면 공통)

- **테마**: `next-themes` 다크/라이트. 하드코딩 색상(`rgba(255,255,255,..)`, `border-white/N`) 금지 → `border-border`, `bg-muted`, `text-muted-foreground` 등 CSS 토큰 사용.
- **색상 토큰**: Primary `#3B82F6`, Accent `#F97316`. 글래스 카드는 `.glass` 유틸.
- **레이아웃**: 모바일 `MobileBottomNav`, 데스크톱 `AdminSidebar`(관리자)/`Header`(공개).
- **토스트**: `sonner`.
- **모바일 flex 주의**: `flex` 행 안의 `flex-1` `<select>`/`<input>`에는 반드시 `min-w-0`을 함께 지정 (미지정 시 `overflow-hidden` 카드에서 잘려 안 보이는 버그).
- **컴포넌트**: `components/ui/*`(shadcn 프리미티브), `components/tournament/*`(도메인), `components/layout/*`.
