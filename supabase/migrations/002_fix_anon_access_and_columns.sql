-- ================================================
-- Fix: anon RLS 정책 추가 + 누락 컬럼 추가
-- 문제: products INSERT 시 RLS 위반 (42501)
--       characteristics에 process_name 컬럼 없음 (PGRST204)
-- ================================================

-- 1. characteristics 테이블에 process_name 컬럼 추가
ALTER TABLE characteristics ADD COLUMN IF NOT EXISTS process_name TEXT NOT NULL DEFAULT '';

-- 2. 모든 테이블에 anon 접근 허용 RLS 정책 추가
-- (인증 없이 사용하는 내부 도구용)
DO $$
DECLARE
  tbl TEXT;
  pol_name TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'products', 'characteristics', 'pfmea_headers', 'pfmea_lines',
    'control_plans', 'control_plan_items', 'sops', 'sop_steps',
    'inspection_standards', 'inspection_items'
  ])
  LOOP
    -- SELECT
    pol_name := 'anon_select_' || tbl;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = pol_name) THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO anon USING (true)', pol_name, tbl);
    END IF;
    -- INSERT
    pol_name := 'anon_insert_' || tbl;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = pol_name) THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO anon WITH CHECK (true)', pol_name, tbl);
    END IF;
    -- UPDATE
    pol_name := 'anon_update_' || tbl;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = pol_name) THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO anon USING (true) WITH CHECK (true)', pol_name, tbl);
    END IF;
    -- DELETE
    pol_name := 'anon_delete_' || tbl;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = pol_name) THEN
      EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO anon USING (true)', pol_name, tbl);
    END IF;
  END LOOP;
END $$;

-- 3. 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
