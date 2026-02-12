'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  productStore,
  characteristicStore,
  controlPlanStore,
  sopStore,
  inspectionStore,
  pfmeaStore,
  statsStore,
} from '@/lib/store';

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
    const loadStats = async () => {
      try {
        const s = await statsStore.getStats();
        setStats({
          products: s.products,
          characteristics: s.characteristics,
          controlPlans: s.controlPlans,
          sops: s.sops,
          inspections: s.inspections,
        });
      } catch (error) {
        console.error('Failed to load stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  return (
    <div className="min-h-screen gradient-bg">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[var(--background)]/80 border-b border-[var(--divider)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-purple)] flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <span className="font-semibold text-[var(--text-primary)]">신성오토텍(주)</span>
          </div>
          <div className="flex items-center gap-6">
            <NavLink href="/products">제품</NavLink>
            <NavLink href="/documents">문서</NavLink>
            <NavLink href="/documents/generate">문서 생성</NavLink>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="pt-32 pb-16 px-6 text-center hero-gradient">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-[var(--text-primary)] mb-4">
            신성오토텍(주)
            <br />
            <span className="text-gradient">품질문서관리 시스템</span>
          </h1>
          <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-8">
            APQP 프로세스를 혁신하세요. 특성 등록부터 검사기준서까지,
            모든 품질문서를 하나의 시스템에서 관리합니다.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/products" className="apple-button">
              시작하기
              <svg
                className="w-4 h-4 ml-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
            <Link href="/documents" className="apple-button-secondary apple-button">
              문서 둘러보기
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 pb-24">
        {/* Stats Section */}
        <section className="mb-16">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard
              title="등록 제품"
              count={stats.products}
              loading={loading}
              color="blue"
            />
            <StatCard
              title="관리 특성"
              count={stats.characteristics}
              loading={loading}
              color="purple"
            />
            <StatCard
              title="Control Plan"
              count={stats.controlPlans}
              loading={loading}
              color="green"
            />
            <StatCard
              title="SOP 문서"
              count={stats.sops}
              loading={loading}
              color="orange"
            />
            <StatCard
              title="검사기준서"
              count={stats.inspections}
              loading={loading}
              color="pink"
            />
          </div>
        </section>

        {/* Feature Cards */}
        <section className="mb-16">
          <div className="text-center mb-10">
            <h2 className="section-title mb-3">강력한 기능</h2>
            <p className="section-subtitle">품질관리의 모든 것을 하나로</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              href="/products"
              icon={
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              }
              title="신규 제품 등록"
              description="새로운 차종과 제품 특성을 직관적으로 등록하세요. Single Source of Truth로 관리됩니다."
              gradient="from-[var(--accent-green)] to-emerald-400"
            />
            <FeatureCard
              href="/documents/generate"
              icon={
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                  />
                </svg>
              }
              title="AI 문서 생성"
              description="Control Plan에서 SOP, 검사기준서까지 AI가 자동으로 생성합니다."
              gradient="from-[var(--accent-blue)] to-cyan-400"
            />
            <FeatureCard
              href="/documents"
              icon={
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              }
              title="정합성 검증"
              description="문서 간 일관성을 자동으로 검사하고 누락된 항목을 즉시 파악합니다."
              gradient="from-[var(--accent-purple)] to-violet-400"
            />
          </div>
        </section>

        {/* Document Flow */}
        <section className="mb-16">
          <div className="glass-card p-8 md:p-12">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-semibold text-[var(--text-primary)] mb-2">
                APQP 문서 흐름
              </h2>
              <p className="text-[var(--text-secondary)]">완벽한 추적성을 보장하는 문서 체계</p>
            </div>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <FlowStep
                number="01"
                title="특성 등록"
                subtitle="Single Source of Truth"
                color="blue"
              />
              <FlowArrow />
              <FlowStep
                number="02"
                title="PFMEA"
                subtitle="잠재고장모드분석"
                color="purple"
              />
              <FlowArrow />
              <FlowStep
                number="03"
                title="Control Plan"
                subtitle="관리계획서"
                color="green"
              />
              <FlowArrow />
              <FlowStep
                number="04"
                title="SOP"
                subtitle="표준작업절차서"
                color="orange"
              />
              <FlowArrow />
              <FlowStep
                number="05"
                title="검사기준서"
                subtitle="품질검사기준"
                color="pink"
              />
            </div>
            <div className="mt-8 pt-6 border-t border-[var(--divider)] text-center">
              <p className="text-sm text-[var(--text-tertiary)]">
                모든 문서는 FK 관계로 연결되어 완벽한 Traceability를 보장합니다
              </p>
            </div>
          </div>
        </section>

        {/* Menu Grid */}
        <section>
          <div className="text-center mb-10">
            <h2 className="section-title mb-3">빠른 메뉴</h2>
            <p className="section-subtitle">원하는 기능에 바로 접근하세요</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <MenuCard href="/products" icon="📦" title="제품 관리" />
            <MenuCard href="/documents" icon="📊" title="PFMEA" />
            <MenuCard href="/documents" icon="📋" title="Control Plan" />
            <MenuCard href="/documents" icon="📝" title="SOP" />
            <MenuCard href="/documents" icon="✅" title="검사기준서" />
            <MenuCard href="/documents/generate" icon="🤖" title="문서 생성" />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--divider)] bg-[var(--background)]">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[var(--accent-blue)] to-[var(--accent-purple)] flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <span className="text-sm font-medium text-[var(--text-secondary)]">
                신성오토텍(주) 품질문서관리 시스템
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-[var(--text-tertiary)]">
              <span>v0.1.0</span>
              <span>•</span>
              <span>IATF 16949 Compliant</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
    >
      {children}
    </Link>
  );
}

function StatCard({
  title,
  count,
  loading,
  color,
}: {
  title: string;
  count: number;
  loading: boolean;
  color: 'blue' | 'purple' | 'green' | 'orange' | 'pink';
}) {
  const colorMap = {
    blue: 'from-[var(--accent-blue)]/10 to-[var(--accent-blue)]/5 border-[var(--accent-blue)]/20',
    purple:
      'from-[var(--accent-purple)]/10 to-[var(--accent-purple)]/5 border-[var(--accent-purple)]/20',
    green:
      'from-[var(--accent-green)]/10 to-[var(--accent-green)]/5 border-[var(--accent-green)]/20',
    orange:
      'from-[var(--accent-orange)]/10 to-[var(--accent-orange)]/5 border-[var(--accent-orange)]/20',
    pink: 'from-[var(--accent-pink)]/10 to-[var(--accent-pink)]/5 border-[var(--accent-pink)]/20',
  };

  const textColorMap = {
    blue: 'text-[var(--accent-blue)]',
    purple: 'text-[var(--accent-purple)]',
    green: 'text-[var(--accent-green)]',
    orange: 'text-[var(--accent-orange)]',
    pink: 'text-[var(--accent-pink)]',
  };

  return (
    <div className={`glass-card p-5 bg-gradient-to-br ${colorMap[color]} border`}>
      <div className={`text-3xl font-bold ${textColorMap[color]} mb-1`}>
        {loading ? (
          <div className="w-12 h-8 rounded loading-shimmer" />
        ) : (
          count.toLocaleString()
        )}
      </div>
      <p className="text-sm text-[var(--text-secondary)]">{title}</p>
    </div>
  );
}

function FeatureCard({
  href,
  icon,
  title,
  description,
  gradient,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <Link href={href} className="group">
      <div className="glass-card p-6 h-full">
        <div
          className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}
        >
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
          {title}
        </h3>
        <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
          {description}
        </p>
      </div>
    </Link>
  );
}

function FlowStep({
  number,
  title,
  subtitle,
  color,
}: {
  number: string;
  title: string;
  subtitle: string;
  color: 'blue' | 'purple' | 'green' | 'orange' | 'pink';
}) {
  const colorMap = {
    blue: 'bg-[var(--accent-blue)]',
    purple: 'bg-[var(--accent-purple)]',
    green: 'bg-[var(--accent-green)]',
    orange: 'bg-[var(--accent-orange)]',
    pink: 'bg-[var(--accent-pink)]',
  };

  return (
    <div className="flex flex-col items-center text-center flex-1">
      <div
        className={`w-12 h-12 ${colorMap[color]} rounded-full flex items-center justify-center text-white font-semibold text-sm mb-3`}
      >
        {number}
      </div>
      <p className="font-medium text-[var(--text-primary)] mb-1">{title}</p>
      <p className="text-xs text-[var(--text-tertiary)]">{subtitle}</p>
    </div>
  );
}

function FlowArrow() {
  return (
    <div className="hidden md:flex items-center text-[var(--text-tertiary)]">
      <svg
        className="w-6 h-6"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17 8l4 4m0 0l-4 4m4-4H3"
        />
      </svg>
    </div>
  );
}

function MenuCard({
  href,
  icon,
  title,
}: {
  href: string;
  icon: string;
  title: string;
}) {
  return (
    <Link href={href}>
      <div className="glass-card p-4 text-center group cursor-pointer">
        <div className="text-2xl mb-2 group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <p className="text-sm font-medium text-[var(--text-primary)]">{title}</p>
      </div>
    </Link>
  );
}
