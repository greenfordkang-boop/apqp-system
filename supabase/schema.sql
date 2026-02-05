-- ============================================
-- APQP System Database Schema
-- ============================================
-- 핵심 원칙:
-- 1. Single Source of Truth = Characteristic(특성)
-- 2. 모든 문서는 FK 기반 추적 가능:
--    pfmea_line_id → control_plan_item_id → sop_step_id / inspection_item_id
-- ============================================

-- UUID 확장
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. Characteristics (Single Source of Truth)
-- ============================================
CREATE TABLE characteristics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('product', 'process')),
  category VARCHAR(20) NOT NULL CHECK (category IN ('critical', 'major', 'minor')),
  specification TEXT,
  lsl DECIMAL(15,6),           -- Lower Spec Limit
  usl DECIMAL(15,6),           -- Upper Spec Limit
  unit VARCHAR(50),
  measurement_method TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_characteristics_type ON characteristics(type);
CREATE INDEX idx_characteristics_category ON characteristics(category);

-- ============================================
-- 2. PFMEA Header
-- ============================================
CREATE TABLE pfmea_headers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID,
  process_name VARCHAR(255) NOT NULL,
  revision INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. PFMEA Lines
-- ============================================
CREATE TABLE pfmea_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pfmea_id UUID NOT NULL REFERENCES pfmea_headers(id) ON DELETE CASCADE,
  step_no INTEGER NOT NULL,
  process_step VARCHAR(255) NOT NULL,
  characteristic_id UUID REFERENCES characteristics(id),
  potential_failure_mode TEXT NOT NULL,
  potential_effect TEXT NOT NULL,
  severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 10),
  potential_cause TEXT NOT NULL,
  occurrence INTEGER NOT NULL CHECK (occurrence BETWEEN 1 AND 10),
  current_control_prevention TEXT,
  current_control_detection TEXT,
  detection INTEGER NOT NULL CHECK (detection BETWEEN 1 AND 10),
  rpn INTEGER GENERATED ALWAYS AS (severity * occurrence * detection) STORED,
  recommended_action TEXT,
  action_priority VARCHAR(1) CHECK (action_priority IN ('H', 'M', 'L')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pfmea_lines_pfmea_id ON pfmea_lines(pfmea_id);
CREATE INDEX idx_pfmea_lines_characteristic_id ON pfmea_lines(characteristic_id);
CREATE INDEX idx_pfmea_lines_rpn ON pfmea_lines(rpn DESC);

-- ============================================
-- 4. Control Plans
-- ============================================
CREATE TABLE control_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pfmea_id UUID NOT NULL REFERENCES pfmea_headers(id),
  name VARCHAR(255) NOT NULL,
  revision INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_control_plans_pfmea_id ON control_plans(pfmea_id);

-- ============================================
-- 5. Control Plan Items
-- ============================================
CREATE TABLE control_plan_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  control_plan_id UUID NOT NULL REFERENCES control_plans(id) ON DELETE CASCADE,
  pfmea_line_id UUID NOT NULL REFERENCES pfmea_lines(id),
  characteristic_id UUID NOT NULL REFERENCES characteristics(id),
  step_no INTEGER NOT NULL,
  process_step VARCHAR(255) NOT NULL,
  control_type VARCHAR(20) NOT NULL CHECK (control_type IN ('prevention', 'detection')),
  control_method TEXT NOT NULL,
  sample_size VARCHAR(100) NOT NULL,
  frequency VARCHAR(100) NOT NULL,
  reaction_plan TEXT NOT NULL,
  responsible VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cp_items_control_plan_id ON control_plan_items(control_plan_id);
CREATE INDEX idx_cp_items_pfmea_line_id ON control_plan_items(pfmea_line_id);
CREATE INDEX idx_cp_items_characteristic_id ON control_plan_items(characteristic_id);

-- ============================================
-- 6. SOPs (Standard Operating Procedures)
-- ============================================
CREATE TABLE sops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  control_plan_id UUID NOT NULL REFERENCES control_plans(id),
  name VARCHAR(255) NOT NULL,
  revision INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved')),
  effective_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sops_control_plan_id ON sops(control_plan_id);

-- ============================================
-- 7. SOP Steps
-- ============================================
CREATE TABLE sop_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sop_id UUID NOT NULL REFERENCES sops(id) ON DELETE CASCADE,
  linked_cp_item_id UUID NOT NULL REFERENCES control_plan_items(id),  -- FK 필수!
  step_no INTEGER NOT NULL,
  action TEXT NOT NULL,           -- 작업자 기준 문장
  key_point TEXT NOT NULL,        -- 관리 포인트 + 검사방법 + 이상조치
  safety_note TEXT,
  visual_aid_url TEXT,
  estimated_time_sec INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sop_steps_sop_id ON sop_steps(sop_id);
CREATE INDEX idx_sop_steps_linked_cp_item_id ON sop_steps(linked_cp_item_id);

-- ============================================
-- 8. Inspection Standards (검사기준서)
-- ============================================
CREATE TABLE inspection_standards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  control_plan_id UUID NOT NULL REFERENCES control_plans(id),
  name VARCHAR(255) NOT NULL,
  revision INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inspection_standards_control_plan_id ON inspection_standards(control_plan_id);

-- ============================================
-- 9. Inspection Items
-- ============================================
CREATE TABLE inspection_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inspection_standard_id UUID NOT NULL REFERENCES inspection_standards(id) ON DELETE CASCADE,
  linked_cp_item_id UUID NOT NULL REFERENCES control_plan_items(id),  -- FK 필수!
  characteristic_id UUID NOT NULL REFERENCES characteristics(id),      -- FK 필수!
  item_no INTEGER NOT NULL,
  inspection_item_name VARCHAR(255) NOT NULL,
  inspection_method TEXT NOT NULL,
  sampling_plan VARCHAR(200) NOT NULL,     -- CP의 sample_size + frequency
  acceptance_criteria TEXT NOT NULL,       -- 정량화된 합격 기준
  measurement_equipment TEXT,
  ng_handling TEXT NOT NULL,               -- 격리 + 재검 + 원인분석 트리거
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inspection_items_standard_id ON inspection_items(inspection_standard_id);
CREATE INDEX idx_inspection_items_linked_cp_item_id ON inspection_items(linked_cp_item_id);
CREATE INDEX idx_inspection_items_characteristic_id ON inspection_items(characteristic_id);

-- ============================================
-- Trigger: updated_at 자동 갱신
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_characteristics_updated_at BEFORE UPDATE ON characteristics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pfmea_headers_updated_at BEFORE UPDATE ON pfmea_headers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pfmea_lines_updated_at BEFORE UPDATE ON pfmea_lines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_control_plans_updated_at BEFORE UPDATE ON control_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_control_plan_items_updated_at BEFORE UPDATE ON control_plan_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sops_updated_at BEFORE UPDATE ON sops FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sop_steps_updated_at BEFORE UPDATE ON sop_steps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inspection_standards_updated_at BEFORE UPDATE ON inspection_standards FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_inspection_items_updated_at BEFORE UPDATE ON inspection_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Traceability View: 전체 추적성 확인
-- ============================================
CREATE OR REPLACE VIEW traceability_view AS
SELECT
  c.id AS characteristic_id,
  c.name AS characteristic_name,
  c.category AS characteristic_category,
  pl.id AS pfmea_line_id,
  pl.process_step,
  pl.rpn,
  cpi.id AS control_plan_item_id,
  cp.name AS control_plan_name,
  ss.id AS sop_step_id,
  s.name AS sop_name,
  ii.id AS inspection_item_id,
  ist.name AS inspection_standard_name
FROM characteristics c
LEFT JOIN pfmea_lines pl ON pl.characteristic_id = c.id
LEFT JOIN control_plan_items cpi ON cpi.characteristic_id = c.id
LEFT JOIN control_plans cp ON cp.id = cpi.control_plan_id
LEFT JOIN sop_steps ss ON ss.linked_cp_item_id = cpi.id
LEFT JOIN sops s ON s.id = ss.sop_id
LEFT JOIN inspection_items ii ON ii.linked_cp_item_id = cpi.id
LEFT JOIN inspection_standards ist ON ist.id = ii.inspection_standard_id;
