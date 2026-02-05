/**
 * Consistency Check Rules
 *
 * 규칙 정의: 내부 품질 통제 / 리스크 탐지
 * LLM 없이 100% 룰 기반으로 동작
 */

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ConsistencyIssue {
  severity: Severity;
  rule: string;
  message: string;
  pfmea_line_id: string | null;
  control_plan_item_id: string | null;
  sop_step_id: string | null;
  inspection_item_id: string | null;
}

export interface ConsistencyCheckResult {
  issues: ConsistencyIssue[];
  summary: {
    HIGH: number;
    MEDIUM: number;
    LOW: number;
  };
}

// ============================================
// Rule Definitions
// ============================================

export const RULES = {
  RULE_1: {
    code: 'RULE_1',
    severity: 'HIGH' as Severity,
    description: '고위험 PFMEA(AP=High 또는 RPN≥100)인데 Control Plan 연결 없음',
  },
  RULE_2: {
    code: 'RULE_2',
    severity: 'HIGH' as Severity,
    description: 'Control Plan 항목이 있는데 SOP 연결 없음',
  },
  RULE_3: {
    code: 'RULE_3',
    severity: 'HIGH' as Severity,
    description: 'Control Plan 항목이 있는데 검사기준서 연결 없음',
  },
  RULE_4: {
    code: 'RULE_4',
    severity: 'MEDIUM' as Severity,
    description: '샘플링 불일치 (CP sample_size/frequency vs INS sampling_plan)',
  },
  RULE_5: {
    code: 'RULE_5',
    severity: 'MEDIUM' as Severity,
    description: 'SOP key_point에 관리포인트/이상조치 요약 누락',
  },
  RULE_6: {
    code: 'RULE_6',
    severity: 'LOW' as Severity,
    description: 'LSL/USL 존재인데 acceptance_criteria에 수치 미표기',
  },
};

// ============================================
// Rule Check Functions
// ============================================

/**
 * Rule 1: 고위험 PFMEA인데 CP 연결 없음
 */
export function checkRule1(
  pfmeaLines: Array<{
    id: string;
    rpn: number;
    action_priority: string | null;
    process_step: string;
  }>,
  cpItemsByPfmeaLine: Map<string, string[]>
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const line of pfmeaLines) {
    const isHighRisk = line.action_priority === 'H' || line.rpn >= 100;
    const hasCpItem = cpItemsByPfmeaLine.has(line.id) && cpItemsByPfmeaLine.get(line.id)!.length > 0;

    if (isHighRisk && !hasCpItem) {
      issues.push({
        severity: RULES.RULE_1.severity,
        rule: RULES.RULE_1.code,
        message: `고위험 PFMEA 항목 "${line.process_step}" (RPN=${line.rpn}, AP=${line.action_priority || 'N/A'})에 Control Plan이 연결되지 않음`,
        pfmea_line_id: line.id,
        control_plan_item_id: null,
        sop_step_id: null,
        inspection_item_id: null,
      });
    }
  }

  return issues;
}

/**
 * Rule 2: CP 항목 있는데 SOP 연결 없음
 */
export function checkRule2(
  cpItems: Array<{
    id: string;
    process_step: string;
    control_method: string;
  }>,
  sopStepsByCpItem: Map<string, string[]>
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const item of cpItems) {
    const hasSopStep = sopStepsByCpItem.has(item.id) && sopStepsByCpItem.get(item.id)!.length > 0;

    if (!hasSopStep) {
      issues.push({
        severity: RULES.RULE_2.severity,
        rule: RULES.RULE_2.code,
        message: `Control Plan 항목 "${item.process_step} - ${item.control_method}"에 SOP가 연결되지 않음`,
        pfmea_line_id: null,
        control_plan_item_id: item.id,
        sop_step_id: null,
        inspection_item_id: null,
      });
    }
  }

  return issues;
}

/**
 * Rule 3: CP 항목 있는데 검사기준서 연결 없음
 */
export function checkRule3(
  cpItems: Array<{
    id: string;
    process_step: string;
    control_type: string;
  }>,
  inspectionItemsByCpItem: Map<string, string[]>
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const item of cpItems) {
    // detection 타입인 경우에만 검사기준서 필요
    if (item.control_type !== 'detection') continue;

    const hasInspItem = inspectionItemsByCpItem.has(item.id) && inspectionItemsByCpItem.get(item.id)!.length > 0;

    if (!hasInspItem) {
      issues.push({
        severity: RULES.RULE_3.severity,
        rule: RULES.RULE_3.code,
        message: `Control Plan 검출 항목 "${item.process_step}"에 검사기준서가 연결되지 않음`,
        pfmea_line_id: null,
        control_plan_item_id: item.id,
        sop_step_id: null,
        inspection_item_id: null,
      });
    }
  }

  return issues;
}

/**
 * Rule 4: 샘플링 불일치
 */
export function checkRule4(
  cpItems: Array<{
    id: string;
    sample_size: string;
    frequency: string;
    process_step: string;
  }>,
  inspectionItems: Array<{
    id: string;
    linked_cp_item_id: string;
    sampling_plan: string;
  }>
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  for (const inspItem of inspectionItems) {
    const cpItem = cpItems.find(cp => cp.id === inspItem.linked_cp_item_id);
    if (!cpItem) continue;

    // CP의 sample_size + frequency 조합과 INS의 sampling_plan 비교
    const expectedSampling = `${cpItem.sample_size} / ${cpItem.frequency}`;
    const actualSampling = inspItem.sampling_plan;

    // 정규화된 비교 (공백 제거)
    const normalizedExpected = expectedSampling.replace(/\s+/g, '').toLowerCase();
    const normalizedActual = actualSampling.replace(/\s+/g, '').toLowerCase();

    if (normalizedExpected !== normalizedActual) {
      issues.push({
        severity: RULES.RULE_4.severity,
        rule: RULES.RULE_4.code,
        message: `샘플링 불일치: CP="${expectedSampling}" vs 검사기준서="${actualSampling}" (공정: ${cpItem.process_step})`,
        pfmea_line_id: null,
        control_plan_item_id: cpItem.id,
        sop_step_id: null,
        inspection_item_id: inspItem.id,
      });
    }
  }

  return issues;
}

/**
 * Rule 5: SOP key_point 누락 확인
 */
export function checkRule5(
  sopSteps: Array<{
    id: string;
    linked_cp_item_id: string;
    key_point: string;
    action: string;
  }>
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  // 필수 키워드 (하나 이상 포함 필요)
  const controlKeywords = ['관리', '포인트', '기준', '규격', '허용'];
  const actionKeywords = ['이상', '조치', '불량', '대응', '정지', '보고'];

  for (const step of sopSteps) {
    const keyPointLower = step.key_point.toLowerCase();

    const hasControlKeyword = controlKeywords.some(k => keyPointLower.includes(k));
    const hasActionKeyword = actionKeywords.some(k => keyPointLower.includes(k));

    const missing: string[] = [];
    if (!hasControlKeyword) missing.push('관리포인트');
    if (!hasActionKeyword) missing.push('이상조치');

    if (missing.length > 0) {
      issues.push({
        severity: RULES.RULE_5.severity,
        rule: RULES.RULE_5.code,
        message: `SOP 스텝 "${step.action}"의 key_point에 ${missing.join(', ')} 관련 내용 누락`,
        pfmea_line_id: null,
        control_plan_item_id: step.linked_cp_item_id,
        sop_step_id: step.id,
        inspection_item_id: null,
      });
    }
  }

  return issues;
}

/**
 * Rule 6: LSL/USL 존재인데 acceptance_criteria에 수치 미표기
 */
export function checkRule6(
  inspectionItems: Array<{
    id: string;
    linked_cp_item_id: string;
    acceptance_criteria: string;
    inspection_item_name: string;
  }>,
  characteristics: Array<{
    id: string;
    lsl: number | null;
    usl: number | null;
  }>,
  cpItems: Array<{
    id: string;
    characteristic_id: string;
  }>
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  // CP item → characteristic 매핑 생성
  const charByInspItem = new Map<string, { lsl: number | null; usl: number | null }>();
  for (const insp of inspectionItems) {
    const cpItem = cpItems.find(cp => cp.id === insp.linked_cp_item_id);
    if (!cpItem) continue;
    const char = characteristics.find(c => c.id === cpItem.characteristic_id);
    if (char) {
      charByInspItem.set(insp.id, { lsl: char.lsl, usl: char.usl });
    }
  }

  for (const inspItem of inspectionItems) {
    const char = charByInspItem.get(inspItem.id);
    if (!char) continue;

    const hasSpec = char.lsl !== null || char.usl !== null;
    if (!hasSpec) continue;

    // acceptance_criteria에 숫자가 포함되어 있는지 확인
    const hasNumeric = /\d+(\.\d+)?/.test(inspItem.acceptance_criteria);

    if (!hasNumeric) {
      issues.push({
        severity: RULES.RULE_6.severity,
        rule: RULES.RULE_6.code,
        message: `검사항목 "${inspItem.inspection_item_name}"에 LSL/USL이 정의되어 있으나 acceptance_criteria에 수치가 없음`,
        pfmea_line_id: null,
        control_plan_item_id: inspItem.linked_cp_item_id,
        sop_step_id: null,
        inspection_item_id: inspItem.id,
      });
    }
  }

  return issues;
}

/**
 * 결과 집계
 */
export function aggregateResults(issues: ConsistencyIssue[]): ConsistencyCheckResult {
  const summary = {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };

  for (const issue of issues) {
    summary[issue.severity]++;
  }

  return { issues, summary };
}
