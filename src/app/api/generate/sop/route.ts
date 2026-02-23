/**
 * SOP (작업표준서) 생성 API
 *
 * ====================================================
 * 설계 의도
 * ====================================================
 * 1. Control Plan을 기반으로 SOP를 자동 생성
 * 2. CP item 1개 = SOP step 최소 1개 (1:N 관계)
 * 3. Characteristic은 절대 복제하지 않음 (FK 참조만)
 * 4. 추적성 보장: control_plan_item_id → sop_step_id
 *
 * ====================================================
 * 생성 규칙
 * ====================================================
 * - sop_steps.linked_cp_item_id 반드시 연결
 * - SOP는 "작업자 기준 문장"으로 작성
 * - key_point 필수 포함:
 *   ① 관리 포인트
 *   ② 검사/확인 방법
 *   ③ 이상 발생 시 즉시 조치 요약
 *
 * ====================================================
 * API 특성
 * ====================================================
 * - Idempotent: 동일 control_plan_id로 재호출 시 기존 SOP 반환
 * - Fallback: LLM 실패 시 규칙 기반 기본값 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { callLLMWithJSON, buildSopStepPrompt } from '@/lib/llm';
import { v4 as uuidv4 } from 'uuid';
import type {
  GenerateSopRequest,
  GenerateSopResponse,
  ControlPlanItem,
  Characteristic,
  LLMSopStepOutput,
  SopStep,
} from '@/types/database';

// ============================================
// Fallback 로직: LLM 실패 시 규칙 기반 생성
// ============================================
function generateFallbackSopStep(
  cpItem: ControlPlanItem & { characteristic: Characteristic }
): LLMSopStepOutput {
  const char = cpItem.characteristic;
  const specStr = char.specification ||
    (char.lsl !== null && char.usl !== null
      ? `${char.lsl}${char.unit || ''} ~ ${char.usl}${char.unit || ''}`
      : '규격 확인 필요');

  // 관리 포인트
  const controlPoint = `${char.name}: ${specStr}`;

  // 검사/확인 방법
  const checkMethod = char.measurement_method
    ? `${char.measurement_method}으로 측정`
    : cpItem.control_method;

  // 이상 조치
  const abnormalAction = cpItem.reaction_plan || '이상 발생 시 즉시 라인 정지 및 관리자 보고';

  return {
    action: `${cpItem.process_step} - ${cpItem.control_method} 실시`,
    key_point: `【관리 포인트】${controlPoint}\n【확인 방법】${checkMethod}\n【이상 조치】${abnormalAction}`,
    safety_note: null,
    estimated_time_sec: 60,
  };
}

// ============================================
// Main API Handler
// ============================================
export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  try {
    // 1. 요청 검증
    const body: GenerateSopRequest = await request.json();
    const { control_plan_id } = body;

    if (!control_plan_id) {
      return NextResponse.json<GenerateSopResponse>(
        { success: false, error: 'control_plan_id is required' },
        { status: 400 }
      );
    }

    // 2. Idempotent 체크: 기존 SOP 존재 여부 확인
    const { data: existingSop } = await supabase
      .from('sops')
      .select('id')
      .eq('control_plan_id', control_plan_id)
      .eq('status', 'draft')
      .single();

    if (existingSop) {
      // 기존 SOP가 있으면 스텝 수 조회 후 반환
      const { count } = await supabase
        .from('sop_steps')
        .select('id', { count: 'exact' })
        .eq('sop_id', existingSop.id);

      const { data: linkedItems } = await supabase
        .from('sop_steps')
        .select('linked_cp_item_id')
        .eq('sop_id', existingSop.id);

      return NextResponse.json<GenerateSopResponse>({
        success: true,
        sop_id: existingSop.id,
        steps_count: count || 0,
        traceability: {
          control_plan_id,
          sop_id: existingSop.id,
          linked_cp_items: linkedItems?.map(i => i.linked_cp_item_id) || [],
        },
      });
    }

    // 3. Control Plan 존재 확인
    const { data: controlPlan, error: cpError } = await supabase
      .from('control_plans')
      .select('id, pfmea_id, product_id, name')
      .eq('id', control_plan_id)
      .single();

    if (cpError || !controlPlan) {
      return NextResponse.json<GenerateSopResponse>(
        { success: false, error: `Control Plan not found: ${control_plan_id}` },
        { status: 404 }
      );
    }

    // 4. Control Plan Items + Characteristics 조회
    const { data: cpItems, error: itemsError } = await supabase
      .from('control_plan_items')
      .select(`
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
        responsible,
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
      .eq('control_plan_id', control_plan_id)
      .order('step_no', { ascending: true });

    if (itemsError || !cpItems || cpItems.length === 0) {
      return NextResponse.json<GenerateSopResponse>(
        { success: false, error: 'No Control Plan items found' },
        { status: 404 }
      );
    }

    // 5. SOP 헤더 생성
    const sopId = uuidv4();
    const { error: sopInsertError } = await supabase
      .from('sops')
      .insert({
        id: sopId,
        control_plan_id,
        name: `SOP - ${controlPlan.name}`,
        revision: 1,
        status: 'draft',
      });

    if (sopInsertError) {
      throw new Error(`Failed to create SOP: ${sopInsertError.message}`);
    }

    // 6. SOP Steps 생성 (CP item 순회)
    const sopSteps: Partial<SopStep>[] = [];
    const linkedCpItems: string[] = [];

    for (let i = 0; i < cpItems.length; i++) {
      const cpItem = cpItems[i];
      const characteristic = cpItem.characteristics as unknown as Characteristic;

      if (!characteristic) {
        console.warn(`CP item ${cpItem.id} has no linked characteristic`);
        continue;
      }

      // LLM으로 SOP Step 내용 생성 시도
      const messages = buildSopStepPrompt(
        cpItem.process_step,
        cpItem.control_method,
        cpItem.control_type,
        cpItem.reaction_plan,
        characteristic.name,
        characteristic.specification
      );

      const fallback = generateFallbackSopStep({
        ...cpItem,
        characteristic,
      } as unknown as ControlPlanItem & { characteristic: Characteristic });
      const llmResult = await callLLMWithJSON<LLMSopStepOutput>(
        messages,
        { action: '', key_point: '', safety_note: '', estimated_time_sec: 0 },
        fallback
      );

      const stepData = llmResult.data;

      // SOP Step 데이터 구성
      sopSteps.push({
        id: uuidv4(),
        sop_id: sopId,
        linked_cp_item_id: cpItem.id,  // ⭕ FK 연결 필수!
        step_no: i + 1,
        process_step: cpItem.process_step,
        action: stepData.action,
        key_point: stepData.key_point,
        safety_note: stepData.safety_note || '',
        quality_point: `${characteristic.category === 'critical' ? '★ 중요특성 - ' : ''}${cpItem.control_method}으로 확인`,
        tools_equipment: characteristic.measurement_method || '측정기기',
        estimated_time_sec: stepData.estimated_time_sec ?? 120,
      });

      linkedCpItems.push(cpItem.id);
    }

    // 7. SOP Steps 일괄 삽입
    if (sopSteps.length > 0) {
      const { error: stepsInsertError } = await supabase
        .from('sop_steps')
        .insert(sopSteps);

      if (stepsInsertError) {
        // Rollback: SOP 삭제
        await supabase.from('sops').delete().eq('id', sopId);
        throw new Error(`Failed to create SOP steps: ${stepsInsertError.message}`);
      }
    }

    // 8. 성공 응답
    return NextResponse.json<GenerateSopResponse>({
      success: true,
      sop_id: sopId,
      steps_count: sopSteps.length,
      traceability: {
        control_plan_id,
        sop_id: sopId,
        linked_cp_items: linkedCpItems,
      },
    });

  } catch (error) {
    console.error('SOP generation error:', error);
    return NextResponse.json<GenerateSopResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// GET: SOP 조회 (선택적)
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const controlPlanId = searchParams.get('control_plan_id');

  if (!controlPlanId) {
    return NextResponse.json(
      { success: false, error: 'control_plan_id query param required' },
      { status: 400 }
    );
  }

  const { data: sop, error } = await supabase
    .from('sops')
    .select(`
      id,
      name,
      revision,
      status,
      created_at,
      sop_steps (
        id,
        linked_cp_item_id,
        step_no,
        process_step,
        action,
        key_point,
        safety_note,
        quality_point,
        tools_equipment,
        estimated_time_sec
      )
    `)
    .eq('control_plan_id', controlPlanId)
    .order('revision', { ascending: false })
    .limit(1)
    .single();

  if (error || !sop) {
    return NextResponse.json(
      { success: false, error: 'SOP not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: sop });
}
