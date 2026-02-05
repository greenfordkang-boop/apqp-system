'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

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
    inspections: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [products, chars, cps, sops, inspections] = await Promise.all([
          supabase.from('products').select('id', { count: 'exact', head: true }),
          supabase.from('characteristics').select('id', { count: 'exact', head: true }),
          supabase.from('control_plans').select('id', { count: 'exact', head: true }),
          supabase.from('sop_steps').select('id', { count: 'exact', head: true }),
          supabase.from('inspection_items').select('id', { count: 'exact', head: true })
        ]);

        setStats({
          products: products.count || 0,
          characteristics: chars.count || 0,
          controlPlans: cps.count || 0,
          sops: sops.count || 0,
          inspections: inspections.count || 0
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">APQP 품질문서 관리시스템</h1>
          <p className="text-blue-100 mt-1">Advanced Product Quality Planning System</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <StatCard title="제품" count={stats.products} icon="📦" loading={loading} />
          <StatCard title="특성" count={stats.characteristics} icon="🔧" loading={loading} />
          <StatCard title="Control Plan" count={stats.controlPlans} icon="📋" loading={loading} />
          <StatCard title="SOP" count={stats.sops} icon="📝" loading={loading} />
          <StatCard title="검사기준서" count={stats.inspections} icon="✅" loading={loading} />
        </div>

        {/* Quick Actions */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">빠른 작업</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ActionCard
              href="/products/new"
              title="신규 제품 등록"
              description="새로운 차종/제품과 특성을 등록합니다"
              icon="➕"
              color="bg-green-500"
            />
            <ActionCard
              href="/documents/generate"
              title="문서 자동 생성"
              description="Control Plan → SOP → 검사기준서 생성"
              icon="⚡"
              color="bg-blue-500"
            />
            <ActionCard
              href="/documents"
              title="문서 열람"
              description="생성된 문서 조회 및 다운로드"
              icon="📂"
              color="bg-purple-500"
            />
          </div>
        </section>

        {/* Document Flow */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">APQP 문서 체계</h2>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-wrap items-center justify-center gap-4">
              <FlowStep step="1" title="특성 등록" description="Single Source of Truth" />
              <Arrow />
              <FlowStep step="2" title="PFMEA" description="잠재고장모드분석" />
              <Arrow />
              <FlowStep step="3" title="Control Plan" description="관리계획서" />
              <Arrow />
              <FlowStep step="4" title="SOP" description="표준작업절차서" />
              <Arrow />
              <FlowStep step="5" title="검사기준서" description="품질검사기준" />
            </div>
            <div className="mt-4 text-center text-sm text-gray-500">
              모든 문서는 FK 관계로 추적 가능 (Traceability)
            </div>
          </div>
        </section>

        {/* Navigation Links */}
        <section>
          <h2 className="text-xl font-semibold text-gray-800 mb-4">메뉴</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <NavCard href="/products" title="제품 관리" description="제품 및 특성 목록" />
            <NavCard href="/control-plans" title="Control Plan" description="관리계획서 관리" />
            <NavCard href="/sops" title="SOP 관리" description="표준작업절차서" />
            <NavCard href="/inspections" title="검사기준서" description="품질검사기준 관리" />
            <NavCard href="/consistency" title="정합성 검사" description="문서 간 일관성 확인" />
            <NavCard href="/audit" title="감사 리포트" description="IATF 16949 매핑" />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6 text-center">
          <p>APQP Quality Document Management System v0.1.0</p>
          <p className="text-sm text-gray-500 mt-1">IATF 16949 Compliant</p>
        </div>
      </footer>
    </div>
  );
}

function StatCard({ title, count, icon, loading }: { title: string; count: number; icon: string; loading: boolean }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-2xl font-bold text-gray-800">
          {loading ? '...' : count}
        </span>
      </div>
      <p className="text-gray-600 mt-2">{title}</p>
    </div>
  );
}

function ActionCard({ href, title, description, icon, color }: {
  href: string; title: string; description: string; icon: string; color: string
}) {
  return (
    <Link href={href} className="block">
      <div className={`${color} text-white rounded-lg shadow-lg p-6 hover:opacity-90 transition-opacity`}>
        <div className="text-3xl mb-2">{icon}</div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-white/80 text-sm mt-1">{description}</p>
      </div>
    </Link>
  );
}

function NavCard({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link href={href} className="block">
      <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow border-l-4 border-blue-500">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <p className="text-gray-500 text-sm">{description}</p>
      </div>
    </Link>
  );
}

function FlowStep({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
        {step}
      </div>
      <p className="font-semibold mt-2">{title}</p>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

function Arrow() {
  return <div className="text-gray-400 text-2xl hidden md:block">→</div>;
}
