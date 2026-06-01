# Smart Pingpong 로드맵

> 마지막 업데이트: 2026-06-01  
> 상태 표시: ✅ 완료 · 🔄 진행 중 · ⬜ 예정 · ❌ 보류

---

## 현재 완성된 기능

- ✅ 대회 생성 / 수정 / 상태 관리
- ✅ 부수(Division) 등록 및 관리
- ✅ 개인전 선수 등록 / 수정 / 삭제
- ✅ 조별 리그(예선) 대진표 자동 생성 — 원형법
- ✅ 단일 토너먼트(본선) 대진표 자동 생성 — 시드 브라켓
- ✅ 예선 결과 입력 및 조별 순위 자동 계산
- ✅ 예선 완료 시 본선 슬롯 자동 진출 처리
- ✅ 본선 결과 입력 및 다음 라운드 자동 승자 진출
- ✅ 예선 동률 수동 순위 조정 및 확정
- ✅ 공개 페이지 — 대회 목록 / 상세 / 결과 이력
- ✅ 예선 상대 전적 매트릭스 표시
- ✅ 본선 브라켓 뷰 (선수명 + 소속 표시)
- ✅ 관리자 인증 (Supabase Auth) 및 역할 권한 (system_admin / tournament_admin)
- ✅ Supabase 미설정 시 SetupBanner 표시로 graceful degradation

---

## 1단계 — 배포 준비 (즉시)

### 인프라 설정

| 항목 | 내용 | 상태 |
|------|------|------|
| Supabase 프로젝트 생성 | 프로덕션용 Supabase 프로젝트 신규 생성 | ⬜ |
| 마이그레이션 실행 | `001_initial_schema.sql` → `002_fix_rls_recursion.sql` 순서대로 SQL Editor 실행 | ⬜ |
| 초기 system_admin 계정 생성 | Supabase Authentication에서 첫 관리자 계정 생성 후 `user_profiles.role`을 `system_admin`으로 수동 업데이트 | ⬜ |
| Vercel 프로젝트 연결 | GitHub 저장소 연결, Framework: Next.js 자동 감지 | ⬜ |
| 환경 변수 등록 | Vercel > Settings > Environment Variables에 아래 3개 등록 | ⬜ |

**등록할 환경 변수:**
```
NEXT_PUBLIC_SUPABASE_URL       = https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = eyJ...
SUPABASE_SERVICE_ROLE_KEY      = eyJ...   ← 서버 전용, NEXT_PUBLIC_ 붙이지 말 것
```

### Supabase 프로덕션 체크리스트

| 항목 | 내용 | 상태 |
|------|------|------|
| RLS 활성화 확인 | 모든 테이블에 Row Level Security가 켜져 있는지 확인 | ⬜ |
| 공개 읽기 정책 확인 | `tournaments`, `matches`, `players` 등 공개 SELECT 정책 정상 동작 확인 | ⬜ |
| `get_my_role()` 함수 배포 | `002_fix_rls_recursion.sql` 실행 후 함수 존재 여부 확인 | ⬜ |
| 이메일 인증 설정 | Authentication > Email 설정에서 Confirm email 옵션 검토 | ⬜ |
| CORS / 허용 URL | Supabase > Authentication > URL Configuration에 배포 도메인 추가 | ⬜ |

---

## 2단계 — 버그 수정 (배포 직후)

### BUG-01 · 결과 페이지 연도 필터 하드코딩
- **파일:** `app/(public)/results/page.tsx:27`
- **문제:** 연도 목록이 2026년 이후로만 고정되어 있어 과거 대회가 연도 필터에 나타나지 않음
- **수정:** `2026` → `new Date().getFullYear()`로 변경하고, 과거 방향(최근 5년)으로 생성
```ts
// 현재 (버그)
const years = Array.from({ length: 5 }, (_, i) => 2026 + i)

// 수정
const currentYear = new Date().getFullYear()
const years = Array.from({ length: 5 }, (_, i) => currentYear - i)
```
- **상태:** ⬜

---

### BUG-02 · 대진표 재생성 시 기존 결과 무경고 삭제
- **파일:** `app/admin/tournaments/[id]/draw/page.tsx:47`
- **문제:** 이미 결과가 입력된 상태에서 대진표를 재생성하면 모든 경기 기록이 확인 없이 삭제됨
- **수정:** `generateDraw()` 실행 전 `matches` 중 `status === 'completed'`인 경기가 있으면 확인 다이얼로그 표시
```ts
if (matches.some(m => m.status === 'completed')) {
  if (!confirm('입력된 경기 결과가 있습니다. 대진표를 재생성하면 모든 결과가 삭제됩니다. 계속하시겠습니까?')) return
}
```
- **상태:** ⬜

---

### BUG-03 · 시드 번호가 대진표 생성에 미반영
- **파일:** `app/admin/tournaments/[id]/draw/page.tsx:120`
- **문제:** `players` 배열을 시드 정렬 없이 그대로 사용하여 시드 배정이 무의미함
- **수정:** `generateSeededBracket` 호출 전 `seed` 기준 정렬 적용
```ts
// 현재 (버그)
const seeded = players.map(p => p.id)

// 수정
const seeded = [...players]
  .sort((a, b) => (a.seed ?? 9999) - (b.seed ?? 9999))
  .map(p => p.id)
```
- **상태:** ⬜

---

## 3단계 — 단기 기능 개선

### FEAT-01 · 선수 일괄 등록
- **위치:** `app/admin/tournaments/[id]/players/page.tsx`
- **내용:** 텍스트 영역에 `이름,소속` 형식으로 여러 줄 붙여넣기 후 일괄 등록
- **구현 방향:**
  - 접기/펼치기 패널로 "일괄 등록" 섹션 추가
  - 줄 단위 파싱 → `supabase.from('players').insert(rows)`
  - 중복 이름 경고 표시
- **상태:** ⬜

---

### FEAT-02 · 세트별 점수 입력
- **위치:** `app/admin/tournaments/[id]/scores/page.tsx`
- **내용:** 현재 게임 수(세트 수)만 기록하지만, 실제 각 세트 점수(예: 11-9, 8-11)도 입력 가능하게
- **구현 방향:**
  - 점수 입력 모드에서 "세트별 입력" 토글 추가
  - 세트 수만큼 점수 입력 행 생성
  - `match_sets` 테이블에 저장, `score1`/`score2`는 세트 수 합산으로 자동 계산
  - 공개 페이지 브라켓 뷰에서 세트 스코어 툴팁 또는 펼치기로 표시
- **상태:** ⬜

---

### FEAT-03 · 대회 로고 이미지 업로드
- **위치:** `app/admin/tournaments/new`, `app/admin/tournaments/[id]/edit`
- **내용:** `Tournament.logo_url` 필드 활용, Supabase Storage에 업로드
- **구현 방향:**
  - Supabase Storage bucket `tournament-logos` 생성 (public read)
  - 파일 선택 → `supabase.storage.from('tournament-logos').upload()` → URL 저장
  - 공개 대회 상세 및 카드에 로고 표시
- **상태:** ⬜

---

### FEAT-04 · 커스텀 404 / 에러 페이지
- **위치:** `app/not-found.tsx`, `app/error.tsx`
- **내용:** Next.js App Router 표준 에러 파일 추가
- **상태:** ⬜

---

## 4단계 — 중장기 기능

### FEAT-05 · 단체전(팀전) 지원
- **내용:** `Team`, `TeamMember` DB 모델은 이미 존재하나 관리 UI 전무
- **구현 필요 항목:**
  - 팀 등록 / 수정 / 삭제 (`/admin/tournaments/[id]/players` 팀 탭)
  - 팀원 구성 입력 (팀당 최대 N명)
  - 팀전 결과 입력 UI (단체전 세트별 개인 경기 구조)
  - 공개 페이지 팀 브라켓 뷰
- **상태:** ⬜

---

### FEAT-06 · 실시간 결과 업데이트
- **내용:** 공개 페이지가 서버 컴포넌트로 정적 렌더링되어 경기 결과 반영에 새로고침 필요
- **구현 방향:**
  - 부수 상세 페이지(`/tournaments/[id]/divisions/[divId]`)를 클라이언트 컴포넌트로 전환
  - `supabase.channel().on('postgres_changes', ...)` 구독
  - `matches` 변경 시 자동으로 브라켓 / 순위표 갱신
- **상태:** ⬜

---

### FEAT-07 · 통합 부수(DivisionMerge) 관리 UI
- **내용:** `division_merges` 테이블과 공개 페이지 표시 영역은 있으나 관리자 UI 없음
- **구현 방향:**
  - `app/admin/tournaments/[id]/edit` 하단에 통합 부수 섹션 추가
  - 여러 부수를 하나의 이름으로 묶어 공지 표시
- **상태:** ⬜

---

### FEAT-08 · 온라인 선수 접수 기능
- **내용:** 현재 접수 기간 필드만 있고 실제 온라인 접수 불가 (관리자가 직접 등록)
- **구현 방향:**
  - 대회 상태가 `registration`일 때 공개 페이지에 접수 폼 노출
  - 이름 / 소속 / 연락처 입력 → `players` 테이블에 `confirmed: false`로 저장
  - 관리자가 접수 목록 검토 후 승인/거절
  - 문자 또는 이메일 알림 연동 (선택)
- **상태:** ⬜

---

## 버전 이력

| 버전 | 날짜 | 주요 내용 |
|------|------|-----------|
| v0.1 | 2026-06-01 | 초기 베이스라인 커밋 |
| v0.2 | 2026-06-01 | 예선 전적 매트릭스, 동률 수동 순위, 본선 선수명/소속 표시 |
