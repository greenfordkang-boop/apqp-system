'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Product {
  id: string;
  code: string;
  name: string;
  customer: string;
  status: string;
  created_at: string;
}

interface PfmeaHeader {
  id: string;
  process_name: string;
  revision: number;
  status: string;
}

interface ControlPlan {
  id: string;
  name: string;
  version: string;
  status: string;
  created_at: string;
}

export default function GenerateDocumentsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [pfmea, setPfmea] = useState<PfmeaHeader | null>(null);
  const [controlPlans, setControlPlans] = useState<ControlPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      fetchPfmeaAndControlPlan(selectedProduct);
    } else {
      setPfmea(null);
      setControlPlans([]);
      setSelectedPlan('');
    }
  }, [selectedProduct]);

  async function fetchProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProducts(data);
      if (data.length > 0) {
        setSelectedProduct(data[0].id);
      }
    }
    setLoading(false);
  }

  async function fetchPfmeaAndControlPlan(productId: string) {
    // Fetch PFMEA
    const { data: pfmeaData } = await supabase
      .from('pfmea_headers')
      .select('*')
      .eq('project_id', productId)
      .order('revision', { ascending: false })
      .limit(1)
      .single();

    setPfmea(pfmeaData || null);

    // Fetch Control Plans
    if (pfmeaData) {
      const { data: cpData } = await supabase
        .from('control_plans')
        .select('*')
        .eq('pfmea_id', pfmeaData.id)
        .order('revision', { ascending: false });

      if (cpData && cpData.length > 0) {
        setControlPlans(cpData);
        setSelectedPlan(cpData[0].id);
      } else {
        setControlPlans([]);
        setSelectedPlan('');
      }
    } else {
      setControlPlans([]);
      setSelectedPlan('');
    }
  }

  async function generatePFMEA() {
    if (!selectedProduct) return;

    setGenerating(true);
    setCurrentStep('PFMEA 생성 중...');
    setResult(null);

    try {
      const response = await fetch('/api/generate/pfmea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: selectedProduct }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: 'success',
          message: `PFMEA가 생성되었습니다. (${data.lines_count || data.generated_count}개 항목)`,
        });
        await fetchPfmeaAndControlPlan(selectedProduct);
      } else {
        setResult({
          type: 'error',
          message: data.error || 'PFMEA 생성 실패',
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: '서버 오류가 발생했습니다.',
      });
    } finally {
      setGenerating(false);
      setCurrentStep('');
    }
  }

  async function generateControlPlan() {
    if (!pfmea) return;

    setGenerating(true);
    setCurrentStep('Control Plan 생성 중...');
    setResult(null);

    try {
      const response = await fetch('/api/generate/control-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pfmea_id: pfmea.id }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: 'success',
          message: `Control Plan이 생성되었습니다. (${data.items_count || data.generated_count}개 항목)`,
        });
        await fetchPfmeaAndControlPlan(selectedProduct);
      } else {
        setResult({
          type: 'error',
          message: data.error || 'Control Plan 생성 실패',
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: '서버 오류가 발생했습니다.',
      });
    } finally {
      setGenerating(false);
      setCurrentStep('');
    }
  }

  async function generateSOP() {
    if (!selectedPlan) return;

    setGenerating(true);
    setCurrentStep('SOP 생성 중...');
    setResult(null);

    try {
      const response = await fetch('/api/generate/sop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ control_plan_id: selectedPlan }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: 'success',
          message: `SOP ${data.steps_count}개 항목이 생성되었습니다.`,
        });
      } else {
        setResult({
          type: 'error',
          message: data.error || 'SOP 생성 실패',
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: '서버 오류가 발생했습니다.',
      });
    } finally {
      setGenerating(false);
      setCurrentStep('');
    }
  }

  async function generateInspection() {
    if (!selectedPlan) return;

    setGenerating(true);
    setCurrentStep('검사기준서 생성 중...');
    setResult(null);

    try {
      const response = await fetch('/api/generate/inspection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ control_plan_id: selectedPlan }),
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          type: 'success',
          message: `검사기준서 ${data.generated_count}개 항목이 생성되었습니다.`,
        });
      } else {
        setResult({
          type: 'error',
          message: data.error || '검사기준서 생성 실패',
        });
      }
    } catch (error) {
      setResult({
        type: 'error',
        message: '서버 오류가 발생했습니다.',
      });
    } finally {
      setGenerating(false);
      setCurrentStep('');
    }
  }

  async function generateAll() {
    if (!selectedProduct) return;

    setGenerating(true);
    setResult(null);

    try {
      // Step 1: PFMEA
      setCurrentStep('1/4: PFMEA 생성 중...');
      let currentPfmeaId = pfmea?.id;

      if (!currentPfmeaId) {
        const pfmeaResponse = await fetch('/api/generate/pfmea', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: selectedProduct }),
        });
        const pfmeaData = await pfmeaResponse.json();
        if (!pfmeaData.success) throw new Error(pfmeaData.error || 'PFMEA 생성 실패');
        currentPfmeaId = pfmeaData.pfmea_id;
      }

      // Step 2: Control Plan
      setCurrentStep('2/4: Control Plan 생성 중...');
      let currentCpId = selectedPlan;

      if (!currentCpId) {
        const cpResponse = await fetch('/api/generate/control-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pfmea_id: currentPfmeaId }),
        });
        const cpData = await cpResponse.json();
        if (!cpData.success) throw new Error(cpData.error || 'Control Plan 생성 실패');
        currentCpId = cpData.control_plan_id;
      }

      // Step 3: SOP
      setCurrentStep('3/4: SOP 생성 중...');
      const sopResponse = await fetch('/api/generate/sop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ control_plan_id: currentCpId }),
      });
      const sopData = await sopResponse.json();
      if (!sopData.success) throw new Error(sopData.error || 'SOP 생성 실패');

      // Step 4: Inspection
      setCurrentStep('4/4: 검사기준서 생성 중...');
      const inspResponse = await fetch('/api/generate/inspection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ control_plan_id: currentCpId }),
      });
      const inspData = await inspResponse.json();
      if (!inspData.success) throw new Error(inspData.error || '검사기준서 생성 실패');

      await fetchPfmeaAndControlPlan(selectedProduct);

      setResult({
        type: 'success',
        message: `전체 APQP 문서가 생성되었습니다!\n- PFMEA\n- Control Plan\n- SOP: ${sopData.steps_count}개\n- 검사기준서: ${inspData.generated_count}개`,
      });
    } catch (error) {
      setResult({
        type: 'error',
        message: error instanceof Error ? error.message : '문서 생성 중 오류가 발생했습니다.',
      });
    } finally {
      setGenerating(false);
      setCurrentStep('');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-white/80 hover:text-white">← 홈</Link>
            <h1 className="text-2xl font-bold">APQP 문서 자동 생성</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Progress Indicator */}
        {generating && currentStep && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
              <span className="text-blue-800 font-medium">{currentStep}</span>
            </div>
          </div>
        )}

        {/* Result Message */}
        {result && (
          <div className={`mb-6 p-4 rounded-lg whitespace-pre-line ${
            result.type === 'success'
              ? 'bg-green-100 border border-green-400 text-green-700'
              : 'bg-red-100 border border-red-400 text-red-700'
          }`}>
            {result.type === 'success' ? '✅' : '❌'} {result.message}
          </div>
        )}

        {/* APQP Flow Diagram */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">APQP 문서 흐름</h2>
          <div className="flex items-center justify-between text-sm">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${selectedProduct ? 'bg-blue-500' : 'bg-gray-300'}`}>1</div>
              <span className="mt-2 text-gray-600">특성 등록</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${pfmea ? 'bg-purple-500' : 'bg-gray-300'}`}>2</div>
              <span className="mt-2 text-gray-600">PFMEA</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${controlPlans.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}>3</div>
              <span className="mt-2 text-gray-600">Control Plan</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-orange-500">4</div>
              <span className="mt-2 text-gray-600">SOP</span>
            </div>
            <div className="flex-1 h-0.5 bg-gray-200 mx-2"></div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold bg-red-500">5</div>
              <span className="mt-2 text-gray-600">검사기준서</span>
            </div>
          </div>
        </section>

        {/* Product Selection */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">1. 제품 선택</h2>

          {loading ? (
            <div className="text-gray-500">로딩 중...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-500 mb-4">등록된 제품이 없습니다.</p>
              <Link
                href="/products/new"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                제품 등록하기
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map((product) => (
                <label
                  key={product.id}
                  className={`block p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedProduct === product.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="product"
                      value={product.id}
                      checked={selectedProduct === product.id}
                      onChange={() => setSelectedProduct(product.id)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <p className="font-medium text-gray-800">{product.name}</p>
                      <p className="text-sm text-gray-500">
                        코드: {product.code} | 고객: {product.customer || '-'} |
                        생성일: {new Date(product.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        {/* Document Status & Generation */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">2. 문서 현황 및 생성</h2>

          <div className="space-y-4">
            {/* PFMEA */}
            <div className="p-4 border rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-800">PFMEA (잠재고장모드분석)</h3>
                  {pfmea ? (
                    <p className="text-sm text-green-600">
                      ✅ 생성됨 - {pfmea.process_name} (Rev.{pfmea.revision})
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">미생성</p>
                  )}
                </div>
                <button
                  onClick={generatePFMEA}
                  disabled={!selectedProduct || generating}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                >
                  {pfmea ? 'PFMEA 재생성' : 'PFMEA 생성'}
                </button>
              </div>
            </div>

            {/* Control Plan */}
            <div className="p-4 border rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-800">Control Plan (관리계획서)</h3>
                  {controlPlans.length > 0 ? (
                    <p className="text-sm text-green-600">
                      ✅ 생성됨 - {controlPlans[0].name}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500">{pfmea ? '미생성' : 'PFMEA 먼저 필요'}</p>
                  )}
                </div>
                <button
                  onClick={generateControlPlan}
                  disabled={!pfmea || generating}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {controlPlans.length > 0 ? 'CP 재생성' : 'Control Plan 생성'}
                </button>
              </div>
            </div>

            {/* SOP */}
            <div className="p-4 border rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-800">SOP (표준작업절차서)</h3>
                  <p className="text-sm text-gray-500">
                    {controlPlans.length > 0 ? 'Control Plan 기반 생성 가능' : 'Control Plan 먼저 필요'}
                  </p>
                </div>
                <button
                  onClick={generateSOP}
                  disabled={!selectedPlan || generating}
                  className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400"
                >
                  SOP 생성
                </button>
              </div>
            </div>

            {/* Inspection */}
            <div className="p-4 border rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-800">검사기준서</h3>
                  <p className="text-sm text-gray-500">
                    {controlPlans.length > 0 ? 'Control Plan 기반 생성 가능' : 'Control Plan 먼저 필요'}
                  </p>
                </div>
                <button
                  onClick={generateInspection}
                  disabled={!selectedPlan || generating}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                >
                  검사기준서 생성
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Generate All */}
        <section className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow p-6 text-white">
          <h2 className="text-lg font-semibold mb-2">🚀 전체 APQP 문서 일괄 생성</h2>
          <p className="text-white/80 mb-4">
            선택한 제품을 기반으로 PFMEA → Control Plan → SOP → 검사기준서를 한 번에 생성합니다.
          </p>
          <button
            onClick={generateAll}
            disabled={!selectedProduct || generating}
            className="w-full py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50 disabled:bg-gray-200 disabled:text-gray-500"
          >
            {generating ? `⏳ ${currentStep || '생성 중...'}` : '⚡ 전체 문서 생성'}
          </button>
        </section>

        {/* Info */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
          <p className="font-semibold mb-2">📋 APQP 문서 생성 프로세스</p>
          <ol className="list-decimal list-inside space-y-1">
            <li><strong>특성 등록</strong>: 제품 등록 시 특성(Characteristic)을 Single Source of Truth로 등록</li>
            <li><strong>PFMEA</strong>: 특성 기반 잠재 고장모드, 영향, 원인, S/O/D 점수 자동 생성</li>
            <li><strong>Control Plan</strong>: PFMEA 기반 예방/검출 관리 항목 자동 생성</li>
            <li><strong>SOP</strong>: Control Plan 항목별 작업표준서 자동 생성</li>
            <li><strong>검사기준서</strong>: Control Plan 항목별 검사기준 자동 생성</li>
          </ol>
          <p className="mt-3 text-blue-600">
            모든 문서는 FK로 연결되어 완벽한 Traceability를 보장합니다.
          </p>
        </div>
      </main>
    </div>
  );
}
