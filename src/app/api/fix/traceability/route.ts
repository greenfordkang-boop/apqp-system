/**
 * 추적성 자동 보완 API
 *
 * 누락된 문서를 순서대로 생성하여 추적성 체인을 완성한다.
 * 생성 순서: PFMEA → Control Plan → SOP → Inspection Standard
 *
 * 각 단계는 기존 생성 API와 동일한 로직을 내부 호출한다.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { product_id } = await request.json();
    if (!product_id) {
      return NextResponse.json({ success: false, error: 'product_id 필수' }, { status: 400 });
    }

    const baseUrl = request.nextUrl.origin;
    const steps: { step: string; status: string; id?: string; count?: number }[] = [];

    // Step 1: PFMEA 생성 (이미 있으면 기존 ID 반환 - idempotent)
    const pfmeaRes = await fetch(`${baseUrl}/api/generate/pfmea`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id }),
    });
    const pfmeaData = await pfmeaRes.json();

    if (!pfmeaData.success && !pfmeaData.pfmea_id) {
      return NextResponse.json({
        success: false,
        error: 'PFMEA 생성 실패',
        detail: pfmeaData.error,
        steps,
      });
    }

    const pfmeaId = pfmeaData.pfmea_id;
    steps.push({
      step: 'PFMEA',
      status: pfmeaData.lines_count !== undefined ? 'generated' : 'existing',
      id: pfmeaId,
      count: pfmeaData.lines_count ?? pfmeaData.generated_count,
    });

    // Step 2: Control Plan 생성
    const cpRes = await fetch(`${baseUrl}/api/generate/control-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pfmea_id: pfmeaId }),
    });
    const cpData = await cpRes.json();

    if (!cpData.success && !cpData.control_plan_id) {
      return NextResponse.json({
        success: false,
        error: 'Control Plan 생성 실패',
        detail: cpData.error,
        steps,
      });
    }

    const cpId = cpData.control_plan_id;
    steps.push({
      step: 'Control Plan',
      status: cpData.items_count !== undefined ? 'generated' : 'existing',
      id: cpId,
      count: cpData.items_count ?? cpData.generated_count,
    });

    // Step 3: SOP 생성
    const sopRes = await fetch(`${baseUrl}/api/generate/sop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ control_plan_id: cpId }),
    });
    const sopData = await sopRes.json();

    if (!sopData.success && !sopData.sop_id) {
      return NextResponse.json({
        success: false,
        error: 'SOP 생성 실패',
        detail: sopData.error,
        steps,
      });
    }

    steps.push({
      step: 'SOP',
      status: sopData.steps_count !== undefined ? 'generated' : 'existing',
      id: sopData.sop_id,
      count: sopData.steps_count,
    });

    // Step 4: Inspection Standard 생성
    const inspRes = await fetch(`${baseUrl}/api/generate/inspection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ control_plan_id: cpId }),
    });
    const inspData = await inspRes.json();

    if (!inspData.success && !inspData.inspection_standard_id) {
      return NextResponse.json({
        success: false,
        error: '검사기준서 생성 실패',
        detail: inspData.error,
        steps,
      });
    }

    steps.push({
      step: 'Inspection Standard',
      status: inspData.items_count !== undefined ? 'generated' : 'existing',
      id: inspData.inspection_standard_id,
      count: inspData.items_count ?? inspData.generated_count,
    });

    return NextResponse.json({
      success: true,
      product_id,
      steps,
      summary: {
        generated: steps.filter(s => s.status === 'generated').map(s => s.step),
        existing: steps.filter(s => s.status === 'existing').map(s => s.step),
      },
    });
  } catch (error) {
    console.error('Traceability fix error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
