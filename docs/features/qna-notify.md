# 기능 정의서 — Q&A · 알림 (백엔드)

> 대회 Q&A와 사이트 공통(메인) Q&A, 그리고 질문 등록 시 Discord 알림. 읽기/쓰기 접근 제어는 대부분 **Supabase RLS**로 이뤄지고, 클라이언트/관리자 컴포넌트는 테이블을 직접 CRUD한다. 알림만 API 라우트를 통한다.
>
> 포함 기능ID: **FEAT-QNA-01**(대회 Q&A) · **FEAT-QNA-02**(메인 Q&A) · **FEAT-QNA-03**(Q&A 등록 Discord 알림)

---

## FEAT-QNA-01 대회 Q&A

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | 테이블 `tournament_questions` (RLS 직접 접근). 공개: `components/tournament/QnaSection.tsx`. 관리: `app/admin/tournaments/[id]/qna/page.tsx` |
| 관련 함수 | 마이그레이션 `010_qna.sql`, `021_drop_qna_email.sql`, `025_qna_show_unanswered.sql` |
| 권한 | 조회: 공개(`is_public`). 등록: 누구나. 답변/수정/삭제: 대회 소유자(admin_id·created_by) 또는 system_admin |

- **역할**: 특정 대회에 귀속된 질문/답변. 부수와 무관하며 이메일 필드 없음.
- **입력/출력**:
  - 등록(`QnaSection.handleSubmit`): `insert { tournament_id, author_name, question }` → 성공 시 목록에 즉시 반영 + toast + Discord 알림(fire-and-forget, `source:'tournament'`).
  - 답변(`admin .../qna/page.tsx saveAnswer`): `update { answer, answered_by: auth.uid, answered_at }` → `load()` 재조회.
  - 공개/비공개 토글(`togglePublic`): `update { is_public: !is_public }`. 삭제(`deleteQuestion`): `delete`.
- **비즈니스 규칙 (RLS)**:
  - `qna_public_read`(SELECT): **`is_public = TRUE`** 인 행 노출 — `025` 이후 **답변 여부와 무관**하게 질문 등록 즉시 목록에 표시(답변 전에는 "답변 대기" 배지). `010` 원본은 `answer IS NOT NULL AND is_public`였음.
  - `qna_public_insert`(INSERT): `WITH CHECK (TRUE)` — 비인증 포함 누구나 질문 등록.
  - `qna_admin_read`/`qna_admin_update`/`qna_admin_delete`: `auth.uid()` 존재 && (`get_my_role()='system_admin'` OR 해당 대회 `admin_id/created_by = auth.uid()`). 소유자는 비공개·미답변 포함 전체 열람·수정·삭제.
- **관련 테이블**: `tournament_questions`(id, tournament_id FK→tournaments ON DELETE CASCADE, author_name, question, answer, answered_by→auth.users, answered_at, is_public 기본 TRUE, created_at). `author_email`은 `021`에서 제거.
- **주의사항**:
  - 관리 페이지는 미답변/답변완료 목록 분리, 상단에 카운트 표시. 답변 저장 시 `answered_by`에 현재 `auth.uid()` 기록.
  - RLS 정책은 대회 소유자 판별에 `admin_id/created_by`만 확인(공동 관리자 `tournament_admins`는 이 Q&A 정책에 포함되지 않음 — `010`/`025` 기준).

---

## FEAT-QNA-02 메인 Q&A

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | 테이블 `main_questions` (RLS 직접 접근). 공개: `components/MainQnaSection.tsx`(홈 하단). 관리: `app/admin/qna/page.tsx` |
| 관련 함수 | 마이그레이션 `020_main_qna.sql`, `022_drop_main_qna_email.sql`, `025_qna_show_unanswered.sql` |
| 권한 | 조회: 공개(`is_public`). 등록: 누구나. 관리(답변/토글/삭제): **system_admin 전용** |

- **역할**: 대회와 무관한 사이트 공통 Q&A.
- **입력/출력**:
  - 등록(`MainQnaSection.handleSubmit`): `insert { author_name, question }` → 목록 반영 + toast + Discord 알림(`source:'main'`).
  - 답변(`admin/qna saveAnswer`): `update { answer, answered_by: auth.uid, answered_at }` → `load()`.
  - 공개/비공개 토글, 삭제 지원. 대시보드(`app/admin/page.tsx`)에 미답변 카운트 표시.
- **비즈니스 규칙 (RLS)**:
  - `main_qna_public_read`(SELECT): **`is_public = TRUE`** (`025` 이후 답변 여부 무관, `020` 원본은 `answer IS NOT NULL AND is_public`).
  - `main_qna_public_insert`(INSERT): `WITH CHECK (TRUE)` — 비인증 등록 허용.
  - `main_qna_admin_all`(ALL): `get_my_role() = 'system_admin'` — system_admin만 전체 SELECT/UPDATE/DELETE.
- **관련 테이블**: `main_questions`(id, author_name, question, answer, answered_by→auth.users, answered_at, is_public 기본 TRUE, created_at). `author_email`은 `022`에서 제거.
- **주의사항**: 대회 Q&A와 UI·동작이 거의 동일하나 관리 권한이 `admin_id`가 아니라 `system_admin`으로 한정됨.

---

## FEAT-QNA-03 Q&A 등록 Discord 알림

| 항목 | 내용 |
|------|------|
| 엔드포인트/위치 | `POST /api/notify/discord` (`app/api/notify/discord/route.ts`) |
| 관련 함수 | 호출부: `QnaSection.tsx`, `MainQnaSection.tsx` (질문 INSERT 직후 fire-and-forget) |
| 권한 | 공개 호출(별도 인증 없음). 실제 전송은 서버 환경변수 `DISCORD_WEBHOOK_URL`에 의존 |

- **역할**: 메인/대회 Q&A 질문이 등록되면 사이트 공통 Discord 채널에 알림 embed를 전송. 실패해도 질문 등록에는 영향 없음.
- **입력** (JSON body `DiscordNotifyPayload`): `{ source: 'main'|'tournament', tournamentId?, authorName, question, pageUrl? }`. `source`/`authorName`/`question` 누락 시 400, JSON 파싱 실패 시 400.
- **출력 / 부수효과**:
  - `DISCORD_WEBHOOK_URL` 미설정 시 즉시 `{ ok: true, skipped: true }`로 조용히 종료(전송 안 함).
  - 설정 시 웹훅으로 embed POST(제목 "📩 새 Q&A 질문", color `0x3B82F6`, 필드: 구분/작성자/질문(1000자 컷), timestamp, `pageUrl` 있으면 embed url). 전송 실패는 `console.error`만 하고 `{ ok: true }` 반환.
- **비즈니스 규칙**:
  - 구분 텍스트: `main` → "메인 Q&A". `tournament` → "대회 Q&A", `tournamentId`가 있으면 `tournaments.name`을 조회해 "대회 Q&A · {대회명}"으로 보강(`createClientSafe`, 실패 시 기본 문구 유지).
  - 호출부는 질문 INSERT **성공 직후** `fetch('/api/notify/discord', ...).catch(() => {})`로 fire-and-forget(응답 대기·에러 무시).
- **관련 테이블**: 읽기 `tournaments`(name, 선택적). 쓰기 없음.
- **주의사항**: 대회별 웹훅은 없고 사이트 전체 공통 1개(`DISCORD_WEBHOOK_URL`, 서버 전용). 알림 실패가 사용자 질문 등록 UX를 절대 막지 않도록 설계됨.
