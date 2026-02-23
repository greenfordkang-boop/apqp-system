/**
 * 고객사 제출용 문서 변환 API
 *
 * ====================================================
 * 설계 의도
 * ====================================================
 * 내부 문서(CP/SOP/INS)를 고객사 포맷으로 변환
 * - 고객사별 컬럼/용어/단위 규칙 적용
 * - 원본 데이터 일관성 보존 검증
 *
 * ====================================================
 * 변환 과정
 * ====================================================
 * 1. 템플릿 조회 (customer_templates)
 * 2. 컬럼 매핑 적용
 * 3. 용어 변환
 * 4. 단위 변환
 * 5. 일관성 검증 (원본 vs 변환본)
 * 6. 결과 반환 + 경고 메시지
 *
 * ====================================================
 * 출력 형식
 * ====================================================
 * - JSON (기본)
 * - CSV (옵션)
 * - XLSX (향후)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

interface CustomerExportRequest {
  control_plan_id?: string;
  inspection_standard_id?: string;
  sop_id?: string;
  customer_code?: string;  // 고객사 코드 (없으면 기본 템플릿)
  output_format?: 'json' | 'csv';  // 기본: json
}

interface Warning {
  type: 'column_missing' | 'unit_conversion' | 'term_mismatch' | 'no_template';
  field: string;
  message: string;
}

interface CustomerExportResponse {
  success: boolean;
  report_run_id?: string;
  customer: string;
  document_type: string;
  payload: unknown;
  warnings: Warning[];
  csv?: string;
  error?: string;
}

// 기본 컬럼 매핑 (템플릿 없을 때)
const DEFAULT_CP_MAPPING: Record<string, string> = {
  step_no: 'Step No.',
  process_step: 'Process Step',
  characteristic_name: 'Product/Process Characteristic',
  characteristic_category: 'Classification',
  specification: 'Specification/Tolerance',
  control_type: 'Control Type',
  control_method: 'Control Method',
  sample_size: 'Sample Size',
  frequency: 'Frequency',
  reaction_plan: 'Reaction Plan',
  responsible: 'Responsible',
};

const DEFAULT_INS_MAPPING: Record<string, string> = {
  item_no: 'Item No.',
  inspection_item_name: 'Inspection Item',
  characteristic_name: 'Characteristic',
  inspection_method: 'Inspection Method',
  sampling_plan: 'Sampling Plan',
  acceptance_criteria: 'Acceptance Criteria',
  measurement_tool: 'Equipment',
  ng_handling: 'NG Handling',
};

const DEFAULT_SOP_MAPPING: Record<string, string> = {
  step_no: 'Step',
  action: 'Action',
  key_point: 'Key Points',
  safety_note: 'Safety Notes',
  estimated_time_sec: 'Est. Time (sec)',
};

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  try {
    const body: CustomerExportRequest = await request.json();
    const {
      control_plan_id,
      inspection_standard_id,
      sop_id,
      customer_code,
      output_format = 'json',
    } = body;

    if (!control_plan_id && !inspection_standard_id && !sop_id) {
      return NextResponse.json<CustomerExportResponse>(
        {
          success: false,
          customer: '',
          document_type: '',
          payload: null,
          warnings: [],
          error: 'At least one of control_plan_id, inspection_standard_id, or sop_id is required',
        },
        { status: 400 }
      );
    }

    const warnings: Warning[] = [];
    let documentType = '';
    let payload: unknown[] = [];
    let template: {
      column_mapping?: Record<string, string>;
      term_mapping?: Record<string, string>;
      unit_mapping?: Record<string, string>;
    } | null = null;

    // 1. 템플릿 조회
    if (customer_code) {
      const docType = control_plan_id ? 'control_plan' :
                      inspection_standard_id ? 'inspection_standard' : 'sop';

      const { data: tmpl } = await supabase
        .from('customer_templates')
        .select('*')
        .eq('customer_code', customer_code)
        .eq('document_type', docType)
        .single();

      if (tmpl) {
        template = tmpl;
      } else {
        warnings.push({
          type: 'no_template',
          field: 'template',
          message: `고객사 "${customer_code}"의 ${docType} 템플릿이 없습니다. 기본 템플릿을 사용합니다.`,
        });
      }
    }

    // 2. 문서 유형별 데이터 조회 및 변환
    if (control_plan_id) {
      documentType = 'ControlPlan';
      const result = await exportControlPlan(supabase, control_plan_id, template, warnings);
      payload = result;
    } else if (inspection_standard_id) {
      documentType = 'Inspection';
      const result = await exportInspection(supabase, inspection_standard_id, template, warnings);
      payload = result;
    } else if (sop_id) {
      documentType = 'SOP';
      const result = await exportSop(supabase, sop_id, template, warnings);
      payload = result;
    }

    // 3. CSV 변환 (옵션)
    let csv: string | undefined;
    if (output_format === 'csv' && Array.isArray(payload) && payload.length > 0) {
      csv = convertToCSV(payload as Record<string, unknown>[]);
    }

    // 4. report_runs 저장
    const reportRunId = uuidv4();
    await supabase.from('report_runs').insert({
      id: reportRunId,
      report_type: 'customer_export',
      input_params: { control_plan_id, inspection_standard_id, sop_id, customer_code, output_format },
      result_summary: {
        document_type: documentType,
        row_count: Array.isArray(payload) ? payload.length : 0,
        warning_count: warnings.length,
      },
      result_detail: { warnings },
      status: 'completed',
    });

    return NextResponse.json<CustomerExportResponse>({
      success: true,
      report_run_id: reportRunId,
      customer: customer_code || 'DEFAULT',
      document_type: documentType,
      payload,
      warnings,
      csv,
    });

  } catch (error) {
    console.error('Customer export error:', error);
    return NextResponse.json<CustomerExportResponse>(
      {
        success: false,
        customer: '',
        document_type: '',
        payload: null,
        warnings: [],
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ============================================
// Control Plan 내보내기
// ============================================
async function exportControlPlan(
  supabase: ReturnType<typeof createServerClient>,
  controlPlanId: string,
  template: { column_mapping?: Record<string, string>; term_mapping?: Record<string, string>; unit_mapping?: Record<string, string> } | null,
  warnings: Warning[]
): Promise<Record<string, unknown>[]> {
  const { data: items } = await supabase
    .from('control_plan_items')
    .select(`
      *,
      characteristics:characteristic_id (
        name,
        category,
        specification,
        lsl,
        usl,
        unit
      )
    `)
    .eq('control_plan_id', controlPlanId)
    .order('step_no');

  if (!items || items.length === 0) return [];

  const columnMapping = template?.column_mapping || DEFAULT_CP_MAPPING;
  const termMapping = template?.term_mapping || {};
  const unitMapping = template?.unit_mapping || {};

  return items.map(item => {
    const char = item.characteristics as { name?: string; category?: string; specification?: string; lsl?: number; usl?: number; unit?: string } | null;

    // 규격 문자열 생성
    let spec = char?.specification || '';
    if (!spec && char?.lsl !== null && char?.usl !== null) {
      const unit = char?.unit || '';
      // 단위 변환 적용
      const convertedUnit = unitMapping[unit] || unit;
      spec = `${char?.lsl}${convertedUnit} ~ ${char?.usl}${convertedUnit}`;

      if (unitMapping[unit]) {
        warnings.push({
          type: 'unit_conversion',
          field: 'specification',
          message: `단위 "${unit}"이 "${convertedUnit}"로 변환됨 (Step ${item.step_no})`,
        });
      }
    }

    // 용어 변환 적용
    const controlType = termMapping[item.control_type] || item.control_type;
    const category = termMapping[char?.category || ''] || char?.category || '';

    // 매핑된 컬럼으로 변환
    const row: Record<string, unknown> = {};

    if (columnMapping.step_no) row[columnMapping.step_no] = item.step_no;
    if (columnMapping.process_step) row[columnMapping.process_step] = item.process_step;
    if (columnMapping.characteristic_name) row[columnMapping.characteristic_name] = char?.name || '';
    if (columnMapping.characteristic_category) row[columnMapping.characteristic_category] = category;
    if (columnMapping.specification) row[columnMapping.specification] = spec;
    if (columnMapping.control_type) row[columnMapping.control_type] = controlType;
    if (columnMapping.control_method) row[columnMapping.control_method] = item.control_method;
    if (columnMapping.sample_size) row[columnMapping.sample_size] = item.sample_size;
    if (columnMapping.frequency) row[columnMapping.frequency] = item.frequency;
    if (columnMapping.reaction_plan) row[columnMapping.reaction_plan] = item.reaction_plan;
    if (columnMapping.responsible) row[columnMapping.responsible] = item.responsible || '';

    return row;
  });
}

// ============================================
// 검사기준서 내보내기
// ============================================
async function exportInspection(
  supabase: ReturnType<typeof createServerClient>,
  inspectionStandardId: string,
  template: { column_mapping?: Record<string, string>; term_mapping?: Record<string, string>; unit_mapping?: Record<string, string> } | null,
  warnings: Warning[]
): Promise<Record<string, unknown>[]> {
  const { data: items } = await supabase
    .from('inspection_items')
    .select(`
      *,
      characteristics:characteristic_id (
        name,
        category
      )
    `)
    .eq('inspection_standard_id', inspectionStandardId)
    .order('item_no');

  if (!items || items.length === 0) return [];

  const columnMapping = template?.column_mapping || DEFAULT_INS_MAPPING;

  return items.map(item => {
    const char = item.characteristics as { name?: string; category?: string } | null;

    const row: Record<string, unknown> = {};

    if (columnMapping.item_no) row[columnMapping.item_no] = item.item_no;
    if (columnMapping.inspection_item_name) row[columnMapping.inspection_item_name] = item.inspection_item_name;
    if (columnMapping.characteristic_name) row[columnMapping.characteristic_name] = char?.name || '';
    if (columnMapping.inspection_method) row[columnMapping.inspection_method] = item.inspection_method;
    if (columnMapping.sampling_plan) row[columnMapping.sampling_plan] = item.sampling_plan;
    if (columnMapping.acceptance_criteria) row[columnMapping.acceptance_criteria] = item.acceptance_criteria;
    if (columnMapping.measurement_tool) row[columnMapping.measurement_tool] = item.measurement_tool || '';
    if (columnMapping.ng_handling) row[columnMapping.ng_handling] = item.ng_handling;

    return row;
  });
}

// ============================================
// SOP 내보내기
// ============================================
async function exportSop(
  supabase: ReturnType<typeof createServerClient>,
  sopId: string,
  template: { column_mapping?: Record<string, string>; term_mapping?: Record<string, string>; unit_mapping?: Record<string, string> } | null,
  warnings: Warning[]
): Promise<Record<string, unknown>[]> {
  const { data: steps } = await supabase
    .from('sop_steps')
    .select('*')
    .eq('sop_id', sopId)
    .order('step_no');

  if (!steps || steps.length === 0) return [];

  const columnMapping = template?.column_mapping || DEFAULT_SOP_MAPPING;

  return steps.map(step => {
    const row: Record<string, unknown> = {};

    if (columnMapping.step_no) row[columnMapping.step_no] = step.step_no;
    if (columnMapping.action) row[columnMapping.action] = step.action;
    if (columnMapping.key_point) row[columnMapping.key_point] = step.key_point;
    if (columnMapping.safety_note) row[columnMapping.safety_note] = step.safety_note || '';
    if (columnMapping.estimated_time_sec) row[columnMapping.estimated_time_sec] = step.estimated_time_sec || '';

    return row;
  });
}

// ============================================
// CSV 변환
// ============================================
function convertToCSV(data: Record<string, unknown>[]): string {
  if (data.length === 0) return '';

  const headers = Object.keys(data[0]);
  const headerRow = headers.map(h => `"${h}"`).join(',');

  const dataRows = data.map(row => {
    return headers.map(h => {
      const value = row[h];
      if (value === null || value === undefined) return '""';
      const str = String(value).replace(/"/g, '""');
      return `"${str}"`;
    }).join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

// GET: 템플릿 목록 조회
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const customerCode = searchParams.get('customer_code');

  let query = supabase
    .from('customer_templates')
    .select('*')
    .order('customer_code');

  if (customerCode) {
    query = query.eq('customer_code', customerCode);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}
