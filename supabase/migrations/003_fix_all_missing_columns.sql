-- ================================================
-- Fix: 코드와 DB 스키마 불일치 전체 수정
-- 문제: schema.sql 기반 DB에 migration.sql 기반 코드 컬럼 누락
-- ================================================

-- 1. sop_steps - 누락 3개 컬럼
ALTER TABLE sop_steps ADD COLUMN IF NOT EXISTS process_step TEXT NOT NULL DEFAULT '';
ALTER TABLE sop_steps ADD COLUMN IF NOT EXISTS quality_point TEXT NOT NULL DEFAULT '';
ALTER TABLE sop_steps ADD COLUMN IF NOT EXISTS tools_equipment TEXT NOT NULL DEFAULT '';

-- 2. inspection_items - 누락 6개 컬럼 + 컬럼명 변경
ALTER TABLE inspection_items ADD COLUMN IF NOT EXISTS measurement_tool TEXT NOT NULL DEFAULT '';
ALTER TABLE inspection_items ADD COLUMN IF NOT EXISTS specification TEXT NOT NULL DEFAULT '';
ALTER TABLE inspection_items ADD COLUMN IF NOT EXISTS lsl NUMERIC;
ALTER TABLE inspection_items ADD COLUMN IF NOT EXISTS usl NUMERIC;
ALTER TABLE inspection_items ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT '';
ALTER TABLE inspection_items ADD COLUMN IF NOT EXISTS inspection_type TEXT NOT NULL DEFAULT 'in-process'
  CHECK (inspection_type IN ('incoming', 'in-process', 'final', 'outgoing'));

-- 3. control_plans - product_id 누락
ALTER TABLE control_plans ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE;

-- 4. sops - product_id 누락
ALTER TABLE sops ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE;

-- 5. inspection_standards - product_id 누락
ALTER TABLE inspection_standards ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id) ON DELETE CASCADE;

-- 6. 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
