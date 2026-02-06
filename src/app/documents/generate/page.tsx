'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  productStore,
  characteristicStore,
  pfmeaStore,
  controlPlanStore,
  sopStore,
  inspectionStore,
  generatePfmeaForProduct,
  generateControlPlanForPfmea,
  generateSopForControlPlan,
  generateInspectionForControlPlan,
  type Product,
} from '@/lib/store';

type StageStatus = 'pending' | 'generating' | 'done';

interface StageState {
  status: StageStatus;
  itemCount: number;
  documentId: string | null;
}

const initialStages = {
  pfmea: { status: 'pending' as StageStatus, itemCount: 0, documentId: null as string | null },
  controlPlan: { status: 'pending' as StageStatus, itemCount: 0, documentId: null as string | null },
  sop: { status: 'pending' as StageStatus, itemCount: 0, documentId: null as string | null },
  inspection: { status: 'pending' as StageStatus, itemCount: 0, documentId: null as string | null },
};

export default function GenerateDocumentsPage() {
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [charCount, setCharCount] = useState(0);
  const [stages, setStages] = useState(initialStages);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    const load = async () => {
      const prods = await productStore.getAll();
      setProducts(prods);
    };
    load();
  }, []);

  const loadExistingDocuments = useCallback(async (productId: string) => {
    if (!productId) {
      setStages(initialStages);
      return;
    }

    const chars = await characteristicStore.getByProductId(productId);
    setCharCount(chars.length);

    const pfmeaHeader = await pfmeaStore.getHeaderByProductId(productId);
    const pfmeaLines = pfmeaHeader ? await pfmeaStore.getLines(pfmeaHeader.id) : [];
    const cp = pfmeaHeader ? await controlPlanStore.getByPfmeaId(pfmeaHeader.id) : undefined;
    const cpItems = cp ? await controlPlanStore.getItems(cp.id) : [];
    const sop = cp ? await sopStore.getByCpId(cp.id) : undefined;
    const sopSteps = sop ? await sopStore.getSteps(sop.id) : [];
    const insp = cp ? await inspectionStore.getByCpId(cp.id) : undefined;
    const inspItems = insp ? await inspectionStore.getItems(insp.id) : [];

    setStages({
      pfmea: { status: pfmeaHeader ? 'done' : 'pending', itemCount: pfmeaLines.length, documentId: pfmeaHeader?.id || null },
      controlPlan: { status: cp ? 'done' : 'pending', itemCount: cpItems.length, documentId: cp?.id || null },
      sop: { status: sop ? 'done' : 'pending', itemCount: sopSteps.length, documentId: sop?.id || null },
      inspection: { status: insp ? 'done' : 'pending', itemCount: inspItems.length, documentId: insp?.id || null },
    });
  }, []);

  const handleProductChange = async (productId: string) => {
    setSelectedProductId(productId);
    setError(null);
    await loadExistingDocuments(productId);
  };

  const handleGenerateAll = async () => {
    if (!selectedProductId) {
      setError('제품을 먼저 선택해주세요.');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Stage 1: PFMEA
      setStages(prev => ({ ...prev, pfmea: { ...prev.pfmea, status: 'generating' } }));
      await new Promise(r => setTimeout(r, 500));

      const { header: pfmeaHeader, lines: pfmeaLines } = await generatePfmeaForProduct(selectedProductId);
      setStages(prev => ({
        ...prev,
        pfmea: { status: 'done', itemCount: pfmeaLines.length, documentId: pfmeaHeader.id },
      }));
      await new Promise(r => setTimeout(r, 500));

      // Stage 2: Control Plan
      setStages(prev => ({ ...prev, controlPlan: { ...prev.controlPlan, status: 'generating' } }));
      await new Promise(r => setTimeout(r, 500));

      const { plan: cp, items: cpItems } = await generateControlPlanForPfmea(pfmeaHeader.id, selectedProductId);
      setStages(prev => ({
        ...prev,
        controlPlan: { status: 'done', itemCount: cpItems.length, documentId: cp.id },
      }));
      await new Promise(r => setTimeout(r, 500));

      // Stage 3: SOP
      setStages(prev => ({ ...prev, sop: { ...prev.sop, status: 'generating' } }));
      await new Promise(r => setTimeout(r, 500));

      const { sop, steps } = await generateSopForControlPlan(cp.id, selectedProductId);
      setStages(prev => ({
        ...prev,
        sop: { status: 'done', itemCount: steps.length, documentId: sop.id },
      }));
      await new Promise(r => setTimeout(r, 500));

      // Stage 4: Inspection
      setStages(prev => ({ ...prev, inspection: { ...prev.inspection, status: 'generating' } }));
      await new Promise(r => setTimeout(r, 500));

      const { standard: insp, items: inspItems } = await generateInspectionForControlPlan(cp.id, selectedProductId);
      setStages(prev => ({
        ...prev,
        inspection: { status: 'done', itemCount: inspItems.length, documentId: insp.id },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '문서 생성 중 오류가 발생했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const StatusIcon = ({ status }: { status: StageStatus }) => {
    if (status === 'pending')
      return <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-gray-300" /></div>;
    if (status === 'generating')
      return <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />;
    return (
      <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      </div>
    );
  };

  const StageCard = ({ number, title, stage, documentPath }: {
    number: number; title: string; stage: StageState; documentPath: string;
  }) => (
    <div className={`rounded-2xl p-5 border transition-all duration-300 ${
      stage.status === 'done' ? 'bg-green-50/60 border-green-200/60' :
      stage.status === 'generating' ? 'bg-blue-50/60 border-blue-200/60' :
      'bg-white/40 border-white/60'
    } backdrop-blur-md`}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <StatusIcon status={stage.status} />
          <div>
            <span className="text-xs font-semibold text-gray-500 uppercase">Stage {number}</span>
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            {stage.status === 'done' && <p className="text-sm text-gray-600">{stage.itemCount}개 항목 생성됨</p>}
            {stage.status === 'generating' && <p className="text-sm text-blue-600">생성 중...</p>}
            {stage.status === 'pending' && <p className="text-sm text-gray-400">대기 중</p>}
          </div>
        </div>
        {stage.documentId && stage.status === 'done' && (
          <Link href={`${documentPath}/${stage.documentId}`}
            className="px-5 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
            보기 →
          </Link>
        )}
      </div>
    </div>
  );

  if (!mounted) return <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50" />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <header className="border-b border-white/40 bg-white/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-900 text-sm font-medium">홈</Link>
          <span className="text-gray-300">|</span>
          <h1 className="text-xl font-bold text-gray-900">APQP 문서 자동 생성</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
            <p className="text-red-800 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* 제품 선택 */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-1">제품 선택</h2>
          <p className="text-sm text-gray-500 mb-4">문서를 생성할 제품을 선택하세요</p>

          {products.length === 0 ? (
            <div className="rounded-2xl p-10 bg-white/50 border border-white/60 text-center backdrop-blur-md">
              <p className="text-gray-500 mb-4">등록된 제품이 없습니다.</p>
              <Link href="/products/new" className="inline-block px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700">제품 등록하기</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map(product => (
                <button key={product.id} onClick={() => handleProductChange(product.id)}
                  className={`w-full text-left rounded-xl p-4 border transition-all ${
                    selectedProductId === product.id
                      ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-200'
                      : 'bg-white/40 border-white/60 hover:bg-white/60'
                  } backdrop-blur-md`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedProductId === product.id ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                    }`}>
                      {selectedProductId === product.id && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">코드: {product.code} | 고객: {product.customer}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* 특성 정보 */}
        {selectedProductId && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50/60 border border-blue-200/40">
            <p className="text-sm text-blue-800">등록된 특성: <span className="font-bold">{charCount}개</span></p>
          </div>
        )}

        {/* 생성 파이프라인 */}
        {selectedProductId && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-1">문서 생성 파이프라인</h2>
            <p className="text-sm text-gray-500 mb-6">4단계로 APQP 문서를 자동 생성합니다</p>

            <div className="space-y-3 mb-8">
              <StageCard number={1} title="PFMEA (잠재고장모드분석)" stage={stages.pfmea} documentPath="/documents/pfmea" />
              <StageCard number={2} title="관리계획서 (Control Plan)" stage={stages.controlPlan} documentPath="/documents/control-plan" />
              <StageCard number={3} title="작업표준서 (SOP)" stage={stages.sop} documentPath="/documents/sop" />
              <StageCard number={4} title="검사기준서" stage={stages.inspection} documentPath="/documents/inspection" />
            </div>

            <button onClick={handleGenerateAll} disabled={isGenerating}
              className="w-full py-4 rounded-2xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl active:scale-[0.99]">
              {isGenerating ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  생성 중...
                </span>
              ) : '전체 문서 생성'}
            </button>
          </section>
        )}

        {!selectedProductId && (
          <div className="text-center py-16">
            <div className="inline-block w-16 h-16 rounded-2xl bg-gray-100 mb-4" />
            <p className="text-gray-500">제품을 선택하여 시작하세요</p>
          </div>
        )}

        <section className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200/40">
          <h3 className="font-bold text-gray-900 mb-3">APQP 생성 프로세스</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <p><span className="font-semibold text-gray-800">1단계:</span> PFMEA는 특성 기반으로 자동 생성됩니다.</p>
            <p><span className="font-semibold text-gray-800">2단계:</span> 관리계획서는 PFMEA의 항목들을 기반으로 생성됩니다.</p>
            <p><span className="font-semibold text-gray-800">3단계:</span> 작업표준서는 관리계획서의 각 항목별로 생성됩니다.</p>
            <p><span className="font-semibold text-gray-800">4단계:</span> 검사기준서는 관리계획서의 검사 항목을 기반으로 생성됩니다.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
