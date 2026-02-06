/**
 * IATF 16949 조항 매핑 리포트 API
 *
 * ====================================================
 * 설계 의도
 * ====================================================
 * 시스템 산출물이 IATF 16949 요구사항에 어떻게 대응하는지
 * "매핑 표"를 생성하여 감사 대응 지원
 *
 * ====================================================
 * 출력 포맷
 * ====================================================
 * - Markdown 표 + 요약
 * - 컬럼: Clause / Requirement / System Evidence / How We Meet / Gaps & Actions
 *
 * ====================================================
 * 주의사항
 * ====================================================
 * - 조항 전문 인용 금지 (저작권)
 * - 요지만 정리
 * - 애매하면 "추정/확인 필요" 표시
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

interface IatfMapRequest {
  pfmea_id?: string;
  control_plan_id?: string;
  update_clause_status?: boolean;  // 조항 상태 업데이트 여부 (기본: false)
}

interface IatfMapResponse {
  success: boolean;
  report_run_id?: string;
  markdown?: string;
  error?: string;
}

interface ClauseMapping {
  clause_number: string;
  clause_title: string;
  requirement_summary: string;
  system_evidence: string | null;
  evidence_tables: string[] | null;
  evidence_reports: string[] | null;
  compliance_status: string;
  gaps_and_actions: string | null;
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();

  try {
    const body: IatfMapRequest = await request.json();
    const { pfmea_id, control_plan_id, update_clause_status = false } = body;

    // 1. 데이터 수집
    let targetPfmeaId = pfmea_id;
    if (!targetPfmeaId && control_plan_id) {
      const { data: cp } = await supabase
        .from('control_plans')
        .select('pfmea_id')
        .eq('id', control_plan_id)
        .single();
      if (cp) targetPfmeaId = cp.pfmea_id;
    }

    // 2. 현재 시스템 데이터 현황 조회
    let stats = {
      pfmea_lines: 0,
      cp_items: 0,
      sop_steps: 0,
      inspection_items: 0,
      characteristics: 0,
      consistency_checks: 0,
    };

    if (targetPfmeaId) {
      const { count: pfmeaCount } = await supabase
        .from('pfmea_lines')
        .select('id', { count: 'exact' })
        .eq('pfmea_id', targetPfmeaId);
      stats.pfmea_lines = pfmeaCount || 0;

      const { data: cps } = await supabase
        .from('control_plans')
        .select('id')
        .eq('pfmea_id', targetPfmeaId);

      if (cps && cps.length > 0) {
        const cpIds = cps.map(c => c.id);

        const { count: cpCount } = await supabase
          .from('control_plan_items')
          .select('id', { count: 'exact' })
          .in('control_plan_id', cpIds);
        stats.cp_items = cpCount || 0;

        const { data: sops } = await supabase
          .from('sops')
          .select('id')
          .in('control_plan_id', cpIds);

        if (sops && sops.length > 0) {
          const { count: sopCount } = await supabase
            .from('sop_steps')
            .select('id', { count: 'exact' })
            .in('sop_id', sops.map(s => s.id));
          stats.sop_steps = sopCount || 0;
        }

        const { data: inss } = await supabase
          .from('inspection_standards')
          .select('id')
          .in('control_plan_id', cpIds);

        if (inss && inss.length > 0) {
          const { count: insCount } = await supabase
            .from('inspection_items')
            .select('id', { count: 'exact' })
            .in('inspection_standard_id', inss.map(i => i.id));
          stats.inspection_items = insCount || 0;
        }
      }
    }

    const { count: charCount } = await supabase
      .from('characteristics')
      .select('id', { count: 'exact' });
    stats.characteristics = charCount || 0;

    const { count: checkCount } = await supabase
      .from('report_runs')
      .select('id', { count: 'exact' })
      .eq('report_type', 'consistency_check');
    stats.consistency_checks = checkCount || 0;

    // 3. IATF 조항 매핑 데이터 조회
    const { data: clauseMappings, error: clauseError } = await supabase
      .from('iatf_clause_map')
      .select('*')
      .order('clause_number');

    if (clauseError) {
      throw new Error(`Failed to fetch clause mappings: ${clauseError.message}`);
    }

    // 4. 동적 상태 업데이트 (선택적)
    const updatedMappings: ClauseMapping[] = (clauseMappings || []).map((clause: ClauseMapping) => {
      let newStatus = clause.compliance_status;
      let gaps = clause.gaps_and_actions;

      // 데이터 존재 여부에 따른 상태 동적 계산
      switch (clause.clause_number) {
        case '6.1.2.1': // Risk Analysis
          if (stats.pfmea_lines > 0) {
            newStatus = stats.consistency_checks > 0 ? 'full' : 'partial';
          } else {
            newStatus = 'gap';
            gaps = 'PFMEA 데이터 없음. PFMEA 작성 필요.';
          }
          break;

        case '8.3.3.3': // Special Characteristics
          newStatus = stats.characteristics > 0 ? 'full' : 'gap';
          if (stats.characteristics === 0) {
            gaps = 'Characteristic 마스터 데이터 없음.';
          }
          break;

        case '8.5.1.1': // Control Plan
          if (stats.cp_items > 0 && stats.pfmea_lines > 0) {
            newStatus = 'full';
          } else if (stats.cp_items > 0) {
            newStatus = 'partial';
            gaps = 'PFMEA와의 연결 확인 필요.';
          } else {
            newStatus = 'gap';
            gaps = 'Control Plan 생성 필요.';
          }
          break;

        case '8.5.1.2': // Standardized Work
          if (stats.sop_steps > 0) {
            newStatus = 'full';
          } else if (stats.cp_items > 0) {
            newStatus = 'partial';
            gaps = 'SOP 생성 필요 (/api/generate/sop).';
          } else {
            newStatus = 'gap';
          }
          break;

        case '8.6.2': // Layout Inspection
          if (stats.inspection_items > 0) {
            newStatus = 'full';
          } else if (stats.cp_items > 0) {
            newStatus = 'partial';
            gaps = '검사기준서 생성 필요 (/api/generate/inspection).';
          }
          break;
      }

      return {
        ...clause,
        compliance_status: newStatus,
        gaps_and_actions: gaps,
      };
    });

    // 5. 상태 DB 업데이트 (선택적)
    if (update_clause_status) {
      for (const clause of updatedMappings) {
        await supabase
          .from('iatf_clause_map')
          .update({
            compliance_status: clause.compliance_status,
            gaps_and_actions: clause.gaps_and_actions,
            last_reviewed_at: new Date().toISOString(),
          })
          .eq('clause_number', clause.clause_number);
      }
    }

    // 6. 마크다운 생성
    const markdown = generateIatfMapMarkdown(updatedMappings, stats);

    // 7. report_runs 저장
    const reportRunId = uuidv4();
    await supabase.from('report_runs').insert({
      id: reportRunId,
      report_type: 'iatf_map',
      input_params: { pfmea_id: targetPfmeaId, control_plan_id },
      result_summary: {
        total_clauses: updatedMappings.length,
        full: updatedMappings.filter(c => c.compliance_status === 'full').length,
        partial: updatedMappings.filter(c => c.compliance_status === 'partial').length,
        gap: updatedMappings.filter(c => c.compliance_status === 'gap').length,
      },
      result_detail: { stats, mappings: updatedMappings },
      status: 'completed',
    });

    return NextResponse.json<IatfMapResponse>({
      success: true,
      report_run_id: reportRunId,
      markdown,
    });

  } catch (error) {
    console.error('IATF map error:', error);
    return NextResponse.json<IatfMapResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

function generateIatfMapMarkdown(
  mappings: ClauseMapping[],
  stats: Record<string, number>
): string {
  const now = new Date().toISOString().split('T')[0];

  const statusEmoji: Record<string, string> = {
    full: '✅',
    partial: '🟡',
    gap: '❌',
    not_applicable: '➖',
  };

  let md = `# IATF 16949 조항 매핑 리포트

**생성일:** ${now}

## 1. 현재 시스템 데이터 현황

| 항목 | 건수 |
|------|------|
| PFMEA Lines | ${stats.pfmea_lines} |
| Control Plan Items | ${stats.cp_items} |
| SOP Steps | ${stats.sop_steps} |
| Inspection Items | ${stats.inspection_items} |
| Characteristics | ${stats.characteristics} |
| Consistency Checks 실행 | ${stats.consistency_checks} |

---

## 2. 조항별 매핑 현황

| 상태 | 의미 |
|------|------|
| ✅ Full | 완전 충족 |
| 🟡 Partial | 부분 충족 |
| ❌ Gap | 미충족 |
| ➖ N/A | 해당 없음 |

---

## 3. 상세 매핑 표

| Clause | Requirement | System Evidence | How We Meet | Status | Gaps & Actions |
|--------|-------------|-----------------|-------------|--------|----------------|
`;

  for (const clause of mappings) {
    const status = statusEmoji[clause.compliance_status] || '?';
    const evidence = clause.system_evidence || '-';
    const tables = clause.evidence_tables?.join(', ') || '-';
    const gaps = clause.gaps_and_actions || '-';

    md += `| **${clause.clause_number}** ${clause.clause_title} | ${clause.requirement_summary} | ${tables} | ${evidence} | ${status} | ${gaps} |\n`;
  }

  // 요약
  const fullCount = mappings.filter(c => c.compliance_status === 'full').length;
  const partialCount = mappings.filter(c => c.compliance_status === 'partial').length;
  const gapCount = mappings.filter(c => c.compliance_status === 'gap').length;

  md += `
---

## 4. 요약

| 상태 | 건수 | 비율 |
|------|------|------|
| ✅ Full | ${fullCount} | ${((fullCount / mappings.length) * 100).toFixed(0)}% |
| 🟡 Partial | ${partialCount} | ${((partialCount / mappings.length) * 100).toFixed(0)}% |
| ❌ Gap | ${gapCount} | ${((gapCount / mappings.length) * 100).toFixed(0)}% |

---

## 5. 권장 조치

`;

  const gapClauses = mappings.filter(c => c.compliance_status === 'gap' && c.gaps_and_actions);
  const partialClauses = mappings.filter(c => c.compliance_status === 'partial' && c.gaps_and_actions);

  if (gapClauses.length > 0) {
    md += `### 5.1 즉시 조치 필요 (Gap)\n\n`;
    for (const clause of gapClauses) {
      md += `- **${clause.clause_number}**: ${clause.gaps_and_actions}\n`;
    }
    md += '\n';
  }

  if (partialClauses.length > 0) {
    md += `### 5.2 개선 권장 (Partial)\n\n`;
    for (const clause of partialClauses) {
      md += `- **${clause.clause_number}**: ${clause.gaps_and_actions}\n`;
    }
    md += '\n';
  }

  md += `
---

*주의: 본 매핑은 시스템 자동 분석 결과이며, IATF 16949 조항의 공식 해석이 아닙니다.*
*최종 판단은 품질 담당자 및 인증 심사원의 검토가 필요합니다.*
`;

  return md;
}

// GET: 조항 목록 조회
export async function GET() {
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('iatf_clause_map')
    .select('*')
    .order('clause_number');

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data });
}
