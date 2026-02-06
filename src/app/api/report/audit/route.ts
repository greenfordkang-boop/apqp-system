/**
 * 감사 대응 리포트 생성 API
 *
 * ====================================================
 * 설계 의도
 * ====================================================
 * 외부 감사(IATF, 고객사) 대응용 설명 문서 생성
 * - 마크다운 형식
 * - 감사자 관점의 객관적 서술
 * - "AI가 판단" 금지, "시스템 지원 + 관리자 승인" 표현
 *
 * ====================================================
 * 문서 구성 (고정)
 * ====================================================
 * 1. 시스템 개요
 * 2. 문서 생성 및 연결 구조
 * 3. 추적성 증빙
 * 4. 품질 검증 체계
 * 5. 변경 및 승인 통제
 * 6. 결론
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

interface AuditReportRequest {
  pfmea_id?: string;
  control_plan_id?: string;
  include_traceability_examples?: boolean;  // 추적성 예시 포함 (기본: true)
}

interface AuditReportResponse {
  success: boolean;
  report_run_id?: string;
  markdown?: string;
  error?: string;
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  try {
    const body: AuditReportRequest = await request.json();
    const { pfmea_id, control_plan_id, include_traceability_examples = true } = body;

    if (!pfmea_id && !control_plan_id) {
      return NextResponse.json<AuditReportResponse>(
        { success: false, error: 'pfmea_id or control_plan_id is required' },
        { status: 400 }
      );
    }

    // 1. PFMEA ID 결정
    let targetPfmeaId = pfmea_id;
    if (!targetPfmeaId && control_plan_id) {
      const { data: cp } = await supabase
        .from('control_plans')
        .select('pfmea_id')
        .eq('id', control_plan_id)
        .single();
      if (cp) targetPfmeaId = cp.pfmea_id;
    }

    // 2. 데이터 조회
    const { data: pfmea } = await supabase
      .from('pfmea_headers')
      .select('*')
      .eq('id', targetPfmeaId)
      .single();

    const { data: pfmeaLines } = await supabase
      .from('pfmea_lines')
      .select('*')
      .eq('pfmea_id', targetPfmeaId);

    const { data: controlPlans } = await supabase
      .from('control_plans')
      .select('*')
      .eq('pfmea_id', targetPfmeaId);

    const cpIds = controlPlans?.map(cp => cp.id) || [];

    let cpItems: unknown[] = [];
    let sops: unknown[] = [];
    let sopSteps: unknown[] = [];
    let inspStandards: unknown[] = [];
    let inspItems: unknown[] = [];

    if (cpIds.length > 0) {
      const { data: items } = await supabase
        .from('control_plan_items')
        .select('*, characteristics(*)')
        .in('control_plan_id', cpIds);
      cpItems = items || [];

      const { data: s } = await supabase
        .from('sops')
        .select('*')
        .in('control_plan_id', cpIds);
      sops = s || [];

      const sopIds = (s || []).map((sop: { id: string }) => sop.id);
      if (sopIds.length > 0) {
        const { data: steps } = await supabase
          .from('sop_steps')
          .select('*')
          .in('sop_id', sopIds);
        sopSteps = steps || [];
      }

      const { data: ist } = await supabase
        .from('inspection_standards')
        .select('*')
        .in('control_plan_id', cpIds);
      inspStandards = ist || [];

      const istIds = (ist || []).map((i: { id: string }) => i.id);
      if (istIds.length > 0) {
        const { data: items } = await supabase
          .from('inspection_items')
          .select('*, characteristics(*)')
          .in('inspection_standard_id', istIds);
        inspItems = items || [];
      }
    }

    // 3. 최근 Consistency Check 결과 조회
    const { data: recentCheck } = await supabase
      .from('report_runs')
      .select('*')
      .eq('report_type', 'consistency_check')
      .contains('input_params', { pfmea_id: targetPfmeaId })
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    // 4. 마크다운 리포트 생성
    const markdown = generateAuditReportMarkdown({
      pfmea,
      pfmeaLines: pfmeaLines || [],
      controlPlans: controlPlans || [],
      cpItems,
      sops,
      sopSteps,
      inspStandards,
      inspItems,
      recentCheck,
      includeExamples: include_traceability_examples,
    });

    // 5. report_runs 저장
    const reportRunId = uuidv4();
    await supabase.from('report_runs').insert({
      id: reportRunId,
      report_type: 'audit_report',
      input_params: { pfmea_id: targetPfmeaId, control_plan_id },
      result_summary: {
        pfmea_lines_count: (pfmeaLines || []).length,
        cp_items_count: cpItems.length,
        sop_steps_count: sopSteps.length,
        inspection_items_count: inspItems.length,
      },
      result_detail: { markdown_length: markdown.length },
      status: 'completed',
    });

    return NextResponse.json<AuditReportResponse>({
      success: true,
      report_run_id: reportRunId,
      markdown,
    });

  } catch (error) {
    console.error('Audit report error:', error);
    return NextResponse.json<AuditReportResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

// ============================================
// 마크다운 생성 함수
// ============================================
interface ReportData {
  pfmea: unknown;
  pfmeaLines: unknown[];
  controlPlans: unknown[];
  cpItems: unknown[];
  sops: unknown[];
  sopSteps: unknown[];
  inspStandards: unknown[];
  inspItems: unknown[];
  recentCheck: unknown;
  includeExamples: boolean;
}

function generateAuditReportMarkdown(data: ReportData): string {
  const {
    pfmea,
    pfmeaLines,
    controlPlans,
    cpItems,
    sops,
    sopSteps,
    inspStandards,
    inspItems,
    recentCheck,
    includeExamples,
  } = data;

  const pfmeaData = pfmea as { process_name?: string; revision?: number; status?: string } | null;
  const checkData = recentCheck as { result_summary?: { HIGH?: number; MEDIUM?: number; LOW?: number }; run_at?: string } | null;

  const now = new Date().toISOString().split('T')[0];

  let md = `# 품질 관리 시스템 감사 대응 리포트

**생성일:** ${now}
**대상 공정:** ${pfmeaData?.process_name || 'N/A'}
**문서 버전:** Rev.${pfmeaData?.revision || 1}
**상태:** ${pfmeaData?.status || 'draft'}

---

## 1. 시스템 개요

### 1.1 목적
본 시스템은 PFMEA(공정 잠재적 고장 모드 영향 분석)를 기반으로 Control Plan, 작업표준서(SOP), 검사기준서를 **자동 생성**하고, 문서 간 **추적성(Traceability)**과 **일관성(Consistency)**을 보장합니다.

### 1.2 AI 활용 범위 및 통제 원칙

| 구분 | 역할 | 통제 수준 |
|------|------|----------|
| **시스템(AI)** | 문서 초안 생성, 일관성 검증 | 룰 기반 + LLM 보조 |
| **관리자(사람)** | 검토, 수정, 승인 | 최종 의사결정권 |

> ⚠️ **중요:** 모든 문서는 관리자의 검토 및 승인 후에만 "Approved" 상태로 전환됩니다.
> 시스템은 초안 생성을 지원하며, 최종 책임은 승인 권한자에게 있습니다.

---

## 2. 문서 생성 및 연결 구조

### 2.1 Single Source of Truth (SSOT)
**Characteristic(특성)**을 단일 진실의 원천으로 정의하여 모든 문서가 동일한 특성 데이터를 참조합니다.

\`\`\`
┌─────────────────┐
│  Characteristic │  ← Single Source of Truth
│    (특성 마스터)  │
└────────┬────────┘
         │ FK 참조
    ┌────┴────┬──────────┬──────────┐
    ▼         ▼          ▼          ▼
┌───────┐ ┌───────┐ ┌───────┐ ┌───────────┐
│ PFMEA │ │Control│ │  SOP  │ │ Inspection│
│ Lines │ │ Plan  │ │ Steps │ │   Items   │
└───────┘ └───────┘ └───────┘ └───────────┘
\`\`\`

### 2.2 문서 간 추적 연결

| From | To | 연결 방식 |
|------|----|----------|
| PFMEA Line | Control Plan Item | \`linked_pfmea_line_id\` (FK) |
| Control Plan Item | SOP Step | \`linked_cp_item_id\` (FK) |
| Control Plan Item | Inspection Item | \`linked_cp_item_id\` (FK) |

### 2.3 현재 문서 현황

| 문서 유형 | 건수 | 상태 |
|----------|------|------|
| PFMEA Lines | ${pfmeaLines.length} | - |
| Control Plan Items | ${cpItems.length} | - |
| SOP Steps | ${sopSteps.length} | - |
| Inspection Items | ${inspItems.length} | - |

---

## 3. 추적성 증빙
`;

  if (includeExamples && cpItems.length > 0) {
    // 추적성 예시 추가 (최대 2건)
    const examples = cpItems.slice(0, 2);

    md += `
### 3.1 추적성 예시

`;

    for (let i = 0; i < examples.length; i++) {
      const item = examples[i] as {
        process_step?: string;
        control_method?: string;
        pfmea_line_id?: string;
        id?: string;
        characteristics?: { name?: string; category?: string };
      };

      md += `**예시 ${i + 1}: ${item.characteristics?.name || 'N/A'}**

| 단계 | ID/내용 |
|------|---------|
| Characteristic | ${item.characteristics?.name || 'N/A'} (${item.characteristics?.category || 'N/A'}) |
| PFMEA Line | \`${item.pfmea_line_id || 'N/A'}\` |
| Control Plan Item | \`${item.id || 'N/A'}\` |
| 관리 방법 | ${item.control_method || 'N/A'} |

`;
    }
  } else {
    md += `
> 추적성 예시는 \`include_traceability_examples: true\` 옵션으로 포함할 수 있습니다.
`;
  }

  md += `
---

## 4. 품질 검증 체계

### 4.1 Consistency Check 규칙

본 시스템은 다음 6가지 규칙을 기반으로 문서 간 일관성을 자동 검증합니다.

| 규칙 | 심각도 | 설명 |
|------|--------|------|
| Rule 1 | HIGH | 고위험 PFMEA(AP=H 또는 RPN≥100)인데 CP 연결 없음 |
| Rule 2 | HIGH | CP 항목 있는데 SOP 연결 없음 |
| Rule 3 | HIGH | CP 항목 있는데 검사기준서 연결 없음 |
| Rule 4 | MEDIUM | 샘플링 불일치 (CP vs 검사기준서) |
| Rule 5 | MEDIUM | SOP key_point에 관리포인트/이상조치 누락 |
| Rule 6 | LOW | LSL/USL 존재인데 acceptance_criteria에 수치 미표기 |

### 4.2 최근 검증 결과

`;

  if (checkData) {
    const summary = checkData.result_summary || { HIGH: 0, MEDIUM: 0, LOW: 0 };
    md += `
**검사 일시:** ${checkData.run_at || 'N/A'}

| 심각도 | 건수 |
|--------|------|
| HIGH | ${summary.HIGH || 0} |
| MEDIUM | ${summary.MEDIUM || 0} |
| LOW | ${summary.LOW || 0} |
`;
  } else {
    md += `
> 아직 Consistency Check가 실행되지 않았습니다.
> \`/api/check/consistency\` API를 통해 검증을 수행하시기 바랍니다.
`;
  }

  md += `
---

## 5. 변경 및 승인 통제

### 5.1 문서 상태 관리

모든 문서는 다음 상태를 통해 관리됩니다:

| 상태 | 설명 | 수정 가능 |
|------|------|----------|
| draft | 초안 (시스템 생성 또는 작성 중) | ⭕ |
| review | 검토 중 (승인 대기) | ⭕ (제한적) |
| approved | 승인 완료 | ❌ (새 버전 필요) |
| obsolete | 폐기됨 | ❌ |

### 5.2 변경 이력 추적

- 모든 변경 사항은 \`change_logs\` 테이블에 기록
- 문서 버전별 스냅샷은 \`document_versions\` 테이블에 보관
- 승인자, 승인 일시, 변경 사유 필수 기록

### 5.3 책임과 권한

| 역할 | 권한 | 책임 |
|------|------|------|
| 작성자 | 초안 작성/수정 | 내용 정확성 |
| 검토자 | 검토 의견 제시 | 기술적 타당성 확인 |
| 승인자 | 최종 승인 | 문서 공식화 결정 |

---

## 6. 결론

### 6.1 시스템 충족 사항

1. **추적성 보장**: Characteristic 기반 SSOT 구조로 PFMEA → CP → SOP → 검사기준서 간 완전한 추적 가능
2. **일관성 검증**: 6개 규칙 기반 자동 검증으로 문서 간 불일치 사전 탐지
3. **변경 통제**: 상태 관리 + 버전 관리 + 승인 워크플로우로 통제된 문서 관리
4. **Human-in-the-loop**: 시스템은 지원 도구, 최종 판단과 승인은 관리자 수행

### 6.2 개선 효과

- 문서 생성 시간 단축 (수동 대비 약 70% 감소 추정)
- 문서 간 불일치 오류 사전 방지
- 감사 대응 시 추적성 증빙 즉시 제공 가능

---

*본 리포트는 APQP 품질 관리 시스템에 의해 자동 생성되었습니다.*
*최종 검토 및 승인은 담당 관리자가 수행해야 합니다.*
`;

  return md;
}
