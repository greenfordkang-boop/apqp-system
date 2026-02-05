'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface ControlPlan {
  id: string;
  name: string;
  version: string;
  status: string;
  created_at: string;
}

export default function GenerateDocumentsPage() {
  const [controlPlans, setControlPlans] = useState<ControlPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    message: string;
    data?: { sop_count?: number; inspection_count?: number };
  } | null>(null);

  useEffect(() => {
    fetchControlPlans();
  }, []);

  async function fetchControlPlans() {
    const { data, error } = await supabase
      .from('control_plans')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setControlPlans(data);
      if (data.length > 0) {
        setSelectedPlan(data[0].id);
      }
    }
    setLoading(false);
  }

  async function generateSOP() {
    if (!selectedPlan) return;

    setGenerating(true);
    setResult(null);

    try {
      const response = await fetch(`/api/generate/sop?control_plan_id=${selectedPlan}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: 'success',
          message: `SOP ${data.generated_count}개 항목이 생성되었습니다.`,
          data: { sop_count: data.generated_count }
        });
      } else {
        setResult({
          type: 'error',
          message: data.error || 'SOP 생성 실패'
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: '서버 오류가 발생했습니다.'
      });
    } finally {
      setGenerating(false);
    }
  }

  async function generateInspection() {
    if (!selectedPlan) return;

    setGenerating(true);
    setResult(null);

    try {
      const response = await fetch(`/api/generate/inspection?control_plan_id=${selectedPlan}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: 'success',
          message: `검사기준서 ${data.generated_count}개 항목이 생성되었습니다.`,
          data: { inspection_count: data.generated_count }
        });
      } else {
        setResult({
          type: 'error',
          message: data.error || '검사기준서 생성 실패'
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: '서버 오류가 발생했습니다.'
      });
    } finally {
      setGenerating(false);
    }
  }

  async function generateAll() {
    if (!selectedPlan) return;

    setGenerating(true);
    setResult(null);

    try {
      const sopResponse = await fetch(`/api/generate/sop?control_plan_id=${selectedPlan}`, {
        method: 'POST',
      });
      const sopData = await sopResponse.json();

      if (!sopData.success) {
        throw new Error(sopData.error || 'SOP 생성 실패');
      }

      const inspResponse = await fetch(`/api/generate/inspection?control_plan_id=${selectedPlan}`, {
        method: 'POST',
      });
      const inspData = await inspResponse.json();

      if (!inspData.success) {
        throw new Error(inspData.error || '검사기준서 생성 실패');
      }

      setResult({
        type: 'success',
        message: `문서가 모두 생성되었습니다. SOP: ${sopData.generated_count}개, 검사기준서: ${inspData.generated_count}개`,
        data: {
          sop_count: sopData.generated_count,
          inspection_count: inspData.generated_count
        }
      });
    } catch (error) {
      setResult({
        type: 'error',
        message: error instanceof Error ? error.message : '문서 생성 중 오류가 발생했습니다.'
      });
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-white/80 hover:text-white">← 홈</Link>
            <h1 className="text-2xl font-bold">문서 자동 생성</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {result && (
          <div className={`mb-6 p-4 rounded-lg ${
            result.type === 'success'
              ? 'bg-green-100 border border-green-400 text-green-700'
              : 'bg-red-100 border border-red-400 text-red-700'
          }`}>
            {result.type === 'success' ? '✅' : '❌'} {result.message}
          </div>
        )}

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">1. Control Plan 선택</h2>

          {loading ? (
            <div className="text-gray-500">로딩 중...</div>
          ) : controlPlans.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 mb-4">등록된 Control Plan이 없습니다.</p>
              <p className="text-sm text-gray-400">
                먼저 제품을 등록하고 Control Plan을 생성해주세요.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {controlPlans.map((plan) => (
                <label
                  key={plan.id}
                  className={`block p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedPlan === plan.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="controlPlan"
                      value={plan.id}
                      checked={selectedPlan === plan.id}
                      onChange={() => setSelectedPlan(plan.id)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <p className="font-medium text-gray-800">{plan.name}</p>
                      <p className="text-sm text-gray-500">
                        버전: {plan.version} | 상태: {plan.status} |
                        생성일: {new Date(plan.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">2. 생성할 문서 선택</h2>

          <div className="space-y-4">
            <div className="p-4 border rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-800">SOP (표준작업절차서)</h3>
                  <p className="text-sm text-gray-500">Control Plan의 각 항목에 대한 작업 절차를 생성합니다</p>
                </div>
                <button
                  onClick={generateSOP}
                  disabled={!selectedPlan || generating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                >
                  {generating ? '생성 중...' : 'SOP 생성'}
                </button>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-800">검사기준서</h3>
                  <p className="text-sm text-gray-500">Control Plan의 각 항목에 대한 검사 기준을 생성합니다</p>
                </div>
                <button
                  onClick={generateInspection}
                  disabled={!selectedPlan || generating}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {generating ? '생성 중...' : '검사기준서 생성'}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow p-6 text-white">
          <h2 className="text-lg font-semibold mb-2">전체 문서 일괄 생성</h2>
          <p className="text-white/80 mb-4">
            선택한 Control Plan을 기반으로 SOP와 검사기준서를 한 번에 생성합니다.
          </p>
          <button
            onClick={generateAll}
            disabled={!selectedPlan || generating}
            className="w-full py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 disabled:bg-gray-200 disabled:text-gray-500"
          >
            {generating ? '생성 중...' : '전체 문서 생성'}
          </button>
        </section>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
          <p className="font-semibold mb-2">문서 생성 프로세스</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>Control Plan에서 각 항목을 조회합니다</li>
            <li>각 항목의 특성 정보를 기반으로 문서를 생성합니다</li>
            <li>LLM을 활용하여 상세 내용을 자동 작성합니다</li>
            <li>생성된 문서는 FK로 연결되어 추적 가능합니다</li>
          </ol>
        </div>
      </main>
    </div>
  );
}
