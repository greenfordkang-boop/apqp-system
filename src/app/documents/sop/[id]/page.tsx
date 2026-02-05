'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface SopHeader {
  id: string;
  control_plan_id: string;
  process_name: string;
  revision: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SopStep {
  id: string;
  step_no: number;
  operation: string;
  control_plan_line_id: string | null;
  key_point: string | null;
  safety_note: string | null;
  quality_point: string | null;
  tools_equipment: string | null;
  cycle_time: number | null;
}

interface Product {
  id: string;
  name: string;
  code: string;
}

interface ControlPlanHeader {
  id: string;
  pfmea_id: string;
}

interface PfmeaHeader {
  id: string;
  project_id: string;
}

export default function SopViewPage() {
  const params = useParams();
  const sopId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [sop, setSop] = useState<SopHeader | null>(null);
  const [steps, setSteps] = useState<SopStep[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [controlPlan, setControlPlan] = useState<ControlPlanHeader | null>(null);

  useEffect(() => {
    if (sopId) {
      fetchSop();
    }
  }, [sopId]);

  async function fetchSop() {
    setLoading(true);
    try {
      // Fetch SOP header
      const { data: sopData, error: sopError } = await supabase
        .from('sop_headers')
        .select('*')
        .eq('id', sopId)
        .single();

      if (sopError || !sopData) {
        console.error('SOP not found:', sopError);
        setLoading(false);
        return;
      }

      setSop(sopData);

      // Fetch Control Plan info
      const { data: cpData } = await supabase
        .from('control_plan_headers')
        .select('id, pfmea_id')
        .eq('id', sopData.control_plan_id)
        .single();

      if (cpData) {
        setControlPlan(cpData);

        // Fetch PFMEA to get product
        const { data: pfmeaData } = await supabase
          .from('pfmea_headers')
          .select('id, project_id')
          .eq('id', cpData.pfmea_id)
          .single();

        if (pfmeaData) {
          // Fetch product info
          const { data: productData } = await supabase
            .from('products')
            .select('id, name, code')
            .eq('id', pfmeaData.project_id)
            .single();

          if (productData) {
            setProduct(productData);
          }
        }
      }

      // Fetch SOP steps
      const { data: stepsData, error: stepsError } = await supabase
        .from('sop_steps')
        .select('*')
        .eq('sop_id', sopId)
        .order('step_no', { ascending: true });

      if (!stepsError && stepsData) {
        setSteps(stepsData);
      }
    } catch (err) {
      console.error('Error fetching SOP:', err);
    }
    setLoading(false);
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">승인됨</span>;
      case 'review':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">검토중</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">초안</span>;
    }
  };

  const totalCycleTime = steps.reduce((sum, step) => sum + (step.cycle_time || 0), 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!sop) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">SOP를 찾을 수 없습니다</p>
          <Link href="/documents/generate" className="text-blue-600 hover:underline">
            ← 문서 생성 페이지로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-orange-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/documents/generate" className="text-white/80 hover:text-white">← 문서 생성</Link>
              <h1 className="text-2xl font-bold">SOP 문서 (표준작업절차서)</h1>
            </div>
            {getStatusBadge(sop.status)}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* SOP Header Info */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">SOP 정보</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">제품</p>
              <p className="font-medium">{product?.name || '-'}</p>
              <p className="text-xs text-gray-400">{product?.code}</p>
            </div>
            <div>
              <p className="text-gray-500">공정명</p>
              <p className="font-medium">{sop.process_name}</p>
            </div>
            <div>
              <p className="text-gray-500">리비전</p>
              <p className="font-medium">Rev. {sop.revision}</p>
            </div>
            <div>
              <p className="text-gray-500">생성일</p>
              <p className="font-medium">{new Date(sop.created_at).toLocaleDateString('ko-KR')}</p>
            </div>
          </div>
          {controlPlan && (
            <div className="mt-4 pt-4 border-t">
              <Link
                href={`/documents/control-plan/${controlPlan.id}`}
                className="text-blue-600 hover:underline text-sm"
              >
                → 관련 Control Plan 문서 보기
              </Link>
            </div>
          )}
        </section>

        {/* SOP Steps */}
        <section className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">
              작업 단계 ({steps.length}단계)
            </h2>
            <span className="text-sm text-gray-500">
              총 사이클 타임: {totalCycleTime}초
            </span>
          </div>

          {steps.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              작업 단계가 없습니다
            </div>
          ) : (
            <div className="divide-y">
              {steps.map((step) => (
                <div key={step.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start gap-4">
                    {/* Step Number */}
                    <div className="flex-shrink-0 w-12 h-12 bg-orange-100 text-orange-700 rounded-full flex items-center justify-center font-bold text-lg">
                      {step.step_no}
                    </div>

                    {/* Step Content */}
                    <div className="flex-grow">
                      <h3 className="text-lg font-medium text-gray-900 mb-2">{step.operation}</h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                        {step.key_point && (
                          <div className="bg-blue-50 p-3 rounded-lg">
                            <p className="text-xs text-blue-600 font-medium mb-1">📌 핵심 포인트</p>
                            <p className="text-sm text-blue-800">{step.key_point}</p>
                          </div>
                        )}

                        {step.safety_note && (
                          <div className="bg-red-50 p-3 rounded-lg">
                            <p className="text-xs text-red-600 font-medium mb-1">⚠️ 안전 주의사항</p>
                            <p className="text-sm text-red-800">{step.safety_note}</p>
                          </div>
                        )}

                        {step.quality_point && (
                          <div className="bg-green-50 p-3 rounded-lg">
                            <p className="text-xs text-green-600 font-medium mb-1">✅ 품질 포인트</p>
                            <p className="text-sm text-green-800">{step.quality_point}</p>
                          </div>
                        )}

                        {step.tools_equipment && (
                          <div className="bg-gray-50 p-3 rounded-lg">
                            <p className="text-xs text-gray-600 font-medium mb-1">🔧 사용 장비/도구</p>
                            <p className="text-sm text-gray-800">{step.tools_equipment}</p>
                          </div>
                        )}
                      </div>

                      {step.cycle_time && (
                        <p className="text-xs text-gray-500 mt-3">
                          ⏱️ 사이클 타임: {step.cycle_time}초
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Summary Statistics */}
        <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">{steps.length}</p>
            <p className="text-sm text-gray-500">총 단계 수</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {steps.filter(s => s.key_point).length}
            </p>
            <p className="text-sm text-gray-500">핵심 포인트</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {steps.filter(s => s.safety_note).length}
            </p>
            <p className="text-sm text-gray-500">안전 주의사항</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-gray-600">{totalCycleTime}초</p>
            <p className="text-sm text-gray-500">총 사이클 타임</p>
          </div>
        </section>
      </main>
    </div>
  );
}
