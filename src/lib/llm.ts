/**
 * LLM Utility for APQP System
 *
 * 규칙:
 * 1. LLM 출력은 반드시 JSON 스키마로 강제
 * 2. "설명" 요구 ❌, "JSON만 출력" ⭕
 * 3. 실패 시 fallback 로직 포함
 */

export interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

function getLLMConfig(): LLMConfig {
  return {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  };
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM 호출 - JSON only 강제
 * 실패 시 3회 재시도 후 fallback 반환
 */
export async function callLLMWithJSON<T>(
  messages: LLMMessage[],
  schema: object,
  fallback: T,
  maxRetries: number = 3
): Promise<{ success: boolean; data: T; raw?: string }> {
  const config = getLLMConfig();

  if (!config.apiKey) {
    console.warn('LLM API key not configured, using fallback');
    return { success: false, data: fallback };
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`LLM API error: ${response.status}`);
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from LLM');
      }

      // JSON 파싱 시도
      const parsed = JSON.parse(content) as T;

      // 기본 스키마 검증 (필수 키 존재 여부)
      const requiredKeys = Object.keys(schema);
      const parsedKeys = Object.keys(parsed as object);
      const missingKeys = requiredKeys.filter(k => !parsedKeys.includes(k));

      if (missingKeys.length > 0) {
        throw new Error(`Missing required keys: ${missingKeys.join(', ')}`);
      }

      return { success: true, data: parsed, raw: content };
    } catch (error) {
      console.error(`LLM attempt ${attempt} failed:`, error);
      if (attempt === maxRetries) {
        console.warn('All LLM attempts failed, using fallback');
        return { success: false, data: fallback };
      }
      // 재시도 전 대기
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }

  return { success: false, data: fallback };
}

/**
 * SOP Step 생성을 위한 LLM 프롬프트 생성
 */
export function buildSopStepPrompt(
  processStep: string,
  controlMethod: string,
  controlType: string,
  reactionPlan: string,
  characteristicName: string,
  specification: string | null
): LLMMessage[] {
  const systemPrompt = `당신은 제조업 품질 시스템 전문가입니다.
작업표준서(SOP) 스텝을 생성합니다.

반드시 JSON만 출력하라.
다음 스키마를 위반하면 실패로 간주한다:
{
  "action": "작업자가 수행할 구체적 행동 (명령형 문장)",
  "key_point": "관리 포인트 + 검사/확인 방법 + 이상 발생 시 즉시 조치",
  "safety_note": "안전 주의사항 (없으면 null)",
  "estimated_time_sec": 예상 소요시간(초, 숫자)
}

key_point 작성 규칙:
1. 관리 포인트: 특성의 허용 범위 또는 기준
2. 검사/확인 방법: 어떻게 확인하는지 구체적으로
3. 이상 조치: 불량 발생 시 즉시 해야 할 행동`;

  const userPrompt = `다음 Control Plan 항목에 대한 SOP Step을 생성하라:

공정 단계: ${processStep}
특성명: ${characteristicName}
규격: ${specification || '해당없음'}
관리 유형: ${controlType}
관리 방법: ${controlMethod}
Reaction Plan: ${reactionPlan}

JSON만 출력하라.`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

/**
 * 검사기준서 Item 생성을 위한 LLM 프롬프트 생성
 */
export function buildInspectionItemPrompt(
  characteristicName: string,
  characteristicType: string,
  lsl: number | null,
  usl: number | null,
  unit: string | null,
  measurementMethod: string | null,
  sampleSize: string,
  frequency: string
): LLMMessage[] {
  const systemPrompt = `당신은 제조업 품질 검사 전문가입니다.
검사기준서 항목을 생성합니다.

반드시 JSON만 출력하라.
다음 스키마를 위반하면 실패로 간주한다:
{
  "inspection_item_name": "검사 항목명",
  "inspection_method": "구체적인 검사 방법",
  "acceptance_criteria": "정량화된 합격 기준",
  "ng_handling": "불합격 시 처리 절차"
}

acceptance_criteria 작성 규칙:
- 치수 특성: "LSL ~ USL" 형식 (예: "9.8mm ~ 10.2mm")
- 외관 특성: "한도 샘플 기준 일치" 또는 구체적 기준

ng_handling 필수 포함 사항:
1. 격리: 불합격품 즉시 격리 조치
2. 재검: 재검사 기준 및 방법
3. 원인분석 트리거: 연속 NG 발생 시 분석 착수 기준`;

  const specStr = lsl !== null && usl !== null
    ? `${lsl}${unit || ''} ~ ${usl}${unit || ''}`
    : (lsl !== null ? `≥ ${lsl}${unit || ''}` : (usl !== null ? `≤ ${usl}${unit || ''}` : '해당없음'));

  const userPrompt = `다음 특성에 대한 검사기준서 항목을 생성하라:

특성명: ${characteristicName}
특성 유형: ${characteristicType}
규격: ${specStr}
측정 방법: ${measurementMethod || '미정'}
샘플 크기: ${sampleSize}
검사 주기: ${frequency}

JSON만 출력하라.`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}
