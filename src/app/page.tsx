'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Stats {
  products: number;
  controlPlans: number;
  sopSteps: number;
  inspectionItems: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    products: 0,
    controlPlans: 0,
    sopSteps: 0,
    inspectionItems: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const [products, controlPlans, sopSteps, inspectionItems] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('control_plans').select('id', { count: 'exact', head: true }),
        supabase.from('sop_steps').select('id', { count: 'exact', head: true }),
        supabase.from('inspection_items').select('id', { count: 'exact', head: true })
      ]);

      setStats({
        products: products.count || 0,
        controlPlans: controlPlans.count || 0,
        sopSteps: sopSteps.count || 0,
        inspectionItems: inspectionItems.count || 0
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold">APQP 품질문서 관리 시스템</h1>
          <p className="text-blue-100 mt-1">자동차 부품 품질 문서 자동 생성 및 관리</p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="등록 제품"
            value={loading ? '...' : stats.products}
            icon="📦"
            color="bg-blue-500"
          />
          <StatCard
            title="Control Plan"
            value={loading ? '...' : stats.controlPlans}
            icon="📋"
            color="bg-green-500"
          />
          <StatCard
            title="SOP 문서"
            value={loading ? '...' : stats.sopSteps}
            icon="📝"
            color="bg-purple-500"
          />
          <StatCard
            title="검사기준서"
            value={loading ? '...' : stats.inspectionItems}
            icon="✅"
            color="bg-orange-500"
          />
        </div>

        {/* Quick Actions */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">빠른 작업</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/products/new" className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="text-3xl mb-2">🚗</div>
              <h3 className="font-semibold text-gray-800">신규 차종 등록</h3>
              <p className="text-sm text-gray-500">새로운 제품과 특성을 등록합니다</p>
            </Link>
            <Link href="/documents/generate" className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="text-3xl mb-2">⚡</div>
              <h3 className="font-semibold text-gray-800">문서 자동 생성</h3>
              <p className="text-sm text-gray-500">SOP, 검사기준서를 자동 생성합니다</p>
            </Link>
            <Link href="/documents" className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
              <div className="text-3xl mb-2">📂</div>
              <h3 className="font-semibold text-gray-800">문서 열람</h3>
              <p className="text-sm text-gray-500">생성된 문서를 조회합니다</p>
            </Link>
          </div>
        </section>

        {/* Navigation */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">메뉴</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <NavCard href="/products" title="제품 관리" icon="📦" />
            <NavCard href="/documents" title="문서 열람" icon="📄" />
            <NavCard href="/documents/generate" title="문서 생성" icon="🔧" />
            <NavCard href="/api/health" title="시스템 상태" icon="💚" external />
          </div>
        </section>

        {/* Document Flow */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">문서 생성 흐름</h2>
          <div className="flex flex-wrap items-center justify-center gap-4 text-center">
            <FlowStep step="1" title="제품/특성 등록" />
            <Arrow />
            <FlowStep step="2" title="PFMEA 생성" />
            <Arrow />
            <FlowStep step="3" title="Control Plan" />
            <Arrow />
            <FlowStep step="4" title="SOP/검사기준서" />
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            특성(Characteristic)이 Single Source of Truth로 모든 문서에 연결됩니다
          </p>
        </section>
      </main>
    </div>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: number | string; icon: string; color: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
        <div className={`${color} text-white p-3 rounded-lg text-2xl`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function NavCard({ href, title, icon, external }: { href: string; title: string; icon: string; external?: boolean }) {
  const content = (
    <div className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow text-center">
      <div className="text-2xl mb-2">{icon}</div>
      <p className="font-medium text-gray-700">{title}</p>
    </div>
  );

  if (external) {
    return <a href={href} target="_blank" rel="noopener noreferrer">{content}</a>;
  }
  return <Link href={href}>{content}</Link>;
}

function FlowStep({ step, title }: { step: string; title: string }) {
  return (
    <div className="bg-blue-50 rounded-lg p-4 min-w-[120px]">
      <div className="text-blue-600 font-bold text-lg">Step {step}</div>
      <div className="text-sm text-gray-600">{title}</div>
    </div>
  );
}

function Arrow() {
  return <div className="text-gray-400 text-2xl">→</div>;
}
