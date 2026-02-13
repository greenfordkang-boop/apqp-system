'use client';

import Link from 'next/link';
import { useState, useEffect, Fragment } from 'react';
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
