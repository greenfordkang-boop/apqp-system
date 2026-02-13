'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { sopStore, productStore } from '@/lib/store';
import type { Sop, SopStep, Product } from '@/lib/store';

type EditingStep = SopStep;

export default function SopViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sopId } = use(params);

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [sop, setSop] = useState<Sop | null>(null);
  const [steps, setSteps] = useState<SopStep[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingSteps, setEditingSteps] = useState<Map<string, EditingStep>>(new Map());
  const [editPanelStepId, setEditPanelStepId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (sopId) fetchData();
  }, [sopId]);

  async function fetchData() {
    setLoading(true);
    try {
      const sopData = await sopStore.getById(sopId);
      if (!sopData) { setLoading(false); return; }
      setSop(sopData);

      const stepsData = await sopStore.getSteps(sopId);
      setSteps(stepsData);

      if (sopData.product_id) {
        const productData = await productStore.getById(sopData.product_id);
        if (productData) setProduct(productData);
      }
    } catch (err) {
      console.error('Error fetching SOP:', err);
    }
    setLoading(false);
  }

  // --- 편집 모드 ---
  const handleEditModeToggle = () => {
    if (sop?.status === 'approved') return;
    setIsEditMode(true);
    const newMap = new Map<string, EditingStep>();
    steps.forEach((step) => { newMap.set(step.id, { ...step }); });
    setEditingSteps(newMap);
  };

  const handleEditingChange = (stepId: string, field: string, value: string | number) => {
    const current = editingSteps.get(stepId);
    if (!current) return;
    editingSteps.set(stepId, { ...current, [field]: value });
    setEditingSteps(new Map(editingSteps));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      for (const [stepId, stepData] of editingSteps) {
        await sopStore.updateStep(stepId, {
          process_step: stepData.process_step,
          action: stepData.action,
          key_point: stepData.key_point,
          safety_note: stepData.safety_note,
          quality_point: stepData.quality_point,
          tools_equipment: stepData.tools_equipment,
          estimated_time_sec: stepData.estimated_time_sec,
        });
      }
      await fetchData();
      setIsEditMode(false);
      setEditingSteps(new Map());
      setEditPanelStepId(null);
    } catch (err) {
      console.error('Error saving:', err);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditingSteps(new Map());
    setEditPanelStepId(null);
  };

  const handleStatusChange = async (newStatus: 'draft' | 'review' | 'approved') => {
    if (!sop) return;
    try {
      await sopStore.updateStatus(sopId, newStatus);
      setSop({ ...sop, status: newStatus });
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handlePrint = () => {
    const prevTitle = document.title;
    const date = sop ? new Date(sop.created_at).toISOString().slice(0, 10).replace(/-/g, '') : '';
    const parts = ['SOP', product?.customer, product?.vehicle_model, product?.name, product?.part_number || product?.code, date].filter(Boolean);
    document.title = parts.join('_');
    window.print();
    document.title = prevTitle;
  };

  // --- 헬퍼 ---
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">승인됨</span>;
      case 'review': return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">검토중</span>;
      default: return <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">초안</span>;
    }
  };

  const formatTime = (sec: number) => {
    if (!sec) return '-';
    if (sec >= 60) return `${Math.floor(sec / 60)}분 ${sec % 60 ? sec % 60 + '초' : ''}`.trim();
    return `${sec}초`;
  };

  const totalTimeSec = steps.reduce((sum, s) => sum + (s.estimated_time_sec || 0), 0);

  // --- 편집 패널 ---
  const editStep = editPanelStepId ? editingSteps.get(editPanelStepId) : null;
  const editStepIdx = editPanelStepId ? steps.findIndex((s) => s.id === editPanelStepId) : -1;
  const canGoPrev = editStepIdx > 0;
  const canGoNext = editStepIdx >= 0 && editStepIdx < steps.length - 1;

  if (!mounted) return <div className="min-h-screen" />;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-gray-500 text-sm font-medium">로딩 중...</div>
      </div>
    );
  }

  if (!sop) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4 font-medium">작업표준서를 찾을 수 없습니다</p>
          <Link href="/documents/generate" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
            ← 문서 생성 페이지로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <style>{`
        @media print {
          .sop-screen { display: none !important; }
          .sop-print { display: block !important; }
          body { background: white !important; margin: 0; padding: 0; }
          @page { size: A4 landscape; margin: 8mm; }
        }
        .sop-print { display: none; }
        .sop-print table { border-collapse: collapse; width: 100%; }
        .sop-print th, .sop-print td { border: 1px solid #333; padding: 4px 6px; font-size: 9px; vertical-align: top; }
        .sop-print th { background: #e8e8e8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 700; text-align: center; vertical-align: middle; }
        .sop-print .c { text-align: center; vertical-align: middle; }
        .sop-print .r { text-align: right; vertical-align: middle; }
        .sop-print .info-table { margin-bottom: 6px; }
        .sop-print .info-table td { border: 1px solid #333; padding: 3px 6px; font-size: 9px; }
        .sop-print .info-table .label { background: #f0f0f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 600; width: 80px; text-align: center; }
        .sop-print h2 { font-size: 16px; font-weight: 700; text-align: center; margin: 0 0 6px; padding-bottom: 4px; border-bottom: 2px solid #333; }
        .sop-print .safety { color: #c00; font-weight: 600; }
        .sop-print .footer { margin-top: 8px; font-size: 8px; color: #666; }
        .sop-print .approval { margin-top: 10px; }
        .sop-print .approval td { height: 30px; width: 80px; text-align: center; }
      `}</style>

      {/* ===== SCREEN ===== */}
      <div className="sop-screen">
        {/* Header */}
        <header className="bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-6">
              <Link href="/documents/generate" className="text-white/70 hover:text-white transition-colors text-sm">
                ← 돌아가기
              </Link>
              <div className="flex items-center gap-3">
                {!isEditMode ? (
                  <>
                    <button onClick={handlePrint} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
                      PDF 다운로드
                    </button>
                    {sop.status !== 'approved' && (
                      <button onClick={handleEditModeToggle} className="px-4 py-2 bg-white text-orange-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors">
                        편집
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={handleCancel} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
                      취소
                    </button>
                    <button onClick={handleSaveAll} disabled={isSaving} className="px-4 py-2 bg-white text-orange-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                      {isSaving ? '저장 중...' : '전체 저장'}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">작업표준서 (SOP)</h1>
                {product && <p className="text-white/80 text-sm">{product.name} {product.code && `(${product.code})`}</p>}
              </div>
              {getStatusBadge(sop.status)}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* 요약 */}
          <div className="bg-white/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-white/50 mb-8">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              <div><p className="text-gray-500 text-xs mb-1">문서명</p><p className="text-gray-900 font-semibold text-sm">{sop.name}</p></div>
              <div><p className="text-gray-500 text-xs mb-1">리비전</p><p className="text-gray-900 font-semibold text-sm">Rev. {sop.revision}</p></div>
              <div><p className="text-gray-500 text-xs mb-1">작업 단계</p><p className="text-gray-900 font-semibold text-sm">{steps.length}단계</p></div>
              <div><p className="text-gray-500 text-xs mb-1">총 소요시간</p><p className="text-gray-900 font-semibold text-sm">{formatTime(totalTimeSec)}</p></div>
              <div><p className="text-gray-500 text-xs mb-1">작성일</p><p className="text-gray-900 font-semibold text-sm">{new Date(sop.created_at).toLocaleDateString('ko-KR')}</p></div>
            </div>
          </div>

          {/* 상태 액션 */}
          {!isEditMode && sop.status === 'draft' && (
            <div className="bg-blue-50/70 backdrop-blur rounded-2xl shadow-sm p-5 border border-blue-200/50 mb-8 flex items-center justify-between">
              <div><p className="text-blue-900 font-medium text-sm">검토 준비 완료?</p><p className="text-blue-700 text-xs mt-0.5">검토 요청을 통해 담당자의 검토를 요청할 수 있습니다.</p></div>
              <button onClick={() => handleStatusChange('review')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">검토 요청</button>
            </div>
          )}
          {!isEditMode && sop.status === 'review' && (
            <div className="bg-yellow-50/70 backdrop-blur rounded-2xl shadow-sm p-5 border border-yellow-200/50 mb-8 flex items-center justify-between">
              <div><p className="text-yellow-900 font-medium text-sm">검토 중입니다</p></div>
              <div className="flex gap-3">
                <button onClick={() => handleStatusChange('draft')} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors">초안으로</button>
                <button onClick={() => handleStatusChange('approved')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">승인</button>
              </div>
            </div>
          )}
          {!isEditMode && sop.status === 'approved' && (
            <div className="bg-green-50/70 backdrop-blur rounded-2xl shadow-sm p-5 border border-green-200/50 mb-8 flex items-center justify-between">
              <div><p className="text-green-900 font-medium text-sm">승인 완료</p></div>
              <button onClick={() => { handleStatusChange('draft'); setIsEditMode(true); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">수정하기</button>
            </div>
          )}

          {/* 작업 단계 테이블 */}
          <div className="bg-white/70 backdrop-blur rounded-2xl shadow-sm border border-white/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">작업 단계</h2>
              <p className="text-sm text-gray-500 mt-1">{steps.length}개의 작업 단계 {isEditMode && '• 행을 클릭하여 편집'}</p>
            </div>

            {steps.length === 0 ? (
              <div className="p-12 text-center"><p className="text-gray-500 text-sm">작업 단계가 없습니다</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 w-12">No</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">공정단계</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">작업내용</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">Key Point</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">안전주의</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">품질포인트</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">도구/장비</th>
                      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700">시간</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {steps.map((step) => {
                      const displayStep = (isEditMode ? editingSteps.get(step.id) : null) || step;
                      return (
                        <tr
                          key={step.id}
                          className={`hover:bg-gray-50/50 transition-colors ${isEditMode ? 'cursor-pointer' : ''} ${editPanelStepId === step.id ? 'bg-orange-50/50' : ''}`}
                          onClick={() => { if (isEditMode) setEditPanelStepId(step.id); }}
                        >
                          <td className="px-3 py-3 text-center text-gray-500 font-medium">{step.step_no}</td>
                          <td className="px-3 py-3 text-gray-900 font-medium text-xs">{displayStep.process_step}</td>
                          <td className="px-3 py-3 text-xs text-gray-700 max-w-[200px]">{displayStep.action || '-'}</td>
                          <td className="px-3 py-3 text-xs text-orange-700 font-medium max-w-[150px]">{displayStep.key_point || '-'}</td>
                          <td className="px-3 py-3 text-xs text-red-600 max-w-[120px]">{displayStep.safety_note || '-'}</td>
                          <td className="px-3 py-3 text-xs text-blue-700 max-w-[120px]">{displayStep.quality_point || '-'}</td>
                          <td className="px-3 py-3 text-xs text-gray-700">{displayStep.tools_equipment || '-'}</td>
                          <td className="px-3 py-3 text-right text-xs text-gray-600">{formatTime(displayStep.estimated_time_sec)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        {/* ===== 슬라이드 편집 패널 ===== */}
        {isEditMode && editPanelStepId && editStep && (
          <div className="fixed top-0 right-0 h-full w-[420px] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
            {/* 패널 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { if (canGoPrev) setEditPanelStepId(steps[editStepIdx - 1].id); }}
                  disabled={!canGoPrev}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >▲</button>
                <button
                  onClick={() => { if (canGoNext) setEditPanelStepId(steps[editStepIdx + 1].id); }}
                  disabled={!canGoNext}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >▼</button>
                <span className="text-sm font-semibold text-gray-700">
                  단계 {editStepIdx + 1} / {steps.length}
                </span>
              </div>
              <button onClick={() => setEditPanelStepId(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {/* 패널 본문 */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* 공정단계 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">공정단계</label>
                <input
                  type="text"
                  value={editStep.process_step}
                  onChange={(e) => handleEditingChange(editPanelStepId, 'process_step', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                />
              </div>

              {/* 작업내용 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">작업내용</label>
                <textarea
                  value={editStep.action}
                  onChange={(e) => handleEditingChange(editPanelStepId, 'action', e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  placeholder="작업 절차를 상세히 기술하세요"
                />
              </div>

              {/* Key Point */}
              <div className="bg-orange-50 rounded-xl p-4">
                <label className="block text-sm font-semibold text-orange-700 mb-1">핵심 포인트 (Key Point)</label>
                <textarea
                  value={editStep.key_point || ''}
                  onChange={(e) => handleEditingChange(editPanelStepId, 'key_point', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2.5 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm bg-white"
                  placeholder="PFMEA 예방관리 항목 반영"
                />
                <p className="mt-1 text-[11px] text-orange-400">PFMEA 예방관리 항목 및 공정 핵심 관리 포인트</p>
              </div>

              {/* 안전 주의사항 */}
              <div className="bg-red-50 rounded-xl p-4">
                <label className="block text-sm font-semibold text-red-700 mb-1">안전 주의사항</label>
                <textarea
                  value={editStep.safety_note || ''}
                  onChange={(e) => handleEditingChange(editPanelStepId, 'safety_note', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm bg-white"
                  placeholder="안전 관련 항목 (S>=8)은 필수 기재"
                />
                <p className="mt-1 text-[11px] text-red-400">PFMEA 심각도(S) 8 이상 항목은 반드시 포함</p>
              </div>

              {/* 품질 포인트 */}
              <div className="bg-blue-50 rounded-xl p-4">
                <label className="block text-sm font-semibold text-blue-700 mb-1">품질 포인트</label>
                <textarea
                  value={editStep.quality_point || ''}
                  onChange={(e) => handleEditingChange(editPanelStepId, 'quality_point', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                  placeholder="Poka-Yoke 확인 포인트 등"
                />
                <p className="mt-1 text-[11px] text-blue-400">Poka-Yoke 적용 항목 확인 포인트 명시</p>
              </div>

              {/* 도구/장비 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">도구/장비</label>
                <input
                  type="text"
                  value={editStep.tools_equipment || ''}
                  onChange={(e) => handleEditingChange(editPanelStepId, 'tools_equipment', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                  placeholder="예: 토크 렌치, 캘리퍼, Poka-Yoke 장치"
                />
              </div>

              {/* 소요시간 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">소요시간 (초)</label>
                <input
                  type="number" min={0}
                  value={editStep.estimated_time_sec || 0}
                  onChange={(e) => handleEditingChange(editPanelStepId, 'estimated_time_sec', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm"
                />
                <p className="mt-1 text-[11px] text-gray-400">
                  {editStep.estimated_time_sec >= 60
                    ? `= ${Math.floor(editStep.estimated_time_sec / 60)}분 ${editStep.estimated_time_sec % 60 ? editStep.estimated_time_sec % 60 + '초' : ''}`
                    : ''}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== PRINT LAYOUT ===== */}
      <div className="sop-print">
        <h2>작업표준서 (Standard Operating Procedure)</h2>

        {/* 문서 정보 */}
        <table className="info-table">
          <tbody>
            <tr>
              <td className="label">문서명</td>
              <td>{sop.name}</td>
              <td className="label">문서번호</td>
              <td>{sop.doc_number || '-'}</td>
              <td className="label">리비전</td>
              <td>Rev. {sop.revision}</td>
            </tr>
            <tr>
              <td className="label">제품명</td>
              <td>{product?.name || '-'}</td>
              <td className="label">Part No.</td>
              <td>{product?.part_number || product?.code || '-'}</td>
              <td className="label">작성일</td>
              <td>{new Date(sop.created_at).toLocaleDateString('ko-KR')}</td>
            </tr>
            <tr>
              <td className="label">고객사</td>
              <td>{product?.customer || '-'}</td>
              <td className="label">차종</td>
              <td>{product?.vehicle_model || '-'}</td>
              <td className="label">작성자</td>
              <td>{sop.author || '-'}</td>
            </tr>
          </tbody>
        </table>

        {/* 작업 단계 테이블 */}
        <table>
          <thead>
            <tr>
              <th style={{width: '4%'}}>No</th>
              <th style={{width: '10%'}}>공정단계<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Process Step</span></th>
              <th style={{width: '22%'}}>작업내용<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Action / Description</span></th>
              <th style={{width: '18%'}}>핵심 포인트<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Key Point</span></th>
              <th style={{width: '14%'}}>안전 주의사항<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Safety Note</span></th>
              <th style={{width: '14%'}}>품질 포인트<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Quality Point</span></th>
              <th style={{width: '10%'}}>도구/장비<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Tools</span></th>
              <th style={{width: '8%'}}>소요시간<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Time</span></th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => (
              <tr key={step.id}>
                <td className="c">{step.step_no}</td>
                <td>{step.process_step}</td>
                <td>{step.action || ''}</td>
                <td>{step.key_point || ''}</td>
                <td className="safety">{step.safety_note || ''}</td>
                <td>{step.quality_point || ''}</td>
                <td>{step.tools_equipment || ''}</td>
                <td className="c">{formatTime(step.estimated_time_sec)}</td>
              </tr>
            ))}
            {/* 합계 행 */}
            <tr>
              <td colSpan={7} style={{textAlign: 'right', fontWeight: 700}}>총 소요시간</td>
              <td className="c" style={{fontWeight: 700}}>{formatTime(totalTimeSec)}</td>
            </tr>
          </tbody>
        </table>

        {/* 비고 */}
        <div className="footer">
          <p>※ 작업표준서는 PFMEA 예방관리 항목을 Key Point에 반영하여야 합니다.</p>
          <p>※ Poka-Yoke 적용 항목은 품질 포인트에 확인 포인트로 명시합니다.</p>
          <p>※ 안전 관련 항목(PFMEA S≥8)은 안전 주의사항에 반드시 포함합니다.</p>
        </div>

        {/* 승인란 */}
        <table className="approval">
          <tbody>
            <tr>
              <td className="label">작성</td>
              <td className="label">검토</td>
              <td className="label">승인</td>
            </tr>
            <tr>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
