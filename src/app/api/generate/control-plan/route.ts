/**
 * Control Plan 자동 생성 API
 *
 * ====================================================
 * 설계 의도
 * ====================================================
 * 1. PFMEA 기반으로 Control Plan 자동 생성
 * 2. PFMEA Line 1개 = Control Plan Item 2개 (예방/검출)
 * 3. 추적성 보장: pfmea_line_id → control_plan_item_id
 *
 * ====================================================
 * 생성 규칙
 * ====================================================
 * - control_plan_items.pfmea_line_id 반드시 연결
 * - control_plan_items.characteristic_id 반드시 연결
 * - 관리 유형: prevention(예방) / detection(검출)
 *
 * ====================================================
 * API 특성
 * ====================================================
 * - Idempotent: 동일 pfmea_id로 재호출 시 기존 CP 반환
 * - Fallback: LLM 실패 시 규칙 기반 기본값 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { callLLMWithJSON } from '@/lib/llm';
import { v4 as uuidv4 } from 'uuid';

interface PfmeaLine {
  id: string;
  step_no: number;
  process_step: string;
  characteristic_id: string;
  potential_failure_mode: string;
  potential_effect: string;
  severity: number;
  potential_cause: string;
  occurrence: number;
  current_control_prevention: string;
  current_control_detection: string;
  detection: number;
  rpn: number;
  recommended_action: string;
  action_priority: string;
  characteristics: {
    id: string;
    name: string;
    type: string;
    category: string;
    specification: string | null;
    lsl: number | null;
    usl: number | null;
    unit: string | null;
    measurement_method: string | null;
  };
}

interface LLMControlPlanOutput {
  control_method: string;
  sample_size: string;
  frequency: string;
  reaction_plan: string;
}

interface GenerateControlPlanResponse {
  success: boolean;
  error?: string;
  control_plan_id?: string;
  items_count?: number;
  generated_count?: number;
  traceability?: {
    pfmea_id: string;
    control_plan_id: string;
    linked_pfmea_lines: string[];
  };
}

// ============================================
// LLM Prompt Builder
// ============================================
function buildControlPlanPrompt(
  controlType: 'prevention' | 'detection',
  processStep: string,
  characteristicName: string,
  category: string,
  specification: string | null,
  failureMode: string,
  cause: string,
  currentControl: string
) {
  const systemPrompt = `당신은 IATF 16949 품질 시스템 전문가입니다.
Control Plan(관리계획서) 항목을 생성합니다.

반드시 JSON만 출력하라.
다음 스키마를 위반하면 실패로 간주한다:
{
  "control_method": "구체적인 관리/검사 방법",
  "sample_size": "샘플 크기 (예: n=5, 100%, 전수)",
  "frequency": "검사 주기 (예: 매 로트, 시간당, 1회/일)",
  "reaction_plan": "이상 발생 시 대응 계획"
}

관리 유형별 작성 기준:
- prevention(예방): 고장을 사전에 방지하는 방법
- detection(검출): 고장을 발견하는 검사 방법

중요도별 샘플링 기준:
- Critical: 100% 전수 검사 또는 높은 빈도
- Major: n=5 이상 샘플링
- Minor: n=3 샘플링 또는 주기적 검사`;

  const userPrompt = `다음 PFMEA 항목에 대한 Control Plan ${controlType === 'prevention' ? '예방' : '검출'} 항목을 생성하라:

공정 단계: ${processStep}
특성명: ${characteristicName}
중요도: ${category}
규격: ${specification || '해당없음'}
잠재 고장모드: ${failureMode}
잠재 원인: ${cause}
현재 관리방법: ${currentControl}

JSON만 출력하라.`;

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];
}

// ============================================
// Fallback: LLM 실패 시 규칙 기반 생성
// ============================================
function generateFallbackControlPlan(
  controlType: 'prevention' | 'detection',
  pfmeaLine: PfmeaLine
): LLMControlPlanOutput {
  const char = pfmeaLine.characteristics;
  const isCritical = char.category === 'critical';
  const isMajor = char.category === 'major';

  if (controlType === 'prevention') {
    return {
      control_method: pfmeaLine.current_control_prevention || '작업표준서 준수, 시작 전 점검',
      sample_size: isCritical ? '100%' : isMajor ? 'n=5' : 'n=3',
      frequency: isCritical ? '매 작업' : isMajor ? '매 로트' : '1회/일',
      reaction_plan: pfmeaLine.recommended_action || '작업 중지, 관리자 보고, 원인 분석',
    };
  } else {
    return {
      control_method: pfmeaLine.current_control_detection || char.measurement_method || '측정 검사',
      sample_size: isCritical ? '100%' : isMajor ? 'n=5' : 'n=3',
      frequency: isCritical ? '전수' : isMajor ? '매 로트' : '1회/shift',
      reaction_plan: '불합격품 격리, 재검사, 연속 NG 시 라인 정지',
    };
  }
}

// ============================================
// Main API Handler
// ============================================
export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  try {
    // 1. 요청 검증
    const body = await request.json();
    const { pfmea_id } = body;

    if (!pfmea_id) {
      return NextResponse.json<GenerateControlPlanResponse>(
        { success: false, error: 'pfmea_id is required' },
        { status: 400 }
      );
    }

    // 2. PFMEA 존재 확인
    const { data: pfmea, error: pfmeaError } = await supabase
      .from('pfmea_headers')
      .select('id, product_id, process_name')
      .eq('id', pfmea_id)
      .single();

    if (pfmeaError || !pfmea) {
      return NextResponse.json<GenerateControlPlanResponse>(
        { success: false, error: `PFMEA not found: ${pfmea_id}` },
        { status: 404 }
      );
    }

    // 3. Idempotent 체크: 기존 Control Plan 존재 여부 확인
    const { data: existingCp } = await supabase
      .from('control_plans')
      .select('id')
      .eq('pfmea_id', pfmea_id)
      .eq('status', 'draft')
      .single();

    if (existingCp) {
      const { count } = await supabase
        .from('control_plan_items')
        .select('id', { count: 'exact' })
        .eq('control_plan_id', existingCp.id);

      const { data: linkedLines } = await supabase
        .from('control_plan_items')
        .select('pfmea_line_id')
        .eq('control_plan_id', existingCp.id);

      return NextResponse.json<GenerateControlPlanResponse>({
        success: true,
        control_plan_id: existingCp.id,
        items_count: count || 0,
        traceability: {
          pfmea_id,
          control_plan_id: existingCp.id,
          linked_pfmea_lines: [...new Set(linkedLines?.map(l => l.pfmea_line_id) || [])],
        },
      });
    }

    // 4. PFMEA Lines + Characteristics 조회
    const { data: pfmeaLines, error: linesError } = await supabase
      .from('pfmea_lines')
      .select(`
        id,
        step_no,
        process_step,
        characteristic_id,
        potential_failure_mode,
        potential_effect,
        severity,
        potential_cause,
        occurrence,
        current_control_prevention,
        current_control_detection,
        detection,
        rpn,
        recommended_action,
        action_priority,
        characteristics:characteristic_id (
          id,
          name,
          type,
          category,
          specification,
          lsl,
          usl,
          unit,
          measurement_method
        )
      `)
      .eq('pfmea_id', pfmea_id)
      .order('step_no', { ascending: true });

    if (linesError || !pfmeaLines || pfmeaLines.length === 0) {
      return NextResponse.json<GenerateControlPlanResponse>(
        { success: false, error: 'No PFMEA lines found' },
        { status: 404 }
      );
    }

    // 5. Control Plan Header 생성
    const cpId = uuidv4();
    const { error: cpInsertError } = await supabase
      .from('control_plans')
      .insert({
        id: cpId,
        pfmea_id,
        name: `Control Plan - ${pfmea.process_name}`,
        revision: 1,
        status: 'draft',
      });

    if (cpInsertError) {
      throw new Error(`Failed to create Control Plan: ${cpInsertError.message}`);
    }

    // 6. Control Plan Items 생성 (각 PFMEA Line에 대해 예방/검출 2개씩)
    const cpItems: object[] = [];
    const linkedPfmeaLines: string[] = [];

    for (let i = 0; i < pfmeaLines.length; i++) {
      const line = pfmeaLines[i] as unknown as PfmeaLine;
      const char = line.characteristics;

      if (!char) {
        console.warn(`PFMEA line ${line.id} has no linked characteristic`);
        continue;
      }

      const specStr = char.specification ||
        (char.lsl !== null && char.usl !== null
          ? `${char.lsl}${char.unit || ''} ~ ${char.usl}${char.unit || ''}`
          : null);

      // 예방(Prevention) 항목 생성
      const preventionMessages = buildControlPlanPrompt(
        'prevention',
        line.process_step,
        char.name,
        char.category,
        specStr,
        line.potential_failure_mode,
        line.potential_cause,
        line.current_control_prevention
      );

      const preventionFallback = generateFallbackControlPlan('prevention', line);
      const preventionResult = await callLLMWithJSON<LLMControlPlanOutput>(
        preventionMessages,
        { control_method: '', sample_size: '', frequency: '', reaction_plan: '' },
        preventionFallback
      );

      cpItems.push({
        id: uuidv4(),
        control_plan_id: cpId,
        pfmea_line_id: line.id,
        characteristic_id: char.id,
        step_no: (i * 2) + 1,
        process_step: line.process_step,
        control_type: 'prevention',
        control_method: preventionResult.data.control_method,
        sample_size: preventionResult.data.sample_size,
        frequency: preventionResult.data.frequency,
        reaction_plan: preventionResult.data.reaction_plan,
        responsible: '작업자',
      });

      // 검출(Detection) 항목 생성
      const detectionMessages = buildControlPlanPrompt(
        'detection',
        line.process_step,
        char.name,
        char.category,
        specStr,
        line.potential_failure_mode,
        line.potential_cause,
        line.current_control_detection
      );

      const detectionFallback = generateFallbackControlPlan('detection', line);
      const detectionResult = await callLLMWithJSON<LLMControlPlanOutput>(
        detectionMessages,
        { control_method: '', sample_size: '', frequency: '', reaction_plan: '' },
        detectionFallback
      );

      cpItems.push({
        id: uuidv4(),
        control_plan_id: cpId,
        pfmea_line_id: line.id,
        characteristic_id: char.id,
        step_no: (i * 2) + 2,
        process_step: line.process_step,
        control_type: 'detection',
        control_method: detectionResult.data.control_method,
        sample_size: detectionResult.data.sample_size,
        frequency: detectionResult.data.frequency,
        reaction_plan: detectionResult.data.reaction_plan,
        responsible: 'QC',
      });

      linkedPfmeaLines.push(line.id);
    }

    // 7. Control Plan Items 일괄 삽입
    if (cpItems.length > 0) {
      const { error: itemsInsertError } = await supabase
        .from('control_plan_items')
        .insert(cpItems);

      if (itemsInsertError) {
        // Rollback: Control Plan 삭제
        await supabase.from('control_plans').delete().eq('id', cpId);
        throw new Error(`Failed to create Control Plan items: ${itemsInsertError.message}`);
      }
    }

    // 8. 성공 응답
    return NextResponse.json<GenerateControlPlanResponse>({
      success: true,
      control_plan_id: cpId,
      items_count: cpItems.length,
      generated_count: cpItems.length,
      traceability: {
        pfmea_id,
        control_plan_id: cpId,
        linked_pfmea_lines: linkedPfmeaLines,
      },
    });

  } catch (error) {
    console.error('Control Plan generation error:', error);
    return NextResponse.json<GenerateControlPlanResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// GET: Control Plan 조회
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const pfmeaId = searchParams.get('pfmea_id');

  if (!pfmeaId) {
    return NextResponse.json(
      { success: false, error: 'pfmea_id query param required' },
      { status: 400 }
    );
  }

  const { data: cp, error } = await supabase
    .from('control_plans')
    .select(`
      id,
      name,
      revision,
      status,
      created_at,
      control_plan_items (
        id,
        pfmea_line_id,
        characteristic_id,
        step_no,
        process_step,
        control_type,
        control_method,
        sample_size,
        frequency,
        reaction_plan,
        responsible
      )
    `)
    .eq('pfmea_id', pfmeaId)
    .order('revision', { ascending: false })
    .limit(1)
    .single();

  if (error || !cp) {
    return NextResponse.json(
      { success: false, error: 'Control Plan not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: cp });
}
