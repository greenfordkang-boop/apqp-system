# APQP System API 검증 체크리스트

## 사전 준비

### 1. 환경 설정
```bash
# 1. .env.local 생성
cp .env.example .env.local

# 2. Supabase 프로젝트 생성 후 키 입력

# 3. 스키마 실행 (순서대로)
# Supabase SQL Editor에서:
# - supabase/schema.sql 실행
# - supabase/schema_v2.sql 실행
# - supabase/seed.sql 실행
```

### 2. 개발 서버 실행
```bash
cd apqp-system
npm run dev
```

---

## API 엔드포인트 목록

| API | Method | 설명 |
|-----|--------|------|
| `/api/generate/sop` | POST | SOP 생성 |
| `/api/generate/inspection` | POST | 검사기준서 생성 |
| `/api/check/consistency` | POST | 일관성 검증 |
| `/api/report/audit` | POST | 감사 대응 리포트 |
| `/api/report/iatf-map` | POST/GET | IATF 조항 매핑 |
| `/api/export/customer` | POST/GET | 고객사 포맷 변환 |

---

## SOP 생성 API 검증 (`/api/generate/sop`)

### ✅ 테스트 1: 정상 생성
```bash
curl -X POST http://localhost:3000/api/generate/sop \
  -H "Content-Type: application/json" \
  -d '{"control_plan_id": "cp000000-0000-0000-0000-000000000001"}'
```

**예상 응답:**
```json
{
  "success": true,
  "sop_id": "uuid-here",
  "steps_count": 6,
  "traceability": {
    "control_plan_id": "cp000000-0000-0000-0000-000000000001",
    "sop_id": "uuid-here",
    "linked_cp_items": ["ci000000-...", "ci000000-...", ...]
  }
}
```

**검증 포인트:**
- [ ] `success: true`
- [ ] `steps_count`가 Control Plan Items 수와 일치 (6개)
- [ ] `traceability.linked_cp_items` 배열에 모든 CP Item ID 포함

### ✅ 테스트 2: Idempotent 검증 (재호출)
```bash
# 동일한 요청 다시 실행
curl -X POST http://localhost:3000/api/generate/sop \
  -H "Content-Type: application/json" \
  -d '{"control_plan_id": "cp000000-0000-0000-0000-000000000001"}'
```

**검증 포인트:**
- [ ] `sop_id`가 첫 번째 호출과 동일
- [ ] 새로운 SOP가 생성되지 않음 (DB에서 확인)

### ✅ 테스트 3: 잘못된 Control Plan ID
```bash
curl -X POST http://localhost:3000/api/generate/sop \
  -H "Content-Type: application/json" \
  -d '{"control_plan_id": "invalid-uuid"}'
```

**예상 응답:**
```json
{
  "success": false,
  "error": "Control Plan not found: invalid-uuid"
}
```

### ✅ 테스트 4: DB에서 FK 연결 확인
```sql
-- Supabase SQL Editor에서 실행
SELECT
  ss.step_no,
  ss.action,
  ss.linked_cp_item_id,
  cpi.process_step,
  c.name AS characteristic_name
FROM sop_steps ss
JOIN control_plan_items cpi ON ss.linked_cp_item_id = cpi.id
JOIN characteristics c ON cpi.characteristic_id = c.id
ORDER BY ss.step_no;
```

**검증 포인트:**
- [ ] 모든 `sop_steps.linked_cp_item_id`가 NOT NULL
- [ ] 각 step이 올바른 CP item에 연결됨

---

## 검사기준서 생성 API 검증 (`/api/generate/inspection`)

### ✅ 테스트 1: 정상 생성
```bash
curl -X POST http://localhost:3000/api/generate/inspection \
  -H "Content-Type: application/json" \
  -d '{"control_plan_id": "cp000000-0000-0000-0000-000000000001"}'
```

**예상 응답:**
```json
{
  "success": true,
  "inspection_standard_id": "uuid-here",
  "items_count": 6,
  "traceability": {
    "control_plan_id": "cp000000-0000-0000-0000-000000000001",
    "inspection_standard_id": "uuid-here",
    "linked_cp_items": ["ci000000-...", ...]
  }
}
```

**검증 포인트:**
- [ ] `success: true`
- [ ] `items_count`가 Control Plan Items 수와 일치 (6개)

### ✅ 테스트 2: acceptance_criteria 정량화 확인
```sql
SELECT
  ii.inspection_item_name,
  ii.acceptance_criteria,
  c.lsl,
  c.usl,
  c.unit
FROM inspection_items ii
JOIN characteristics c ON ii.characteristic_id = c.id
ORDER BY ii.item_no;
```

**검증 포인트:**
- [ ] LSL/USL이 있는 특성: "9.8mm ~ 10.2mm" 형식
- [ ] 외관 특성: "한도 샘플 기준" 포함

### ✅ 테스트 3: ng_handling 필수 항목 확인
```sql
SELECT
  inspection_item_name,
  ng_handling
FROM inspection_items;
```

**검증 포인트:**
- [ ] 모든 ng_handling에 "격리" 키워드 포함
- [ ] 모든 ng_handling에 "재검" 키워드 포함
- [ ] 모든 ng_handling에 "원인분석" 또는 "분석" 키워드 포함

### ✅ 테스트 4: sampling_plan이 CP 값 반영 확인
```sql
SELECT
  ii.inspection_item_name,
  ii.sampling_plan,
  cpi.sample_size,
  cpi.frequency
FROM inspection_items ii
JOIN control_plan_items cpi ON ii.linked_cp_item_id = cpi.id;
```

**검증 포인트:**
- [ ] `sampling_plan`이 `{sample_size} / {frequency}` 형식
- [ ] CP의 값과 정확히 일치

---

## 추적성(Traceability) 통합 검증

### ✅ 전체 추적 경로 확인
```sql
SELECT * FROM traceability_view
WHERE characteristic_id IS NOT NULL
ORDER BY characteristic_name;
```

**검증 포인트:**
- [ ] Characteristic → PFMEA Line → CP Item → SOP Step 경로 존재
- [ ] Characteristic → PFMEA Line → CP Item → Inspection Item 경로 존재
- [ ] 중복된 Characteristic ID가 없음 (Single Source of Truth)

### ✅ FK 무결성 검증
```sql
-- 연결 끊어진 SOP Step 찾기
SELECT id FROM sop_steps
WHERE linked_cp_item_id NOT IN (SELECT id FROM control_plan_items);

-- 연결 끊어진 Inspection Item 찾기
SELECT id FROM inspection_items
WHERE linked_cp_item_id NOT IN (SELECT id FROM control_plan_items);

-- 연결 끊어진 Characteristic 찾기
SELECT id FROM inspection_items
WHERE characteristic_id NOT IN (SELECT id FROM characteristics);
```

**검증 포인트:**
- [ ] 위 쿼리 모두 0건 반환

---

## LLM Fallback 검증

### ✅ LLM 없이 동작 확인
```bash
# .env.local에서 OPENAI_API_KEY 제거 또는 빈값 설정
OPENAI_API_KEY=

# API 호출
curl -X POST http://localhost:3000/api/generate/sop \
  -H "Content-Type: application/json" \
  -d '{"control_plan_id": "cp000000-0000-0000-0000-000000000001"}'
```

**검증 포인트:**
- [ ] API가 에러 없이 성공 응답
- [ ] SOP Steps가 규칙 기반 기본값으로 생성됨
- [ ] key_point에 관리 포인트, 확인 방법, 이상 조치 모두 포함

---

---

## Consistency Check API (`/api/check/consistency`)

### ✅ 테스트: 전체 검증
```bash
curl -X POST http://localhost:3000/api/check/consistency \
  -H "Content-Type: application/json" \
  -d '{"pfmea_id": "ph000000-0000-0000-0000-000000000001"}'
```

**검증 포인트:**
- [ ] `success: true`
- [ ] `result.issues` 배열 반환
- [ ] `result.summary` 에 HIGH/MEDIUM/LOW 카운트
- [ ] 6가지 규칙 동작 확인:
  - Rule 1 (HIGH): 고위험 PFMEA - CP 누락
  - Rule 2 (HIGH): CP - SOP 누락
  - Rule 3 (HIGH): CP - 검사기준서 누락
  - Rule 4 (MED): 샘플링 불일치
  - Rule 5 (MED): key_point 누락
  - Rule 6 (LOW): 수치 미표기

---

## 감사 대응 리포트 API (`/api/report/audit`)

### ✅ 테스트: 리포트 생성
```bash
curl -X POST http://localhost:3000/api/report/audit \
  -H "Content-Type: application/json" \
  -d '{"pfmea_id": "ph000000-0000-0000-0000-000000000001"}'
```

**검증 포인트:**
- [ ] `markdown` 필드에 마크다운 문서 포함
- [ ] 6개 섹션 존재 (개요/구조/추적성/검증/통제/결론)
- [ ] "AI가 판단" 문구 없음

---

## IATF 조항 매핑 API (`/api/report/iatf-map`)

### ✅ 테스트: 매핑 리포트
```bash
curl -X POST http://localhost:3000/api/report/iatf-map \
  -H "Content-Type: application/json" \
  -d '{"pfmea_id": "ph000000-0000-0000-0000-000000000001"}'
```

**검증 포인트:**
- [ ] `markdown` 필드에 매핑 표 포함
- [ ] 조항별 상태 (Full/Partial/Gap) 표시
- [ ] Gaps & Actions 포함

---

## 고객사 변환 API (`/api/export/customer`)

### ✅ 테스트: JSON 변환
```bash
curl -X POST http://localhost:3000/api/export/customer \
  -H "Content-Type: application/json" \
  -d '{"control_plan_id": "cp000000-0000-0000-0000-000000000001"}'
```

### ✅ 테스트: CSV 변환
```bash
curl -X POST http://localhost:3000/api/export/customer \
  -H "Content-Type: application/json" \
  -d '{"control_plan_id": "cp000000-0000-0000-0000-000000000001", "output_format": "csv"}'
```

**검증 포인트:**
- [ ] `payload` 배열에 변환된 데이터
- [ ] `csv` 필드에 CSV 문자열 (format=csv)
- [ ] 컬럼명 영문 변환됨

---

## 최종 체크리스트 요약

| API | 정상 동작 | 에러 처리 | DB 저장 |
|-----|----------|----------|--------|
| SOP 생성 | ☐ | ☐ | ☐ |
| 검사기준서 생성 | ☐ | ☐ | ☐ |
| Consistency Check | ☐ | ☐ | ☐ |
| 감사 리포트 | ☐ | ☐ | ☐ |
| IATF 매핑 | ☐ | ☐ | ☐ |
| 고객사 변환 | ☐ | ☐ | ☐ |
