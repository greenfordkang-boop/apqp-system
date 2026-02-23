/**
 * Consistency Check API
 *
 * ====================================================
 * 설계 의도
 * ====================================================
 * 내부 품질 통제 / 리스크 탐지 엔진
 * - 100% 룰 기반 (LLM 미사용)
 * - PFMEA → CP → SOP → INS 연결 검증
 * - 샘플링 일관성 검증
 * - 문서 내용 품질 검증
 *
 * ====================================================
 * 검증 규칙 (6개)
 * ====================================================
 * Rule 1 (HIGH): 고위험 PFMEA(AP=H 또는 RPN≥100)인데 CP 연결 없음
 * Rule 2 (HIGH): CP 항목 있는데 SOP 연결 없음
 * Rule 3 (HIGH): CP 항목 있는데 검사기준서 연결 없음
 * Rule 4 (MED):  샘플링 불일치 (CP vs INS)
 * Rule 5 (MED):  SOP key_point에 관리포인트/이상조치 누락
 * Rule 6 (LOW):  LSL/USL 존재인데 acceptance_criteria에 수치 미표기
 *
 * ====================================================
 * API 특성
 * ====================================================
 * - 입력: pfmea_id 또는 control_plan_id
 * - 결과 저장: report_runs + consistency_issues 테이블
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import {
  checkRule1,
  checkRule2,
  checkRule3,
  checkRule4,
  checkRule5,
  checkRule6,
  aggregateResults,
  type ConsistencyIssue,
  type ConsistencyCheckResult,
} from '@/lib/rules';

interface ConsistencyCheckRequest {
  pfmea_id?: string;
  control_plan_id?: string;
  save_results?: boolean;  // 결과를 DB에 저장할지 (기본: true)
}

interface ConsistencyCheckResponse {
  success: boolean;
  report_run_id?: string;
  result?: ConsistencyCheckResult;
  error?: string;
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  try {
    // 1. 요청 검증
    const body: ConsistencyCheckRequest = await request.json();
    const { pfmea_id, control_plan_id, save_results = true } = body;

    if (!pfmea_id && !control_plan_id) {
      return NextResponse.json<ConsistencyCheckResponse>(
        { success: false, error: 'pfmea_id or control_plan_id is required' },
        { status: 400 }
      );
    }

    // 2. PFMEA ID 결정 (CP에서 역추적)
    let targetPfmeaId = pfmea_id;
    if (!targetPfmeaId && control_plan_id) {
      const { data: cp } = await supabase
        .from('control_plans')
        .select('pfmea_id')
        .eq('id', control_plan_id)
        .single();
      if (cp) {
        targetPfmeaId = cp.pfmea_id;
      }
    }

    if (!targetPfmeaId) {
      return NextResponse.json<ConsistencyCheckResponse>(
        { success: false, error: 'Could not determine PFMEA ID' },
        { status: 400 }
      );
    }

    // 3. 데이터 조회
    // 3-1. PFMEA Lines
    const { data: pfmeaLines, error: pfmeaError } = await supabase
      .from('pfmea_lines')
      .select('id, rpn, action_priority, process_step, characteristic_id')
      .eq('pfmea_id', targetPfmeaId);

    if (pfmeaError) throw new Error(`PFMEA query error: ${pfmeaError.message}`);
    if (!pfmeaLines) throw new Error('PFMEA lines data is null');

    // 3-2. Control Plans & Items
    const { data: controlPlans } = await supabase
      .from('control_plans')
      .select('id')
      .eq('pfmea_id', targetPfmeaId);

    const cpIds = controlPlans?.map(cp => cp.id) || [];

    let cpItems: Array<{
      id: string;
      pfmea_line_id: string;
      characteristic_id: string;
      process_step: string;
      control_type: string;
      control_method: string;
      sample_size: string;
      frequency: string;
    }> = [];

    if (cpIds.length > 0) {
      const { data: items } = await supabase
        .from('control_plan_items')
        .select('id, pfmea_line_id, characteristic_id, process_step, control_type, control_method, sample_size, frequency')
        .in('control_plan_id', cpIds);
      cpItems = items || [];
    }

    // 3-3. SOP Steps
    let sopSteps: Array<{
      id: string;
      linked_cp_item_id: string;
      key_point: string;
      action: string;
    }> = [];

    if (cpIds.length > 0) {
      const { data: sops } = await supabase
        .from('sops')
        .select('id')
        .in('control_plan_id', cpIds);

      const sopIds = sops?.map(s => s.id) || [];

      if (sopIds.length > 0) {
        const { data: steps } = await supabase
          .from('sop_steps')
          .select('id, linked_cp_item_id, key_point, action')
          .in('sop_id', sopIds);
        sopSteps = steps || [];
      }
    }

    // 3-4. Inspection Items
    let inspectionItems: Array<{
      id: string;
      linked_cp_item_id: string;
      characteristic_id: string;
      sampling_plan: string;
      acceptance_criteria: string;
      inspection_item_name: string;
    }> = [];

    if (cpIds.length > 0) {
      const { data: standards } = await supabase
        .from('inspection_standards')
        .select('id')
        .in('control_plan_id', cpIds);

      const standardIds = standards?.map(s => s.id) || [];

      if (standardIds.length > 0) {
        const { data: items } = await supabase
          .from('inspection_items')
          .select('id, linked_cp_item_id, characteristic_id, sampling_plan, acceptance_criteria, inspection_item_name')
          .in('inspection_standard_id', standardIds);
        inspectionItems = items || [];
      }
    }

    // 3-5. Characteristics
    const charIds = [...new Set([
      ...cpItems.map(cp => cp.characteristic_id),
      ...inspectionItems.map(ii => ii.characteristic_id),
    ])].filter(Boolean);

    let characteristics: Array<{
      id: string;
      lsl: number | null;
      usl: number | null;
    }> = [];

    if (charIds.length > 0) {
      const { data: chars } = await supabase
        .from('characteristics')
        .select('id, lsl, usl')
        .in('id', charIds);
      characteristics = chars || [];
    }

    // 4. 매핑 데이터 생성
    // CP items by PFMEA line
    const cpItemsByPfmeaLine = new Map<string, string[]>();
    for (const item of cpItems) {
      const existing = cpItemsByPfmeaLine.get(item.pfmea_line_id) || [];
      existing.push(item.id);
      cpItemsByPfmeaLine.set(item.pfmea_line_id, existing);
    }

    // SOP steps by CP item
    const sopStepsByCpItem = new Map<string, string[]>();
    for (const step of sopSteps) {
      const existing = sopStepsByCpItem.get(step.linked_cp_item_id) || [];
      existing.push(step.id);
      sopStepsByCpItem.set(step.linked_cp_item_id, existing);
    }

    // Inspection items by CP item
    const inspItemsByCpItem = new Map<string, string[]>();
    for (const item of inspectionItems) {
      const existing = inspItemsByCpItem.get(item.linked_cp_item_id) || [];
      existing.push(item.id);
      inspItemsByCpItem.set(item.linked_cp_item_id, existing);
    }

    // 5. 규칙 검사 실행
    const allIssues: ConsistencyIssue[] = [];

    // Rule 1: 고위험 PFMEA인데 CP 없음
    allIssues.push(...checkRule1(pfmeaLines || [], cpItemsByPfmeaLine));

    // Rule 2: CP 있는데 SOP 없음
    allIssues.push(...checkRule2(cpItems, sopStepsByCpItem));

    // Rule 3: CP 있는데 검사기준서 없음
    allIssues.push(...checkRule3(cpItems, inspItemsByCpItem));

    // Rule 4: 샘플링 불일치
    allIssues.push(...checkRule4(cpItems, inspectionItems));

    // Rule 5: SOP key_point 누락
    allIssues.push(...checkRule5(sopSteps));

    // Rule 6: 수치 미표기
    allIssues.push(...checkRule6(inspectionItems, characteristics, cpItems));

    // 6. 결과 집계
    const result = aggregateResults(allIssues);

    // 7. 결과 저장 (선택적)
    let reportRunId: string | undefined;

    if (save_results) {
      reportRunId = uuidv4();

      // report_runs 저장
      const { error: runError } = await supabase
        .from('report_runs')
        .insert({
          id: reportRunId,
          report_type: 'consistency_check',
          input_params: { pfmea_id: targetPfmeaId, control_plan_id },
          result_summary: result.summary,
          result_detail: { issues: result.issues },
          status: 'completed',
        });

      if (runError) {
        console.warn('Failed to save report_runs:', runError.message);
      }

      // consistency_issues 저장
      if (result.issues.length > 0) {
        const issueRecords = result.issues.map(issue => ({
          id: uuidv4(),
          report_run_id: reportRunId,
          severity: issue.severity,
          rule_code: issue.rule,
          rule_description: getRuleDescription(issue.rule),
          message: issue.message,
          pfmea_line_id: issue.pfmea_line_id,
          control_plan_item_id: issue.control_plan_item_id,
          sop_step_id: issue.sop_step_id,
          inspection_item_id: issue.inspection_item_id,
        }));

        const { error: issuesError } = await supabase
          .from('consistency_issues')
          .insert(issueRecords);

        if (issuesError) {
          console.warn('Failed to save consistency_issues:', issuesError.message);
        }
      }
    }

    // 8. 응답
    return NextResponse.json<ConsistencyCheckResponse>({
      success: true,
      report_run_id: reportRunId,
      result,
    });

  } catch (error) {
    console.error('Consistency check error:', error);
    return NextResponse.json<ConsistencyCheckResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// 규칙 설명 조회 헬퍼
function getRuleDescription(ruleCode: string): string {
  const descriptions: Record<string, string> = {
    RULE_1: '고위험 PFMEA(AP=High 또는 RPN≥100)인데 Control Plan 연결 없음',
    RULE_2: 'Control Plan 항목이 있는데 SOP 연결 없음',
    RULE_3: 'Control Plan 항목이 있는데 검사기준서 연결 없음',
    RULE_4: '샘플링 불일치 (CP sample_size/frequency vs INS sampling_plan)',
    RULE_5: 'SOP key_point에 관리포인트/이상조치 요약 누락',
    RULE_6: 'LSL/USL 존재인데 acceptance_criteria에 수치 미표기',
  };
  return descriptions[ruleCode] || ruleCode;
}

// GET: 최근 검사 결과 조회
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const pfmeaId = searchParams.get('pfmea_id');
  const limit = parseInt(searchParams.get('limit') || '10');

  let query = supabase
    .from('report_runs')
    .select(`
      id,
      input_params,
      result_summary,
      status,
      run_at,
      consistency_issues (
        id,
        severity,
        rule_code,
        message,
        resolved
      )
    `)
    .eq('report_type', 'consistency_check')
    .order('run_at', { ascending: false })
    .limit(limit);

  if (pfmeaId) {
    query = query.contains('input_params', { pfmea_id: pfmeaId });
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
