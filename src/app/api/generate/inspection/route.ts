/**
 * 검사기준서 (Inspection Standard) 생성 API
 *
 * ====================================================
 * 설계 의도
 * ====================================================
 * 1. Control Plan을 기반으로 검사기준서를 자동 생성
 * 2. CP item 1개 = Inspection item 1개 (1:1 관계)
 * 3. Characteristic은 절대 복제하지 않음 (FK 참조만)
 * 4. 추적성 보장: control_plan_item_id → inspection_item_id
 *
 * ====================================================
 * 생성 규칙
 * ====================================================
 * - inspection_items.linked_cp_item_id 필수 연결
 * - sampling_plan: CP의 sample_size + frequency 그대로 반영
 * - acceptance_criteria: 반드시 정량화
 *   · 치수: LSL ~ USL
 *   · 외관: "한도 샘플 기준 일치" 형태
 * - ng_handling 필수 포함:
 *   ① 격리
 *   ② 재검
 *   ③ 원인분석 트리거
 *
 * ====================================================
 * API 특성
 * ====================================================
 * - Idempotent: 동일 control_plan_id로 재호출 시 기존 검사기준서 반환
 * - Fallback: LLM 실패 시 규칙 기반 기본값 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { callLLMWithJSON, buildInspectionItemPrompt } from '@/lib/llm';
import { v4 as uuidv4 } from 'uuid';
import type {
  GenerateInspectionRequest,
  GenerateInspectionResponse,
  ControlPlanItem,
  Characteristic,
  LLMInspectionItemOutput,
  InspectionItem,
} from '@/types/database';

// ============================================
// Fallback 로직: LLM 실패 시 규칙 기반 생성
// ============================================
function generateFallbackInspectionItem(
  cpItem: ControlPlanItem & { characteristic: Characteristic }
): LLMInspectionItemOutput {
  const char = cpItem.characteristic;

  // acceptance_criteria 정량화
  let acceptanceCriteria: string;
  if (char.lsl !== null && char.usl !== null) {
    acceptanceCriteria = `${char.lsl}${char.unit || ''} ~ ${char.usl}${char.unit || ''}`;
  } else if (char.lsl !== null) {
    acceptanceCriteria = `≥ ${char.lsl}${char.unit || ''}`;
  } else if (char.usl !== null) {
    acceptanceCriteria = `≤ ${char.usl}${char.unit || ''}`;
  } else if (char.specification) {
    acceptanceCriteria = char.specification;
  } else if (char.type === 'product' && char.category === 'critical') {
    acceptanceCriteria = '한도 샘플 기준 일치 (Critical 특성)';
  } else {
    acceptanceCriteria = '한도 샘플 기준 일치';
  }

  // ng_handling: 격리 + 재검 + 원인분석 트리거
  const ngHandling = `【격리】불합격품 즉시 NG BOX 격리, 식별 라벨 부착
【재검】동일 조건 3회 재측정, 2회 이상 합격 시 Pass
【원인분석】연속 3개 NG 발생 시 라인 정지 및 4M 분석 착수`;

  return {
    inspection_item_name: `${char.name} 검사`,
    inspection_method: char.measurement_method || cpItem.control_method,
    acceptance_criteria: acceptanceCriteria,
    ng_handling: ngHandling,
  };
}

// ============================================
// Main API Handler
// ============================================
export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  try {
    // 1. 요청 검증
    const body: GenerateInspectionRequest = await request.json();
    const { control_plan_id } = body;

    if (!control_plan_id) {
      return NextResponse.json<GenerateInspectionResponse>(
        { success: false, error: 'control_plan_id is required' },
        { status: 400 }
      );
    }

    // 2. Idempotent 체크: 기존 검사기준서 존재 여부 확인
    const { data: existingStandard } = await supabase
      .from('inspection_standards')
      .select('id')
      .eq('control_plan_id', control_plan_id)
      .eq('status', 'draft')
      .single();

    if (existingStandard) {
      // 기존 검사기준서가 있으면 아이템 수 조회 후 반환
      const { count } = await supabase
        .from('inspection_items')
        .select('id', { count: 'exact' })
        .eq('inspection_standard_id', existingStandard.id);

      const { data: linkedItems } = await supabase
        .from('inspection_items')
        .select('linked_cp_item_id')
        .eq('inspection_standard_id', existingStandard.id);

      return NextResponse.json<GenerateInspectionResponse>({
        success: true,
        inspection_standard_id: existingStandard.id,
        items_count: count || 0,
        traceability: {
          control_plan_id,
          inspection_standard_id: existingStandard.id,
          linked_cp_items: linkedItems?.map(i => i.linked_cp_item_id) || [],
        },
      });
    }

    // 3. Control Plan 존재 확인
    const { data: controlPlan, error: cpError } = await supabase
      .from('control_plans')
      .select('id, pfmea_id, name')
      .eq('id', control_plan_id)
      .single();

    if (cpError || !controlPlan) {
      return NextResponse.json<GenerateInspectionResponse>(
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
      return NextResponse.json<GenerateInspectionResponse>(
        { success: false, error: 'No Control Plan items found' },
        { status: 404 }
      );
    }

    // 5. 검사기준서 헤더 생성
    const inspectionStandardId = uuidv4();
    const { error: standardInsertError } = await supabase
      .from('inspection_standards')
      .insert({
        id: inspectionStandardId,
        control_plan_id,
        name: `검사기준서 - ${controlPlan.name}`,
        revision: 1,
        status: 'draft',
      });

    if (standardInsertError) {
      throw new Error(`Failed to create Inspection Standard: ${standardInsertError.message}`);
    }

    // 6. Inspection Items 생성 (CP item 순회)
    const inspectionItems: Partial<InspectionItem>[] = [];
    const linkedCpItems: string[] = [];

    for (let i = 0; i < cpItems.length; i++) {
      const cpItem = cpItems[i];
      const characteristic = cpItem.characteristics as unknown as Characteristic;

      if (!characteristic) {
        console.warn(`CP item ${cpItem.id} has no linked characteristic`);
        continue;
      }

      // sampling_plan: CP의 sample_size + frequency 그대로 반영
      const samplingPlan = `${cpItem.sample_size} / ${cpItem.frequency}`;

      // LLM으로 검사 항목 내용 생성 시도
      const messages = buildInspectionItemPrompt(
        characteristic.name,
        characteristic.type,
        characteristic.lsl,
        characteristic.usl,
        characteristic.unit,
        characteristic.measurement_method,
        cpItem.sample_size,
        cpItem.frequency
      );

      const fallback = generateFallbackInspectionItem({
        ...cpItem,
        characteristic,
      } as unknown as ControlPlanItem & { characteristic: Characteristic });
      const llmResult = await callLLMWithJSON<LLMInspectionItemOutput>(
        messages,
        { inspection_item_name: '', inspection_method: '', acceptance_criteria: '', ng_handling: '' },
        fallback
      );

      const itemData = llmResult.data;

      // Inspection Item 데이터 구성
      inspectionItems.push({
        id: uuidv4(),
        inspection_standard_id: inspectionStandardId,
        linked_cp_item_id: cpItem.id,        // ⭕ FK 연결 필수!
        characteristic_id: characteristic.id, // ⭕ FK 연결 필수!
        item_no: i + 1,
        inspection_item_name: itemData.inspection_item_name,
        inspection_method: itemData.inspection_method,
        sampling_plan: samplingPlan,          // CP 값 그대로 반영
        acceptance_criteria: itemData.acceptance_criteria,
        measurement_equipment: characteristic.measurement_method,
        ng_handling: itemData.ng_handling,
      });

      linkedCpItems.push(cpItem.id);
    }

    // 7. Inspection Items 일괄 삽입
    if (inspectionItems.length > 0) {
      const { error: itemsInsertError } = await supabase
        .from('inspection_items')
        .insert(inspectionItems);

      if (itemsInsertError) {
        // Rollback: 검사기준서 삭제
        await supabase.from('inspection_standards').delete().eq('id', inspectionStandardId);
        throw new Error(`Failed to create Inspection items: ${itemsInsertError.message}`);
      }
    }

    // 8. 성공 응답
    return NextResponse.json({
      success: true,
      inspection_standard_id: inspectionStandardId,
      items_count: inspectionItems.length,
      generated_count: inspectionItems.length,  // backward compatibility
      traceability: {
        control_plan_id,
        inspection_standard_id: inspectionStandardId,
        linked_cp_items: linkedCpItems,
      },
    });

  } catch (error) {
    console.error('Inspection Standard generation error:', error);
    return NextResponse.json<GenerateInspectionResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// GET: 검사기준서 조회 (선택적)
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

  const { data: standard, error } = await supabase
    .from('inspection_standards')
    .select(`
      id,
      name,
      revision,
      status,
      created_at,
      inspection_items (
        id,
        linked_cp_item_id,
        characteristic_id,
        item_no,
        inspection_item_name,
        inspection_method,
        sampling_plan,
        acceptance_criteria,
        measurement_equipment,
        ng_handling
      )
    `)
    .eq('control_plan_id', controlPlanId)
    .order('revision', { ascending: false })
    .limit(1)
    .single();

  if (error || !standard) {
    return NextResponse.json(
      { success: false, error: 'Inspection Standard not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: standard });
}
