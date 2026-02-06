-- ================================================
-- APQP 품질문서 관리시스템 - Supabase 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- ================================================

-- 1. 제품 (Products)
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  customer TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 특성 (Characteristics) - Single Source of Truth
CREATE TABLE IF NOT EXISTS characteristics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('product', 'process')),
  category TEXT NOT NULL CHECK (category IN ('critical', 'major', 'minor')),
  specification TEXT NOT NULL DEFAULT '',
  lsl NUMERIC,
  usl NUMERIC,
  unit TEXT NOT NULL DEFAULT '',
  measurement_method TEXT NOT NULL DEFAULT '',
  process_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. PFMEA 헤더
CREATE TABLE IF NOT EXISTS pfmea_headers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  process_name TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. PFMEA 라인 (고장모드 항목)
CREATE TABLE IF NOT EXISTS pfmea_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pfmea_id UUID NOT NULL REFERENCES pfmea_headers(id) ON DELETE CASCADE,
  characteristic_id UUID NOT NULL REFERENCES characteristics(id),
  process_step TEXT NOT NULL DEFAULT '',
  potential_failure_mode TEXT NOT NULL DEFAULT '',
  potential_effect TEXT NOT NULL DEFAULT '',
  severity INTEGER NOT NULL DEFAULT 1 CHECK (severity BETWEEN 1 AND 10),
  potential_cause TEXT NOT NULL DEFAULT '',
  occurrence INTEGER NOT NULL DEFAULT 1 CHECK (occurrence BETWEEN 1 AND 10),
  current_control_prevention TEXT NOT NULL DEFAULT '',
  current_control_detection TEXT NOT NULL DEFAULT '',
  detection INTEGER NOT NULL DEFAULT 1 CHECK (detection BETWEEN 1 AND 10),
  rpn INTEGER NOT NULL DEFAULT 1,
  action_priority TEXT NOT NULL DEFAULT 'L' CHECK (action_priority IN ('H', 'M', 'L')),
  recommended_action TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. 관리계획서 (Control Plan)
CREATE TABLE IF NOT EXISTS control_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pfmea_id UUID NOT NULL REFERENCES pfmea_headers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. 관리계획서 항목
CREATE TABLE IF NOT EXISTS control_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_plan_id UUID NOT NULL REFERENCES control_plans(id) ON DELETE CASCADE,
  pfmea_line_id UUID NOT NULL REFERENCES pfmea_lines(id),
  characteristic_id UUID NOT NULL REFERENCES characteristics(id),
  process_step TEXT NOT NULL DEFAULT '',
  characteristic_name TEXT NOT NULL DEFAULT '',
  control_type TEXT NOT NULL CHECK (control_type IN ('prevention', 'detection')),
  control_method TEXT NOT NULL DEFAULT '',
  sample_size TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  reaction_plan TEXT NOT NULL DEFAULT '',
  responsible TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. 작업표준서 (SOP)
CREATE TABLE IF NOT EXISTS sops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_plan_id UUID NOT NULL REFERENCES control_plans(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. 작업표준서 단계
CREATE TABLE IF NOT EXISTS sop_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sop_id UUID NOT NULL REFERENCES sops(id) ON DELETE CASCADE,
  linked_cp_item_id UUID NOT NULL REFERENCES control_plan_items(id),
  step_no INTEGER NOT NULL DEFAULT 1,
  process_step TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  key_point TEXT NOT NULL DEFAULT '',
  safety_note TEXT NOT NULL DEFAULT '',
  quality_point TEXT NOT NULL DEFAULT '',
  tools_equipment TEXT NOT NULL DEFAULT '',
  estimated_time_sec INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. 검사기준서 (Inspection Standard)
CREATE TABLE IF NOT EXISTS inspection_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_plan_id UUID NOT NULL REFERENCES control_plans(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. 검사 항목
CREATE TABLE IF NOT EXISTS inspection_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_standard_id UUID NOT NULL REFERENCES inspection_standards(id) ON DELETE CASCADE,
  linked_cp_item_id UUID NOT NULL REFERENCES control_plan_items(id),
  characteristic_id UUID NOT NULL REFERENCES characteristics(id),
  item_no INTEGER NOT NULL DEFAULT 1,
  inspection_item_name TEXT NOT NULL DEFAULT '',
  specification TEXT NOT NULL DEFAULT '',
  lsl NUMERIC,
  usl NUMERIC,
  unit TEXT NOT NULL DEFAULT '',
  inspection_method TEXT NOT NULL DEFAULT '',
  measurement_tool TEXT NOT NULL DEFAULT '',
  sample_size TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  acceptance_criteria TEXT NOT NULL DEFAULT '',
  ng_handling TEXT NOT NULL DEFAULT '',
  inspection_type TEXT NOT NULL DEFAULT 'in-process' CHECK (inspection_type IN ('incoming', 'in-process', 'final', 'outgoing')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ================================================
-- 인덱스
-- ================================================
CREATE INDEX IF NOT EXISTS idx_characteristics_product ON characteristics(product_id);
CREATE INDEX IF NOT EXISTS idx_pfmea_headers_product ON pfmea_headers(product_id);
CREATE INDEX IF NOT EXISTS idx_pfmea_lines_pfmea ON pfmea_lines(pfmea_id);
CREATE INDEX IF NOT EXISTS idx_control_plans_pfmea ON control_plans(pfmea_id);
CREATE INDEX IF NOT EXISTS idx_control_plans_product ON control_plans(product_id);
CREATE INDEX IF NOT EXISTS idx_control_plan_items_cp ON control_plan_items(control_plan_id);
CREATE INDEX IF NOT EXISTS idx_sops_cp ON sops(control_plan_id);
CREATE INDEX IF NOT EXISTS idx_sops_product ON sops(product_id);
CREATE INDEX IF NOT EXISTS idx_sop_steps_sop ON sop_steps(sop_id);
CREATE INDEX IF NOT EXISTS idx_inspection_standards_cp ON inspection_standards(control_plan_id);
CREATE INDEX IF NOT EXISTS idx_inspection_standards_product ON inspection_standards(product_id);
CREATE INDEX IF NOT EXISTS idx_inspection_items_is ON inspection_items(inspection_standard_id);

-- ================================================
-- RLS (Row Level Security) - 공개 접근 허용
-- 추후 인증 추가 시 정책 수정 가능
-- ================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE characteristics ENABLE ROW LEVEL SECURITY;
ALTER TABLE pfmea_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pfmea_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;

-- 모든 테이블에 공개 읽기/쓰기 정책 (anon key 사용 시)
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'products', 'characteristics', 'pfmea_headers', 'pfmea_lines',
    'control_plans', 'control_plan_items', 'sops', 'sop_steps',
    'inspection_standards', 'inspection_items'
  ])
  LOOP
    EXECUTE format('CREATE POLICY "Allow all select on %I" ON %I FOR SELECT USING (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Allow all insert on %I" ON %I FOR INSERT WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Allow all update on %I" ON %I FOR UPDATE USING (true) WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "Allow all delete on %I" ON %I FOR DELETE USING (true)', tbl, tbl);
  END LOOP;
END $$;

-- ================================================
-- updated_at 자동 갱신 트리거
-- ================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_pfmea_headers_updated_at
  BEFORE UPDATE ON pfmea_headers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_control_plans_updated_at
  BEFORE UPDATE ON control_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_sops_updated_at
  BEFORE UPDATE ON sops FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_inspection_standards_updated_at
  BEFORE UPDATE ON inspection_standards FOR EACH ROW EXECUTE FUNCTION update_updated_at();
