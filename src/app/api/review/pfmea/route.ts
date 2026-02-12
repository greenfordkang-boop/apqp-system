/**
 * PFMEA AI 검토 API
 *
 * PFMEA 전체 항목을 LLM에 전달하여 다음을 분석:
 * - S/O/D 값의 적절성
 * - 고장모드 누락 가능성
 * - 관리방안의 충분성
 * - RPN 기반 우선순위 적절성
 */

import { NextRequest, NextResponse } from 'next/server';
import { callLLMWithJSON, type LLMMessage } from '@/lib/llm';

interface PfmeaLineInput {
  process_step: string;
  characteristic_name: string;
  potential_failure_mode: string;
  potential_effect: string;
  severity: number;
  potential_cause: string;
  occurrence: number;
  current_control_prevention: string;
  current_control_detection: string;
  detection: number;
  rpn: number;
  action_priority: string;
  recommended_action: string;
}

interface ReviewFinding {
  type: 'warning' | 'improvement' | 'missing';
  target: string;
  message: string;
}

interface ReviewResult {
  overall_score: number;
  findings: ReviewFinding[];
  summary: string;
}

function buildReviewPrompt(
  productName: string,
  processName: string,
  lines: PfmeaLineInput[]
): LLMMessage[] {
  const linesText = lines.map((l, i) => (
    `[${i + 1}] 공정: ${l.process_step} | 특성: ${l.characteristic_name} | 고장모드: ${l.potential_failure_mode} | 영향: ${l.potential_effect} | S=${l.severity} O=${l.occurrence} D=${l.detection} RPN=${l.rpn} | 원인: ${l.potential_cause} | 예방: ${l.current_control_prevention} | 검출: ${l.current_control_detection} | 조치: ${l.recommended_action}`
  )).join('\n');

  const systemPrompt = `당신은 IATF 16949 품질 시스템 전문 심사원입니다.
PFMEA(공정 잠재고장모드 및 영향분석) 문서를 검토하여 개선점을 제시합니다.

반드시 JSON만 출력하라. 다음 스키마를 엄격히 준수하라:
{
  "overall_score": 100점 만점 점수(숫자),
  "findings": [
    {
      "type": "warning" 또는 "improvement" 또는 "missing",
      "target": "해당 항목 번호 또는 영역 (예: '[1] 조립공정' 또는 '전체')",
      "message": "구체적인 검토 의견"
    }
  ],
  "summary": "전체 검토 요약 (2-3문장)"
}

검토 기준:
1. S/O/D 평가의 적절성 (AIAG FMEA 4th edition 기준)
   - Severity: 안전/법규=9-10, 주기능=7-8, 성능저하=4-6, 경미=1-3
   - Occurrence: Cpk 기반 (높은 Cpk=낮은 O)
   - Detection: 실시간 자동검출=1-2, SPC=3-4, 수동검사=5-7, 검출불가=8-10
2. 고장모드의 포괄성 (누락된 잠재 고장모드 확인)
3. 원인-고장모드 연결의 논리성
4. 관리방안(예방/검출)의 충분성
5. RPN 200 이상 항목의 권장조치 적절성
6. Action Priority와 RPN의 일관성

type 분류:
- warning: S/O/D 값이 부적절하거나 관리방안이 불충분한 경우
- improvement: 현재 수준에서 개선 가능한 사항
- missing: 누락된 고장모드나 관리방안`;

  const userPrompt = `다음 PFMEA를 검토하라:

제품: ${productName}
공정: ${processName}
항목 수: ${lines.length}

--- PFMEA 항목 ---
${linesText}
--- 끝 ---

JSON만 출력하라.`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

function generateFallbackReview(lines: PfmeaLineInput[]): ReviewResult {
  const findings: ReviewFinding[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const label = `[${i + 1}] ${line.process_step}`;

    if (line.rpn >= 200 && (!line.recommended_action || line.recommended_action.length < 10)) {
      findings.push({
        type: 'warning',
        target: label,
        message: `RPN ${line.rpn}(고위험)이나 권장조치가 불충분합니다. 구체적인 개선 조치를 추가하세요.`,
      });
    }

    if (line.severity >= 8 && line.detection >= 7) {
      findings.push({
        type: 'warning',
        target: label,
        message: `심각도(${line.severity})가 높고 검출도(${line.detection})도 높아 위험합니다. 검출 관리를 강화하세요.`,
      });
    }

    if (line.occurrence >= 6 && (!line.current_control_prevention || line.current_control_prevention.length < 5)) {
      findings.push({
        type: 'improvement',
        target: label,
        message: `발생도(${line.occurrence})가 높으나 예방 관리가 불충분합니다. 예방 조치를 보강하세요.`,
      });
    }
  }

  const highRiskCount = lines.filter(l => l.rpn >= 200).length;
  if (highRiskCount === 0 && lines.length > 0) {
    findings.push({
      type: 'improvement',
      target: '전체',
      message: '고위험 항목이 없어 양호하나, S/O/D 값이 실제 공정 데이터를 반영하는지 확인하세요.',
    });
  }

  const score = Math.max(40, 100 - findings.filter(f => f.type === 'warning').length * 10 - findings.filter(f => f.type === 'improvement').length * 5);

  return {
    overall_score: score,
    findings,
    summary: `총 ${lines.length}개 항목 검토 완료. ${findings.filter(f => f.type === 'warning').length}건의 경고, ${findings.filter(f => f.type === 'improvement').length}건의 개선사항이 발견되었습니다.`,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product_name, process_name, lines } = body as {
      product_name: string;
      process_name: string;
      lines: PfmeaLineInput[];
    };

    if (!lines || lines.length === 0) {
      return NextResponse.json({ success: false, error: 'PFMEA lines are required' }, { status: 400 });
    }

    const messages = buildReviewPrompt(product_name || '제품', process_name || '공정', lines);
    const fallback = generateFallbackReview(lines);

    const result = await callLLMWithJSON<ReviewResult>(
      messages,
      { overall_score: 0, findings: [], summary: '' },
      fallback
    );

    return NextResponse.json({ success: true, review: result.data, ai_powered: result.success });
  } catch (error) {
    console.error('PFMEA review error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
