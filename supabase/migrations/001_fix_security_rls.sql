-- ============================================
-- Fix Security: Enable RLS + authenticated access
-- Supabase Security Advisor 경고 대응
-- ============================================

-- 1. Enable RLS on all tables
ALTER TABLE characteristics ENABLE ROW LEVEL SECURITY;
ALTER TABLE pfmea_headers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pfmea_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sops ENABLE ROW LEVEL SECURITY;
ALTER TABLE sop_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_items ENABLE ROW LEVEL SECURITY;

-- v2 tables
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS customer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS iatf_clause_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS consistency_issues ENABLE ROW LEVEL SECURITY;

-- 2. Create authenticated-only policies
CREATE POLICY "Authenticated access" ON characteristics
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated access" ON pfmea_headers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated access" ON pfmea_lines
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated access" ON control_plans
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated access" ON control_plan_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated access" ON sops
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated access" ON sop_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated access" ON inspection_standards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated access" ON inspection_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- v2 tables (IF EXISTS for safety)
DO $$ BEGIN
  CREATE POLICY "Authenticated access" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated access" ON processes FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated access" ON document_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated access" ON change_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated access" ON customer_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated access" ON iatf_clause_map FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated access" ON report_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated access" ON consistency_issues FOR ALL TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN undefined_table THEN NULL; END $$;
