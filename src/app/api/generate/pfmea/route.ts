/**
 * PFMEA (잠재고장모드분석) 자동 생성 API
 *
 * ====================================================
 * 설계 의도
 * ====================================================
 * 1. Product/Process의 Characteristics 기반으로 PFMEA 자동 생성
 * 2. Characteristic 1개 = PFMEA Line 1개 (1:1 관계)
 * 3. LLM으로 잠재 고장모드, 영향, 원인 등 자동 생성
 * 4. 추적성 보장: characteristic_id → pfmea_line_id
 *
 * ====================================================
 * 생성 규칙
 * ====================================================
 * - pfmea_lines.characteristic_id 반드시 연결
 * - Severity/Occurrence/Detection: 1~10 범위
 * - RPN = S × O × D (자동 계산)
 * - Action Priority: H/M/L (RPN 기반)
 *
 * ====================================================
 * API 특성
 * ====================================================
 * - Idempotent: 동일 product_id로 재호출 시 기존 PFMEA 반환
 * - Fallback: LLM 실패 시 규칙 기반 기본값 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { callLLMWithJSON } from '@/lib/llm';
import { v4 as uuidv4 } from 'uuid';

interface Characteristic {
  id: string;
  name: string;
  type: 'product' | 'process';
  category: 'critical' | 'major' | 'minor';
  specification: string | null;
  lsl: number | null;
  usl: number | null;
  unit: string | null;
  measurement_method: string | null;
  product_id: string;
  process_id: string;
}

interface Process {
  id: string;
  code: string;
  name: string;
}

interface LLMPfmeaOutput {
  potential_failure_mode: string;
  potential_effect: string;
  severity: number;
  potential_cause: string;
  occurrence: number;
  current_control_prevention: string;
  current_control_detection: string;
  detection: number;
  recommended_action: string;
}

interface GeneratePfmeaResponse {
  success: boolean;
  error?: string;
  pfmea_id?: string;
  lines_count?: number;
  generated_count?: number;
  traceability?: {
    product_id: string;
    pfmea_id: string;
    linked_characteristics: string[];
  };
}

// ============================================
// LLM Prompt Builder
// ============================================
function buildPfmeaPrompt(
  processName: string,
  characteristicName: string,
  characteristicType: string,
  category: string,
  specification: string | null
) {
  const systemPrompt = `당신은 IATF 16949 품질 시스템 전문가입니다.
PFMEA(공정 잠재고장모드 및 영향분석)를 생성합니다.

반드시 JSON만 출력하라.
다음 스키마를 위반하면 실패로 간주한다:
{
  "potential_failure_mode": "잠재 고장 모드 (특성이 규격을 벗어나는 방식)",
  "potential_effect": "고장의 잠재 영향 (고객/후공정에 미치는 영향)",
  "severity": 심각도(1-10, 숫자),
  "potential_cause": "고장의 잠재 원인 (왜 이런 고장이 발생하는가)",
  "occurrence": 발생도(1-10, 숫자),
  "current_control_prevention": "현재 예방 관리 방법",
  "current_control_detection": "현재 검출 관리 방법",
  "detection": 검출도(1-10, 숫자),
  "recommended_action": "권고 조치 사항"
}

평가 기준:
- Severity(심각도): 10=안전/법규 위반, 8-9=주요 기능 상실, 5-7=성능 저하, 1-4=경미
- Occurrence(발생도): 10=매우 높음, 7-9=높음, 4-6=보통, 1-3=낮음
- Detection(검출도): 10=검출 불가, 7-9=검출 어려움, 4-6=보통, 1-3=쉽게 검출

Critical 특성은 Severity 8 이상, Major는 6-7, Minor는 4-5로 시작`;

  const userPrompt = `다음 공정 특성에 대한 PFMEA Line을 생성하라:

공정명: ${processName}
특성명: ${characteristicName}
특성 유형: ${characteristicType}
중요도: ${category}
규격: ${specification || '해당없음'}

JSON만 출력하라.`;

  return [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: userPrompt },
  ];
}

// ============================================
// Fallback: LLM 실패 시 규칙 기반 생성
// ============================================
function generateFallbackPfmea(
  char: Characteristic,
  processName: string
): LLMPfmeaOutput {
  // 중요도별 기본 Severity
  const severityMap = { critical: 8, major: 6, minor: 4 };
  const baseSeverity = severityMap[char.category] || 5;

  const specStr = char.specification ||
    (char.lsl !== null && char.usl !== null
      ? `${char.lsl}${char.unit || ''} ~ ${char.usl}${char.unit || ''}`
      : '규격 미정');

  return {
    potential_failure_mode: `${char.name} 규격 이탈 (${specStr})`,
    potential_effect: char.category === 'critical'
      ? '제품 기능 불량, 고객 클레임 발생 가능'
      : char.category === 'major'
        ? '제품 성능 저하, 품질 이슈 가능'
        : '외관 불량, 경미한 품질 저하',
    severity: baseSeverity,
    potential_cause: `${processName} 공정 변동, 설비 이상, 작업자 실수`,
    occurrence: 5,
    current_control_prevention: '작업표준서 준수, 정기 점검',
    current_control_detection: char.measurement_method || '육안 검사, 측정 검사',
    detection: 5,
    recommended_action: char.category === 'critical'
      ? '실수방지 장치 도입, 100% 검사 강화'
      : '샘플링 검사 강화, 작업자 교육',
  };
}

// ============================================
// Action Priority 결정 (RPN 기반)
// ============================================
function getActionPriority(rpn: number): 'H' | 'M' | 'L' {
  if (rpn >= 200) return 'H';
  if (rpn >= 100) return 'M';
  return 'L';
}

// ============================================
// Main API Handler
// ============================================
export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  try {
    // 1. 요청 검증
    const body = await request.json();
    const { product_id } = body;

    if (!product_id) {
      return NextResponse.json<GeneratePfmeaResponse>(
        { success: false, error: 'product_id is required' },
        { status: 400 }
      );
    }

    // 2. Product 존재 확인
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, code, name')
      .eq('id', product_id)
      .single();

    if (productError || !product) {
      return NextResponse.json<GeneratePfmeaResponse>(
        { success: false, error: `Product not found: ${product_id}` },
        { status: 404 }
      );
    }

    // 3. Idempotent 체크: 기존 PFMEA 존재 여부 확인
    const { data: existingPfmea } = await supabase
      .from('pfmea_headers')
      .select('id')
      .eq('product_id', product_id)
      .eq('status', 'draft')
      .single();

    if (existingPfmea) {
      const { count } = await supabase
        .from('pfmea_lines')
        .select('id', { count: 'exact' })
        .eq('pfmea_id', existingPfmea.id);

      const { data: linkedChars } = await supabase
        .from('pfmea_lines')
        .select('characteristic_id')
        .eq('pfmea_id', existingPfmea.id);

      return NextResponse.json<GeneratePfmeaResponse>({
        success: true,
        pfmea_id: existingPfmea.id,
        lines_count: count || 0,
        traceability: {
          product_id,
          pfmea_id: existingPfmea.id,
          linked_characteristics: linkedChars?.map(l => l.characteristic_id).filter(Boolean) as string[] || [],
        },
      });
    }

    // 4. Characteristics 조회 (product_id 기준)
    const { data: characteristics, error: charError } = await supabase
      .from('characteristics')
      .select('*, processes:process_id(id, code, name)')
      .eq('product_id', product_id);

    if (charError || !characteristics || characteristics.length === 0) {
      return NextResponse.json<GeneratePfmeaResponse>(
        { success: false, error: 'No characteristics found for this product' },
        { status: 404 }
      );
    }

    // 5. Process 정보 가져오기 (첫 번째 특성의 공정 사용)
    const processInfo = characteristics[0]?.processes as unknown as Process;
    const processName = processInfo?.name || `${product.name} 공정`;

    // 6. PFMEA Header 생성
    const pfmeaId = uuidv4();
    const { error: pfmeaInsertError } = await supabase
      .from('pfmea_headers')
      .insert({
        id: pfmeaId,
        product_id: product_id,
        process_name: processName,
        revision: 1,
        status: 'draft',
      });

    if (pfmeaInsertError) {
      throw new Error(`Failed to create PFMEA header: ${pfmeaInsertError.message}`);
    }

    // 7. PFMEA Lines 생성 (각 Characteristic 순회)
    const pfmeaLines: object[] = [];
    const linkedCharacteristics: string[] = [];

    for (let i = 0; i < characteristics.length; i++) {
      const char = characteristics[i] as Characteristic;
      const charProcess = char.process_id
        ? (characteristics[i]?.processes as unknown as Process)
        : null;
      const stepProcessName = charProcess?.name || processName;

      // LLM으로 PFMEA 내용 생성 시도
      const messages = buildPfmeaPrompt(
        stepProcessName,
        char.name,
        char.type,
        char.category,
        char.specification
      );

      const fallback = generateFallbackPfmea(char, stepProcessName);
      const llmResult = await callLLMWithJSON<LLMPfmeaOutput>(
        messages,
        {
          potential_failure_mode: '',
          potential_effect: '',
          severity: 0,
          potential_cause: '',
          occurrence: 0,
          current_control_prevention: '',
          current_control_detection: '',
          detection: 0,
          recommended_action: '',
        },
        fallback
      );

      const data = llmResult.data;

      // Clamp values to valid range (1-10)
      const severity = Math.max(1, Math.min(10, data.severity));
      const occurrence = Math.max(1, Math.min(10, data.occurrence));
      const detection = Math.max(1, Math.min(10, data.detection));
      const rpn = severity * occurrence * detection;

      pfmeaLines.push({
        id: uuidv4(),
        pfmea_id: pfmeaId,
        step_no: i + 1,
        process_step: stepProcessName,
        characteristic_id: char.id,
        potential_failure_mode: data.potential_failure_mode,
        potential_effect: data.potential_effect,
        severity,
        potential_cause: data.potential_cause,
        occurrence,
        current_control_prevention: data.current_control_prevention,
        current_control_detection: data.current_control_detection,
        detection,
        recommended_action: data.recommended_action,
        action_priority: getActionPriority(rpn),
      });

      linkedCharacteristics.push(char.id);
    }

    // 8. PFMEA Lines 일괄 삽입
    if (pfmeaLines.length > 0) {
      const { error: linesInsertError } = await supabase
        .from('pfmea_lines')
        .insert(pfmeaLines);

      if (linesInsertError) {
        // Rollback: PFMEA Header 삭제
        await supabase.from('pfmea_headers').delete().eq('id', pfmeaId);
        throw new Error(`Failed to create PFMEA lines: ${linesInsertError.message}`);
      }
    }

    // 9. 성공 응답
    return NextResponse.json<GeneratePfmeaResponse>({
      success: true,
      pfmea_id: pfmeaId,
      lines_count: pfmeaLines.length,
      generated_count: pfmeaLines.length,
      traceability: {
        product_id,
        pfmea_id: pfmeaId,
        linked_characteristics: linkedCharacteristics,
      },
    });

  } catch (error) {
    console.error('PFMEA generation error:', error);
    return NextResponse.json<GeneratePfmeaResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// GET: PFMEA 조회
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { searchParams } = new URL(request.url);
  const productId = searchParams.get('product_id');

  if (!productId) {
    return NextResponse.json(
      { success: false, error: 'product_id query param required' },
      { status: 400 }
    );
  }

  const { data: pfmea, error } = await supabase
    .from('pfmea_headers')
    .select(`
      id,
      process_name,
      revision,
      status,
      created_at,
      pfmea_lines (
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
        action_priority
      )
    `)
    .eq('product_id', productId)
    .order('revision', { ascending: false })
    .limit(1)
    .single();

  if (error || !pfmea) {
    return NextResponse.json(
      { success: false, error: 'PFMEA not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, data: pfmea });
}
