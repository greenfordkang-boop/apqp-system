'use client';

import Link from 'next/link';
import { useState, useEffect, Fragment, useCallback } from 'react';
import { statsStore } from '@/lib/store';

interface Stats {
  products: number;
  characteristics: number;
  controlPlans: number;
  sops: number;
  inspections: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    products: 0,
    characteristics: 0,
    controlPlans: 0,
    sops: 0,
    inspections: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const [showStandard, setShowStandard] = useState(false);

  useEffect(() => {
    statsStore
      .getStats()
      .then((s) =>
        setStats({
          products: s.products,
          characteristics: s.characteristics,
          controlPlans: s.controlPlans,
          sops: s.sops,
          inspections: s.inspections,
        })
      )
      .catch((err) => console.error('Failed to load stats:', err))
      .finally(() => setLoading(false));
  }, []);

  const statItems = [
    { label: '등록 제품', value: stats.products },
    { label: '관리 특성', value: stats.characteristics },
    { label: 'Control Plan', value: stats.controlPlans },
    { label: '작업표준서', value: stats.sops },
    { label: '검사기준서', value: stats.inspections },
  ];

  const pipeline = [
    { num: '01', title: '특성 등록', sub: '기초 데이터' },
    { num: '02', title: 'PFMEA', sub: '위험 분석' },
    { num: '03', title: 'Control Plan', sub: '관리 방법' },
    { num: '04', title: 'SOP', sub: '작업 절차' },
    { num: '05', title: '검사기준서', sub: '검사 기준' },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Navigation */}
      <nav className="fixed top-0 inset-x-0 z-50 h-11 backdrop-blur-xl bg-[var(--background)]/80 border-b border-[var(--divider)]">
        <div className="max-w-[980px] mx-auto px-6 h-full flex items-center justify-between">
          <Link href="/" className="text-[14px] font-semibold text-[var(--text-primary)]">
            신성오토텍 품질관리
          </Link>
          <div className="flex items-center gap-7">
            <NavItem href="/products">제품</NavItem>
            <NavItem href="/documents">문서</NavItem>
            <NavItem href="/documents/generate">생성</NavItem>
            <button
              onClick={() => setShowStandard(true)}
              className="text-[12px] text-[var(--accent-blue)] hover:text-blue-700 transition-colors font-medium"
            >
              문서작성기준
            </button>
            <button
              onClick={() => setShowGuide(true)}
              className="text-[12px] text-[var(--accent-blue)] hover:text-blue-700 transition-colors font-medium"
            >
              사용법
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-[980px] mx-auto px-6 pt-[76px] pb-24">
        {/* Page heading */}
        <div className="mb-12">
          <h1 className="text-[34px] font-bold tracking-[-0.003em] text-[var(--text-primary)] leading-[1.12]">
            품질문서 통합관리
          </h1>
          <p className="text-[17px] text-[var(--text-secondary)] mt-2">
            IATF 16949 기반 APQP 문서 관리 시스템
          </p>
        </div>

        {/* Stats overview */}
        <section className="mb-12">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {statItems.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl bg-[var(--card-bg)] backdrop-blur-sm border border-[var(--card-border)] p-5"
              >
                <div className="text-[28px] font-bold text-[var(--text-primary)] tracking-tight leading-none">
                  {loading ? (
                    <div className="w-8 h-7 rounded-lg animate-pulse bg-[var(--divider)]" />
                  ) : (
                    item.value
                  )}
                </div>
                <p className="text-[13px] text-[var(--text-secondary)] mt-2">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* APQP Pipeline */}
        <section className="mb-12">
          <SectionLabel>APQP 문서 체계</SectionLabel>
          <div className="rounded-2xl bg-[var(--card-bg)] backdrop-blur-sm border border-[var(--card-border)] p-6 md:p-10">
            <div className="flex flex-col md:flex-row items-center">
              {pipeline.map((step, i) => (
                <Fragment key={step.num}>
                  {i > 0 && (
                    <div className="w-px h-5 md:w-10 md:h-px bg-[var(--divider)] flex-shrink-0" />
                  )}
                  <div className="flex-1 text-center py-2 md:py-0 md:px-1 min-w-0">
                    <div className="text-[11px] font-bold text-[var(--text-tertiary)] tracking-wide">
                      {step.num}
                    </div>
                    <div className="text-[15px] font-semibold text-[var(--text-primary)] mt-0.5 leading-tight">
                      {step.title}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-1">{step.sub}</div>
                  </div>
                </Fragment>
              ))}
            </div>
            <div className="mt-8 pt-5 border-t border-[var(--divider)] text-center">
              <p className="text-[12px] text-[var(--text-tertiary)]">
                모든 문서는 연결되어 완벽한 추적성(Traceability)을 보장합니다
              </p>
            </div>
          </div>
        </section>

        {/* Quick actions */}
        <section>
          <SectionLabel>바로가기</SectionLabel>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ActionCard
              href="/products"
              title="제품 관리"
              description="제품과 특성을 등록하고 관리합니다"
              icon="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
            <ActionCard
              href="/documents/generate"
              title="AI 문서 생성"
              description="APQP 문서를 한 번에 자동 생성합니다"
              icon="M13 10V3L4 14h7v7l9-11h-7z"
            />
            <ActionCard
              href="/documents"
              title="문서 관리"
              description="생성된 품질문서를 조회하고 편집합니다"
              icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--divider)]">
        <div className="max-w-[980px] mx-auto px-6 py-5 flex flex-col sm:flex-row justify-between items-center gap-2">
          <span className="text-[12px] text-[var(--text-tertiary)]">
            신성오토텍(주) 품질문서관리 시스템
          </span>
          <span className="text-[12px] text-[var(--text-tertiary)]">IATF 16949 Compliant</span>
        </div>
      </footer>

      {/* Standard Modal */}
      {showStandard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowStandard(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-[640px] w-full max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-[17px] font-bold text-gray-900">문서작성기준</h2>
              <button
                onClick={() => setShowStandard(false)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              <p className="text-[13px] text-gray-500 leading-relaxed">
                IATF 16949 및 AIAG 매뉴얼 기반 APQP 문서 작성 기준입니다. 모든 문서는 특성(Characteristic)을 기초로 하며, 문서 간 추적성이 보장되어야 합니다.
              </p>

              {/* 특성 등록 기준 */}
              <StandardSection
                num="01"
                title="특성 등록 기준"
                color="bg-slate-600"
                items={[
                  { label: '특성 분류', desc: '제품특성(Product)과 공정특성(Process)을 구분하여 등록' },
                  { label: '중요도', desc: 'Critical(CC) / Significant(SC) / Standard(일반) 3단계 분류' },
                  { label: '규격', desc: 'LSL(하한) ~ USL(상한), 단위(mm, N, ℃ 등) 반드시 명시' },
                  { label: '측정방법', desc: '사용 측정기, 게이지, 검사 장비 등 구체적 기재' },
                ]}
              />

              {/* PFMEA */}
              <StandardSection
                num="02"
                title="PFMEA (공정 잠재 고장모드 영향분석)"
                color="bg-blue-600"
                items={[
                  { label: '고장모드', desc: '각 특성이 규격을 벗어날 수 있는 모든 잠재적 고장 형태 도출' },
                  { label: '영향(Effect)', desc: '고장 발생 시 고객/후공정에 미치는 영향 기술' },
                  { label: 'RPN 산출', desc: '심각도(S) x 발생도(O) x 검출도(D) = RPN, 100 이상 시 조치 필수' },
                  { label: '권고조치', desc: 'RPN 감소를 위한 개선 대책 수립 (발생도·검출도 중심)' },
                ]}
                note="AIAG-VDA PFMEA 1st Edition 기준. AP(Action Priority) 방식 병행 가능"
              />

              {/* Control Plan */}
              <StandardSection
                num="03"
                title="관리계획서 (Control Plan)"
                color="bg-emerald-600"
                items={[
                  { label: '관리항목', desc: 'PFMEA의 특성을 1:1로 연결, 모든 CC/SC 항목 포함 필수' },
                  { label: '관리방법', desc: '관리유형(예방/검출), 구체적 관리 수단 명시' },
                  { label: '시료크기/주기', desc: '샘플링 수량과 검사 빈도 (예: 5ea/2시간)' },
                  { label: '이상 시 조치', desc: '규격 이탈 시 격리→재검→원인분석 순서의 대응 절차' },
                ]}
                note="Prototype / Pre-launch / Production 단계별 작성 권장"
              />

              {/* SOP */}
              <StandardSection
                num="04"
                title="작업표준서 (SOP / Work Instruction)"
                color="bg-violet-600"
                items={[
                  { label: '작업순서', desc: 'CP의 공정 단계별 구체적 작업 절차를 순번으로 기술' },
                  { label: '핵심 포인트', desc: '품질/안전에 영향을 주는 주의사항, 관리 포인트 강조' },
                  { label: '설비/도구', desc: '작업에 필요한 장비, 치공구, 보조재료 등 명시' },
                  { label: '이상처리', desc: '이상 발생 시 작업자 대응 절차 (정지→보고→격리)' },
                ]}
                note="작업자가 현장에서 바로 이해할 수 있도록 간결하게 작성"
              />

              {/* 검사기준서 */}
              <StandardSection
                num="05"
                title="검사기준서 (Inspection Standard)"
                color="bg-amber-600"
                items={[
                  { label: '검사항목', desc: 'CP의 관리항목과 1:1 연결, 검사 명칭 명시' },
                  { label: '합격기준', desc: '정량화 필수 — 치수: LSL~USL, 외관: 한도견본 기준' },
                  { label: '샘플링', desc: 'CP의 시료크기/주기를 그대로 반영' },
                  { label: 'NG 처리', desc: '① 격리(NG BOX) ② 재검(3회 중 2회 합격 시 Pass) ③ 연속 NG 시 라인 정지 및 4M 분석' },
                ]}
                note="수입검사 / 공정검사 / 출하검사 구분 적용 가능"
              />

              {/* 추적성 기준 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">추적성 (Traceability) 요건</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-[12px] text-emerald-600 mt-0.5 shrink-0">●</span>
                    <p className="text-[12px] text-gray-700">모든 특성은 PFMEA → CP → SOP → 검사기준서로 빠짐없이 연결</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[12px] text-emerald-600 mt-0.5 shrink-0">●</span>
                    <p className="text-[12px] text-gray-700">CC/SC 특성은 4개 문서 모두 필수, 일반 특성도 CP 이상 연결 권장</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-[12px] text-emerald-600 mt-0.5 shrink-0">●</span>
                    <p className="text-[12px] text-gray-700">추적성 매트릭스에서 누락 항목 확인 → AI 보완으로 자동 생성 가능</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <p className="text-[11px] text-gray-400 text-center">
                IATF 16949 · AIAG APQP 2nd Edition · AIAG-VDA FMEA 1st Edition 기준
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Guide Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setShowGuide(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-white rounded-2xl shadow-2xl max-w-[560px] w-full max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-[17px] font-bold text-gray-900">사용법</h2>
              <button
                onClick={() => setShowGuide(false)}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-6">
              {/* Step 1 */}
              <GuideStep
                num="1"
                title="제품 및 특성 등록"
                description="제품관리에서 고객사, 차종, 품명, Part No를 입력하고, 관리할 특성(치수, 외관, 성능 등)을 등록합니다."
                tip="특성은 APQP 문서의 기초입니다. 특성이 없으면 문서 생성이 불가합니다."
              />

              {/* Step 2 */}
              <GuideStep
                num="2"
                title="AI 문서 자동 생성"
                description="문서관리에서 AI 보완 버튼을 클릭하면 PFMEA → 관리계획서 → 작업표준서 → 검사기준서가 자동 생성됩니다."
                tip="또는 생성 메뉴에서 단계별로 개별 생성할 수도 있습니다."
              />

              {/* Step 3 */}
              <GuideStep
                num="3"
                title="문서 검토 및 편집"
                description="생성된 문서를 클릭하여 내용을 검토하고, 필요시 직접 편집합니다. 각 문서의 상태를 작성중 → 검토중 → 승인됨으로 변경할 수 있습니다."
                tip=""
              />

              {/* Step 4 */}
              <GuideStep
                num="4"
                title="추적성 확인"
                description="추적성 매트릭스에서 특성별로 PFMEA, CP, SOP, 검사기준서가 모두 연결되어 있는지 한눈에 확인합니다."
                tip="누락 항목이 있으면 빨간색으로 표시됩니다."
              />

              {/* Flow diagram */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-3">문서 생성 흐름</p>
                <div className="flex items-center justify-between text-center text-[12px]">
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">특성</div>
                    <div className="text-gray-400">기초 데이터</div>
                  </div>
                  <div className="text-gray-300 px-1">→</div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">PFMEA</div>
                    <div className="text-gray-400">위험 분석</div>
                  </div>
                  <div className="text-gray-300 px-1">→</div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">CP</div>
                    <div className="text-gray-400">관리 방법</div>
                  </div>
                  <div className="text-gray-300 px-1">→</div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">SOP</div>
                    <div className="text-gray-400">작업 절차</div>
                  </div>
                  <div className="text-gray-300 px-1">→</div>
                  <div className="flex-1">
                    <div className="font-bold text-gray-900">검사</div>
                    <div className="text-gray-400">검사 기준</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <p className="text-[11px] text-gray-400 text-center">
                IATF 16949 기반 · 특성(SSOT) → PFMEA → CP → SOP → 검사기준서 추적성 보장
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
    >
      {children}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-tertiary)] mb-4">
      {children}
    </p>
  );
}

function ActionCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <Link href={href} className="group">
      <div className="rounded-2xl bg-[var(--card-bg)] backdrop-blur-sm border border-[var(--card-border)] p-6 h-full transition-all duration-200 hover:shadow-lg hover:shadow-black/[0.03] hover:-translate-y-px">
        <div className="w-10 h-10 rounded-xl bg-[var(--background)] flex items-center justify-center mb-4">
          <svg
            className="w-5 h-5 text-[var(--text-secondary)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
          </svg>
        </div>
        <h3 className="text-[17px] font-semibold text-[var(--text-primary)] mb-1 group-hover:text-[var(--accent-blue)] transition-colors">
          {title}
        </h3>
        <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{description}</p>
      </div>
    </Link>
  );
}

function StandardSection({
  num,
  title,
  color,
  items,
  note,
}: {
  num: string;
  title: string;
  color: string;
  items: { label: string; desc: string }[];
  note?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className={`w-7 h-7 rounded-full ${color} text-white text-[11px] font-bold flex items-center justify-center shrink-0`}>
          {num}
        </span>
        <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="ml-10 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-start gap-2">
            <span className="text-[12px] font-semibold text-gray-700 shrink-0 min-w-[72px]">{item.label}</span>
            <p className="text-[12px] text-gray-600 leading-relaxed">{item.desc}</p>
          </div>
        ))}
        {note && (
          <p className="text-[11px] text-blue-600 mt-2 bg-blue-50 rounded-lg px-3 py-1.5 inline-block">
            {note}
          </p>
        )}
      </div>
    </div>
  );
}

function GuideStep({ num, title, description, tip }: { num: string; title: string; description: string; tip: string }) {
  return (
    <div className="flex gap-4">
      <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-[13px] font-bold flex items-center justify-center shrink-0 mt-0.5">
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-semibold text-gray-900">{title}</h3>
        <p className="text-[13px] text-gray-600 mt-1 leading-relaxed">{description}</p>
        {tip && (
          <p className="text-[12px] text-blue-600 mt-1.5 bg-blue-50 rounded-lg px-3 py-1.5 inline-block">
            {tip}
          </p>
        )}
      </div>
    </div>
  );
}
