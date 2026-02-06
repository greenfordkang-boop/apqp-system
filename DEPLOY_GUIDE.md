# APQP 품질문서 관리시스템 - 배포 가이드

## 1단계: GitHub Push

VM에서 push가 안 되므로 **Mac 터미널**에서 실행하세요.

```bash
cd ~/Projects/Tool/apqp-upload
git push origin main
```

> GitHub 인증이 필요하면 Personal Access Token(PAT)을 사용하세요.
> Settings → Developer settings → Personal access tokens → Generate new token (classic)
> 권한: `repo` 체크 → 생성된 토큰을 비밀번호 대신 입력

---

## 2단계: Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 로그인 (GitHub 계정 연동 가능)
2. **New Project** 클릭
   - Organization: 본인 org 선택 (없으면 자동 생성)
   - Name: `apqp-system`
   - Database Password: 안전한 비밀번호 입력 (별도 메모)
   - Region: `Northeast Asia (Seoul)` 권장
3. 프로젝트 생성 완료까지 약 1~2분 대기

---

## 3단계: 데이터베이스 테이블 생성

1. Supabase Dashboard → 좌측 메뉴 **SQL Editor** 클릭
2. **New Query** 클릭
3. 프로젝트의 `supabase/migration.sql` 파일 내용을 **전체 복사**하여 붙여넣기
4. **Run** 클릭
5. 성공 메시지 확인 (10개 테이블 + 인덱스 + RLS 정책 + 트리거 생성)

생성되는 테이블:
| 테이블 | 설명 |
|--------|------|
| products | 제품 |
| characteristics | 특성 (Single Source of Truth) |
| pfmea_headers | PFMEA 헤더 |
| pfmea_lines | PFMEA 고장모드 항목 |
| control_plans | 관리계획서 |
| control_plan_items | 관리계획서 항목 |
| sops | 작업표준서 |
| sop_steps | 작업표준서 단계 |
| inspection_standards | 검사기준서 |
| inspection_items | 검사 항목 |

---

## 4단계: Supabase API 키 확인

1. Supabase Dashboard → **Settings** (좌측 하단 톱니바퀴) → **API**
2. 아래 두 값을 복사:
   - **Project URL**: `https://xxxxxxxx.supabase.co`
   - **anon public** key: `eyJhbGciOiJIUzI1NiIs...` (긴 문자열)

---

## 5단계: 로컬 환경변수 설정

프로젝트 루트의 `.env.local` 파일을 수정:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...실제키값...
```

로컬에서 테스트:
```bash
cd ~/Projects/Tool/apqp-upload
npm run dev
```

브라우저에서 `http://localhost:3000` 접속하여 제품 등록 → 문서 생성 테스트

---

## 6단계: Vercel 배포

### 6-1. Vercel 계정 연결

1. [vercel.com](https://vercel.com) 로그인 (GitHub 계정 연동 권장)
2. **Add New...** → **Project** 클릭
3. **Import Git Repository** → `greenfordkang-boop/apqp-system` 선택
4. **Import** 클릭

### 6-2. 프로젝트 설정

- **Framework Preset**: `Next.js` (자동 감지됨)
- **Root Directory**: `.` (기본값)
- **Build Command**: `next build` (기본값)
- **Output Directory**: `.next` (기본값)

### 6-3. 환경변수 설정 (중요!)

**Environment Variables** 섹션에서 다음 2개를 추가:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIs...실제키값...` |

### 6-4. 배포

**Deploy** 클릭 → 빌드 완료까지 약 1~2분 대기

배포 성공 시 URL 부여됨:
- `https://apqp-system.vercel.app` (또는 유사한 자동 생성 URL)

---

## 7단계: 배포 확인

1. Vercel이 제공한 URL 접속
2. 제품 등록 테스트
3. PFMEA → 관리계획서 → 작업표준서/검사기준서 생성 테스트
4. Supabase Dashboard → **Table Editor**에서 데이터 확인

---

## 커스텀 도메인 (선택사항)

Vercel Dashboard → Settings → Domains에서 커스텀 도메인 추가 가능

---

## 문제 해결

### 빌드 실패 시
- Vercel 로그에서 에러 확인
- 환경변수가 정확히 설정되었는지 확인
- `NEXT_PUBLIC_` 접두사가 빠지지 않았는지 확인

### 데이터가 안 보일 때
- Supabase Dashboard → Table Editor에서 테이블 존재 여부 확인
- migration.sql이 제대로 실행되었는지 확인
- RLS 정책이 생성되었는지 확인 (Authentication → Policies)

### CORS 에러 시
- Supabase URL이 정확한지 확인
- anon key가 올바른지 확인
