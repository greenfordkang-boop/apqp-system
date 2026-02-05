-- ============================================
-- APQP System Database Schema v2
-- ============================================
-- 추가: products, processes, document_versions, change_logs
--       customer_templates, iatf_clause_map, report_runs
-- ============================================

-- ============================================
-- A-1. Products (제품 마스터)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  customer VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'eol')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- A-2. Processes (공정 마스터)
-- ============================================
CREATE TABLE IF NOT EXISTS processes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sequence_no INTEGER,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- A-3. Characteristics FK 추가 (products/processes 연결)
-- ============================================
ALTER TABLE characteristics
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS process_id UUID REFERENCES processes(id),
  ADD COLUMN IF NOT EXISTS canonical_name VARCHAR(255);

-- Unique constraint: (product_id, process_id, canonical_name)
-- 동일 제품/공정 내에서 특성 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_char_unique_canonical
  ON characteristics(product_id, process_id, canonical_name)
  WHERE canonical_name IS NOT NULL;

-- ============================================
-- B-1. Document Versions (문서 버전 관리)
-- ============================================
CREATE TABLE IF NOT EXISTS document_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('pfmea', 'control_plan', 'sop', 'inspection_standard')),
  document_id UUID NOT NULL,
  revision INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'review', 'approved', 'obsolete')),
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  change_summary TEXT,
  snapshot_data JSONB,  -- 해당 시점의 전체 문서 스냅샷
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_versions_type_id ON document_versions(document_type, document_id);
CREATE INDEX idx_doc_versions_status ON document_versions(status);

-- ============================================
-- B-2. Change Logs (변경 이력)
-- ============================================
CREATE TABLE IF NOT EXISTS change_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name VARCHAR(100) NOT NULL,
  record_id UUID NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  changed_by VARCHAR(255),
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  old_values JSONB,
  new_values JSONB,
  change_reason TEXT
);

CREATE INDEX idx_change_logs_table_record ON change_logs(table_name, record_id);
CREATE INDEX idx_change_logs_changed_at ON change_logs(changed_at DESC);

-- ============================================
-- C-1. Customer Templates (고객사 포맷 정의)
-- ============================================
CREATE TABLE IF NOT EXISTS customer_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_code VARCHAR(50) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('control_plan', 'sop', 'inspection_standard')),
  template_name VARCHAR(255) NOT NULL,
  column_mapping JSONB NOT NULL,  -- 내부 컬럼 → 고객사 컬럼 매핑
  term_mapping JSONB,             -- 용어 변환 (예: "특성" → "Characteristic")
  unit_mapping JSONB,             -- 단위 변환 (예: "mm" → "in")
  output_format VARCHAR(20) DEFAULT 'json' CHECK (output_format IN ('json', 'csv', 'xlsx')),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_customer_template_unique
  ON customer_templates(customer_code, document_type, template_name);

-- ============================================
-- C-2. IATF Clause Map (IATF 조항 매핑)
-- ============================================
CREATE TABLE IF NOT EXISTS iatf_clause_map (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clause_number VARCHAR(20) NOT NULL,        -- 예: "8.5.1.1"
  clause_title VARCHAR(255) NOT NULL,
  requirement_summary TEXT NOT NULL,         -- 요구사항 요지
  system_evidence TEXT,                      -- 시스템 대응 항목
  evidence_tables TEXT[],                    -- 관련 테이블 목록
  evidence_reports TEXT[],                   -- 관련 리포트/증빙
  compliance_status VARCHAR(20) DEFAULT 'partial' CHECK (compliance_status IN ('full', 'partial', 'gap', 'not_applicable')),
  gaps_and_actions TEXT,
  last_reviewed_at TIMESTAMPTZ,
  reviewed_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_iatf_clause_number ON iatf_clause_map(clause_number);

-- ============================================
-- C-3. Report Runs (리포트 실행 이력)
-- ============================================
CREATE TABLE IF NOT EXISTS report_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('consistency_check', 'audit_report', 'iatf_map', 'customer_export', 'traceability')),
  input_params JSONB NOT NULL,               -- 입력 파라미터
  result_summary JSONB,                      -- 결과 요약 (issues count 등)
  result_detail JSONB,                       -- 상세 결과
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed')),
  error_message TEXT,
  run_by VARCHAR(255),
  run_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_report_runs_type ON report_runs(report_type);
CREATE INDEX idx_report_runs_run_at ON report_runs(run_at DESC);

-- ============================================
-- D. Consistency Issues (검증 결과 저장)
-- ============================================
CREATE TABLE IF NOT EXISTS consistency_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_run_id UUID REFERENCES report_runs(id),
  severity VARCHAR(10) NOT NULL CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW')),
  rule_code VARCHAR(20) NOT NULL,
  rule_description TEXT NOT NULL,
  message TEXT NOT NULL,
  pfmea_line_id UUID REFERENCES pfmea_lines(id),
  control_plan_item_id UUID REFERENCES control_plan_items(id),
  sop_step_id UUID REFERENCES sop_steps(id),
  inspection_item_id UUID REFERENCES inspection_items(id),
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(255),
  resolution_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consistency_issues_severity ON consistency_issues(severity);
CREATE INDEX idx_consistency_issues_rule ON consistency_issues(rule_code);
CREATE INDEX idx_consistency_issues_resolved ON consistency_issues(resolved);

-- ============================================
-- E. Triggers for new tables
-- ============================================
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_processes_updated_at BEFORE UPDATE ON processes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customer_templates_updated_at BEFORE UPDATE ON customer_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_iatf_clause_map_updated_at BEFORE UPDATE ON iatf_clause_map FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- F. IATF 16949 기본 조항 데이터 (주요 항목)
-- ============================================
INSERT INTO iatf_clause_map (clause_number, clause_title, requirement_summary, system_evidence, evidence_tables, evidence_reports, compliance_status) VALUES
('6.1.2.1', 'Risk Analysis', 'PFMEA 등을 통한 리스크 분석 및 조치', 'PFMEA 자동 생성, RPN 기반 우선순위', ARRAY['pfmea_headers', 'pfmea_lines'], ARRAY['consistency_check'], 'partial'),
('7.1.5.1.1', 'Measurement System Analysis', '측정 시스템 분석(MSA) 요구', '검사기준서에 측정 장비/방법 명시', ARRAY['inspection_items', 'characteristics'], ARRAY['inspection_standard'], 'partial'),
('8.3.3.3', 'Special Characteristics', '특별 특성 식별 및 관리', 'Characteristic SSOT, category 필드로 관리', ARRAY['characteristics'], ARRAY['traceability'], 'full'),
('8.5.1.1', 'Control Plan', 'Control Plan 수립 및 유지', 'PFMEA→CP 자동 생성, 추적성 보장', ARRAY['control_plans', 'control_plan_items'], ARRAY['consistency_check', 'traceability'], 'full'),
('8.5.1.2', 'Standardized Work', '표준 작업 지시서(SOP)', 'CP→SOP 자동 생성, key_point 포함', ARRAY['sops', 'sop_steps'], ARRAY['consistency_check'], 'full'),
('8.5.1.5', 'Total Productive Maintenance', '예방 보전 계획', '(현재 미구현)', NULL, NULL, 'gap'),
('8.6.2', 'Layout Inspection', '초기 검사 및 레이아웃', '검사기준서 자동 생성', ARRAY['inspection_standards', 'inspection_items'], ARRAY['inspection_standard'], 'partial'),
('9.1.1.1', 'Monitoring and Measurement', '공정 모니터링 및 측정', 'CP의 sample_size/frequency 기반', ARRAY['control_plan_items', 'inspection_items'], ARRAY['consistency_check'], 'partial'),
('10.2.3', 'Problem Solving', '문제 해결 방법론', 'Consistency Check로 이슈 탐지', ARRAY['consistency_issues'], ARRAY['consistency_check', 'audit_report'], 'partial'),
('10.2.4', 'Error-Proofing', '실수 방지 방법', 'SOP key_point에 이상 조치 포함', ARRAY['sop_steps'], ARRAY['consistency_check'], 'partial')
ON CONFLICT DO NOTHING;
