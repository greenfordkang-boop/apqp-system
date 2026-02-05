# APQP System 배포 가이드

## 📋 전체 흐름

```
[1] Supabase 설정 → [2] GitHub 등록 → [3] Vercel 배포 → [4] 연동 확인
```

---

## 1️⃣ Supabase 설정

### Step 1.1: 프로젝트 생성

1. https://supabase.com 접속 → 로그인
2. **New Project** 클릭
3. 입력:
   - **Name**: `apqp-system`
   - **Database Password**: 강력한 비밀번호 설정 (저장해두기!)
   - **Region**: `Northeast Asia (Seoul)` 권장
4. **Create new project** 클릭 (2-3분 대기)

### Step 1.2: API 키 확보

프로젝트 생성 완료 후:

1. 좌측 메뉴 → **Settings** → **API**
2. 아래 값들을 복사해서 저장:

```
Project URL: https://xxxxx.supabase.co
anon public: eyJhbGciOiJIUzI1NiIs...  (NEXT_PUBLIC_SUPABASE_ANON_KEY)
service_role: eyJhbGciOiJIUzI1NiIs...  (SUPABASE_SERVICE_ROLE_KEY)
```

⚠️ **service_role 키는 절대 클라이언트에 노출하지 마세요!**

### Step 1.3: 데이터베이스 스키마 실행

1. 좌측 메뉴 → **SQL Editor**
2. **New query** 클릭
3. 아래 순서대로 실행:

**첫 번째: schema.sql**
```sql
-- supabase/schema.sql 내용 전체 복사 & 붙여넣기
-- Run 버튼 클릭
```

**두 번째: schema_v2.sql**
```sql
-- supabase/schema_v2.sql 내용 전체 복사 & 붙여넣기
-- Run 버튼 클릭
```

**세 번째: seed.sql (테스트 데이터)**
```sql
-- supabase/seed.sql 내용 전체 복사 & 붙여넣기
-- Run 버튼 클릭
```

### Step 1.4: 테이블 확인

1. 좌측 메뉴 → **Table Editor**
2. 아래 테이블들이 생성되었는지 확인:
   - ✅ characteristics
   - ✅ pfmea_headers
   - ✅ pfmea_lines
   - ✅ control_plans
   - ✅ control_plan_items
   - ✅ sops
   - ✅ sop_steps
   - ✅ inspection_standards
   - ✅ inspection_items
   - ✅ report_runs
   - ✅ consistency_issues
   - ✅ iatf_clause_map

---

## 2️⃣ GitHub 등록

### Step 2.1: 로컬 Git 초기화

터미널에서 프로젝트 폴더로 이동 후:

```bash
cd apqp-system

# Git 초기화
git init

# .gitignore 확인 (중요!)
cat .gitignore
```

### Step 2.2: .gitignore 확인

`.gitignore` 파일에 아래 내용이 있는지 확인:

```gitignore
# dependencies
/node_modules

# next.js
/.next/
/out/

# production
/build

# env files (중요!)
.env
.env.local
.env.*.local

# vercel
.vercel

# misc
.DS_Store
*.pem
```

### Step 2.3: GitHub 저장소 생성

1. https://github.com 접속 → 로그인
2. 우측 상단 **+** → **New repository**
3. 입력:
   - **Repository name**: `apqp-system`
   - **Description**: `APQP Quality Management System`
   - **Public** 또는 **Private** 선택
   - ❌ **Add a README file** 체크 해제 (이미 있음)
4. **Create repository** 클릭

### Step 2.4: 코드 푸시

GitHub에서 보여주는 명령어 실행:

```bash
# 모든 파일 스테이징
git add .

# 첫 커밋
git commit -m "Initial commit: APQP System with 6 APIs"

# 브랜치 이름 변경 (필요시)
git branch -M main

# 원격 저장소 연결 (your-username을 실제 GitHub 아이디로 변경)
git remote add origin https://github.com/your-username/apqp-system.git

# 푸시
git push -u origin main
```

### Step 2.5: 푸시 확인

GitHub 저장소 페이지 새로고침 → 파일 목록이 보이면 성공!

---

## 3️⃣ Vercel 배포

### Step 3.1: Vercel 연결

1. https://vercel.com 접속 → GitHub으로 로그인
2. **Add New...** → **Project**
3. **Import Git Repository**에서 `apqp-system` 선택
4. **Import** 클릭

### Step 3.2: 환경 변수 설정 (중요!)

**Configure Project** 화면에서:

1. **Environment Variables** 섹션 찾기
2. 아래 변수들 추가:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOi...` (anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi...` (service role) |
| `OPENAI_API_KEY` | `sk-...` (선택사항) |
| `OPENAI_API_BASE_URL` | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | `gpt-4o-mini` |

⚠️ **OPENAI_API_KEY 없이도 동작합니다** (Fallback 로직 있음)

### Step 3.3: 배포 실행

1. **Deploy** 버튼 클릭
2. 빌드 로그 확인 (2-3분 소요)
3. ✅ **Congratulations!** 메시지 확인

### Step 3.4: 배포 URL 확인

배포 완료 후:
- **Production URL**: `https://apqp-system-xxxx.vercel.app`

이 URL로 접속하면 앱이 동작합니다!

---

## 4️⃣ 연동 확인 테스트

### API 테스트

배포된 URL로 테스트:

```bash
# 1. SOP 생성 테스트
curl -X POST https://apqp-system-xxxx.vercel.app/api/generate/sop \
  -H "Content-Type: application/json" \
  -d '{"control_plan_id": "cp000000-0000-0000-0000-000000000001"}'

# 2. 검사기준서 생성 테스트
curl -X POST https://apqp-system-xxxx.vercel.app/api/generate/inspection \
  -H "Content-Type: application/json" \
  -d '{"control_plan_id": "cp000000-0000-0000-0000-000000000001"}'

# 3. Consistency Check 테스트
curl -X POST https://apqp-system-xxxx.vercel.app/api/check/consistency \
  -H "Content-Type: application/json" \
  -d '{"pfmea_id": "ph000000-0000-0000-0000-000000000001"}'
```

### Supabase에서 데이터 확인

1. Supabase Dashboard → **Table Editor**
2. `sops` 테이블 → 새 레코드 생성 확인
3. `sop_steps` 테이블 → 스텝 데이터 확인
4. `report_runs` 테이블 → 리포트 실행 이력 확인

---

## 🔧 문제 해결

### 빌드 실패 시

**Vercel Dashboard → Deployments → 실패한 배포 클릭 → Build Logs 확인**

흔한 오류:
1. **환경 변수 누락**: Vercel에서 환경 변수 다시 확인
2. **타입 에러**: `npm run build` 로컬에서 먼저 테스트
3. **의존성 문제**: `package-lock.json` 삭제 후 `npm install` 재실행

### API 500 에러 시

1. Vercel Dashboard → **Logs** 탭에서 에러 확인
2. 대부분 Supabase 연결 문제:
   - URL/Key 오타 확인
   - Supabase 프로젝트가 활성 상태인지 확인

### CORS 에러 시

Supabase Dashboard → **Settings** → **API** → **CORS** 설정에서:
- Vercel 도메인 추가 또는
- `*` (모든 도메인 허용)

---

## 📌 배포 후 권장 설정

### 1. 커스텀 도메인 (선택)

Vercel Dashboard → **Settings** → **Domains**에서 자체 도메인 연결 가능

### 2. Supabase RLS 활성화 (프로덕션 권장)

Row Level Security로 데이터 보호:
```sql
-- 예: 인증된 사용자만 읽기
ALTER TABLE characteristics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated read" ON characteristics
  FOR SELECT USING (auth.role() = 'authenticated');
```

### 3. 모니터링 설정

- Vercel: **Analytics** 탭 활성화
- Supabase: **Reports** → **Database** 모니터링

---

## 체크리스트

| 단계 | 항목 | 완료 |
|------|------|------|
| Supabase | 프로젝트 생성 | ☐ |
| Supabase | API 키 확보 | ☐ |
| Supabase | schema.sql 실행 | ☐ |
| Supabase | schema_v2.sql 실행 | ☐ |
| Supabase | seed.sql 실행 | ☐ |
| GitHub | 저장소 생성 | ☐ |
| GitHub | 코드 푸시 | ☐ |
| Vercel | 프로젝트 Import | ☐ |
| Vercel | 환경 변수 설정 | ☐ |
| Vercel | 배포 성공 | ☐ |
| 테스트 | API 응답 확인 | ☐ |
| 테스트 | DB 데이터 확인 | ☐ |
