-- ================================================
-- APQP v2 마이그레이션 - 차종/품번/문서번호/작성자 추가
-- Supabase SQL Editor에서 실행하세요
-- ================================================

-- 1. products 테이블에 차종, 품번 추가
ALTER TABLE products ADD COLUMN IF NOT EXISTS vehicle_model TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS part_number TEXT NOT NULL DEFAULT '';

-- 2. 모든 문서 헤더에 문서번호, 작성자 추가
ALTER TABLE pfmea_headers ADD COLUMN IF NOT EXISTS doc_number TEXT NOT NULL DEFAULT '';
ALTER TABLE pfmea_headers ADD COLUMN IF NOT EXISTS author TEXT NOT NULL DEFAULT '';

ALTER TABLE control_plans ADD COLUMN IF NOT EXISTS doc_number TEXT NOT NULL DEFAULT '';
ALTER TABLE control_plans ADD COLUMN IF NOT EXISTS author TEXT NOT NULL DEFAULT '';

ALTER TABLE sops ADD COLUMN IF NOT EXISTS doc_number TEXT NOT NULL DEFAULT '';
ALTER TABLE sops ADD COLUMN IF NOT EXISTS author TEXT NOT NULL DEFAULT '';

ALTER TABLE inspection_standards ADD COLUMN IF NOT EXISTS doc_number TEXT NOT NULL DEFAULT '';
ALTER TABLE inspection_standards ADD COLUMN IF NOT EXISTS author TEXT NOT NULL DEFAULT '';

-- 3. 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
