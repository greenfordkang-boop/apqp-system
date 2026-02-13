'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { inspectionStore, productStore, characteristicStore } from '@/lib/store';
import type { InspectionStandard, InspectionItem, Product, Characteristic } from '@/lib/store';

type EditingItem = InspectionItem;

export default function InspectionViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: inspId } = use(params);

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [inspection, setInspection] = useState<InspectionStandard | null>(null);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingItems, setEditingItems] = useState<Map<string, EditingItem>>(new Map());
  const [editPanelItemId, setEditPanelItemId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (inspId) fetchData();
  }, [inspId]);

  async function fetchData() {
    setLoading(true);
    try {
      const inspectionData = await inspectionStore.getById(inspId);
      if (!inspectionData) { setLoading(false); return; }
      setInspection(inspectionData);

      if (inspectionData.product_id) {
        const [productData, chars] = await Promise.all([
          productStore.getById(inspectionData.product_id),
          characteristicStore.getByProductId(inspectionData.product_id),
        ]);
        if (productData) setProduct(productData);
        setCharacteristics(chars);
      }

      const itemsData = await inspectionStore.getItems(inspId);
      setItems(itemsData);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  }

  // --- 편집 모드 ---
  const handleEditModeToggle = () => {
    if (inspection?.status === 'approved') return;
    setIsEditMode(true);
    const newMap = new Map<string, EditingItem>();
    items.forEach((item) => { newMap.set(item.id, { ...item }); });
    setEditingItems(newMap);
  };

  const handleEditingChange = (itemId: string, field: string, value: string | number | null) => {
    const current = editingItems.get(itemId);
    if (!current) return;
    editingItems.set(itemId, { ...current, [field]: value });
    setEditingItems(new Map(editingItems));
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      for (const [itemId, itemData] of editingItems) {
        await inspectionStore.updateItem(itemId, {
          inspection_item_name: itemData.inspection_item_name,
          specification: itemData.specification,
          lsl: itemData.lsl,
          usl: itemData.usl,
          unit: itemData.unit,
          inspection_method: itemData.inspection_method,
          measurement_tool: itemData.measurement_tool,
          sample_size: itemData.sample_size,
          frequency: itemData.frequency,
          acceptance_criteria: itemData.acceptance_criteria,
          ng_handling: itemData.ng_handling,
          inspection_type: itemData.inspection_type,
        });
      }
      await fetchData();
      setIsEditMode(false);
      setEditingItems(new Map());
      setEditPanelItemId(null);
    } catch (err) {
      console.error('Error saving:', err);
    }
    setIsSaving(false);
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditingItems(new Map());
    setEditPanelItemId(null);
  };

  const handleStatusChange = async (newStatus: 'draft' | 'review' | 'approved') => {
    if (!inspection) return;
    try {
      await inspectionStore.updateStatus(inspId, newStatus);
      setInspection({ ...inspection, status: newStatus });
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handlePrint = () => {
    const prevTitle = document.title;
    const date = inspection ? new Date(inspection.created_at).toISOString().slice(0, 10).replace(/-/g, '') : '';
    const parts = ['검사기준서', product?.customer, product?.vehicle_model, product?.name, product?.part_number || product?.code, date].filter(Boolean);
    document.title = parts.join('_');
    window.print();
    document.title = prevTitle;
  };

  // --- 헬퍼 ---
  const getChar = (charId: string) => characteristics.find((c) => c.id === charId);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">승인됨</span>;
      case 'review': return <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">검토중</span>;
      default: return <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">초안</span>;
    }
  };

  const inspTypeLabel = (type: string) => {
    const map: Record<string, string> = { incoming: '수입검사', 'in-process': '공정검사', final: '최종검사', outgoing: '출하검사' };
    return map[type] || type;
  };

  const inspTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      incoming: 'bg-blue-100 text-blue-700',
      'in-process': 'bg-orange-100 text-orange-700',
      final: 'bg-purple-100 text-purple-700',
      outgoing: 'bg-green-100 text-green-700',
    };
    return <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[type] || 'bg-gray-100 text-gray-700'}`}>{inspTypeLabel(type)}</span>;
  };

  // --- 편집 패널 ---
  const editItem = editPanelItemId ? editingItems.get(editPanelItemId) : null;
  const editItemIdx = editPanelItemId ? items.findIndex((i) => i.id === editPanelItemId) : -1;
  const canGoPrev = editItemIdx > 0;
  const canGoNext = editItemIdx >= 0 && editItemIdx < items.length - 1;

  if (!mounted) return <div className="min-h-screen" />;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-gray-500 text-sm font-medium">로딩 중...</div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4 font-medium">검사기준서를 찾을 수 없습니다</p>
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
          .insp-screen { display: none !important; }
          .insp-print { display: block !important; }
          body { background: white !important; margin: 0; padding: 0; }
          @page { size: A4 landscape; margin: 8mm; }
        }
        .insp-print { display: none; }
        .insp-print table { border-collapse: collapse; width: 100%; }
        .insp-print th, .insp-print td { border: 1px solid #333; padding: 4px 6px; font-size: 9px; vertical-align: middle; }
        .insp-print th { background: #e8e8e8 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 700; text-align: center; }
        .insp-print .c { text-align: center; }
        .insp-print .info-table { margin-bottom: 6px; }
        .insp-print .info-table td { border: 1px solid #333; padding: 3px 6px; font-size: 9px; }
        .insp-print .info-table .label { background: #f0f0f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-weight: 600; width: 80px; text-align: center; }
        .insp-print h2 { font-size: 16px; font-weight: 700; text-align: center; margin: 0 0 6px; padding-bottom: 4px; border-bottom: 2px solid #333; }
        .insp-print .badge { display: inline-block; padding: 1px 5px; border: 1px solid #666; border-radius: 3px; font-size: 8px; font-weight: 600; }
        .insp-print .footer { margin-top: 8px; font-size: 8px; color: #666; }
        .insp-print .approval { margin-top: 10px; }
        .insp-print .approval td { height: 30px; width: 80px; text-align: center; }
      `}</style>

      {/* ===== SCREEN ===== */}
      <div className="insp-screen">
        {/* Header */}
        <header className="bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg">
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
                    {inspection.status !== 'approved' && (
                      <button onClick={handleEditModeToggle} className="px-4 py-2 bg-white text-pink-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors">
                        편집
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={handleCancel} className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
                      취소
                    </button>
                    <button onClick={handleSaveAll} disabled={isSaving} className="px-4 py-2 bg-white text-pink-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
                      {isSaving ? '저장 중...' : '전체 저장'}
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">검사기준서</h1>
                {product && <p className="text-white/80 text-sm">{product.name} {product.code && `(${product.code})`}</p>}
              </div>
              {getStatusBadge(inspection.status)}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* 요약 */}
          <div className="bg-white/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-white/50 mb-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div><p className="text-gray-500 text-xs mb-1">문서명</p><p className="text-gray-900 font-semibold text-sm">{inspection.name}</p></div>
              <div><p className="text-gray-500 text-xs mb-1">리비전</p><p className="text-gray-900 font-semibold text-sm">Rev. {inspection.revision}</p></div>
              <div><p className="text-gray-500 text-xs mb-1">검사항목 수</p><p className="text-gray-900 font-semibold text-sm">{items.length}건</p></div>
              <div><p className="text-gray-500 text-xs mb-1">작성일</p><p className="text-gray-900 font-semibold text-sm">{new Date(inspection.created_at).toLocaleDateString('ko-KR')}</p></div>
            </div>
          </div>

          {/* 상태 액션 */}
          {!isEditMode && inspection.status === 'draft' && (
            <div className="bg-blue-50/70 backdrop-blur rounded-2xl shadow-sm p-5 border border-blue-200/50 mb-8 flex items-center justify-between">
              <div><p className="text-blue-900 font-medium text-sm">검토 준비 완료?</p><p className="text-blue-700 text-xs mt-0.5">검토 요청을 통해 담당자의 검토를 요청할 수 있습니다.</p></div>
              <button onClick={() => handleStatusChange('review')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">검토 요청</button>
            </div>
          )}
          {!isEditMode && inspection.status === 'review' && (
            <div className="bg-yellow-50/70 backdrop-blur rounded-2xl shadow-sm p-5 border border-yellow-200/50 mb-8 flex items-center justify-between">
              <div><p className="text-yellow-900 font-medium text-sm">검토 중입니다</p></div>
              <div className="flex gap-3">
                <button onClick={() => handleStatusChange('draft')} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors">초안으로</button>
                <button onClick={() => handleStatusChange('approved')} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">승인</button>
              </div>
            </div>
          )}
          {!isEditMode && inspection.status === 'approved' && (
            <div className="bg-green-50/70 backdrop-blur rounded-2xl shadow-sm p-5 border border-green-200/50 mb-8 flex items-center justify-between">
              <div><p className="text-green-900 font-medium text-sm">승인 완료</p></div>
              <button onClick={() => { handleStatusChange('draft'); setIsEditMode(true); }} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">수정하기</button>
            </div>
          )}

          {/* 검사 항목 테이블 */}
          <div className="bg-white/70 backdrop-blur rounded-2xl shadow-sm border border-white/50 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">검사 항목</h2>
              <p className="text-sm text-gray-500 mt-1">{items.length}개의 검사 항목 {isEditMode && '• 행을 클릭하여 편집'}</p>
            </div>

            {items.length === 0 ? (
              <div className="p-12 text-center"><p className="text-gray-500 text-sm">검사 항목이 없습니다</p></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50/50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700 w-12">No</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">검사항목</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">규격</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700">검사유형</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">검사방법</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">측정도구</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700">샘플</th>
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700">주기</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">합격기준</th>
                      <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">부적합 처리</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {items.map((item, idx) => {
                      const displayItem = (isEditMode ? editingItems.get(item.id) : null) || item;
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-gray-50/50 transition-colors ${isEditMode ? 'cursor-pointer' : ''} ${editPanelItemId === item.id ? 'bg-pink-50/50' : ''}`}
                          onClick={() => { if (isEditMode) setEditPanelItemId(item.id); }}
                        >
                          <td className="px-3 py-3 text-center text-gray-500 font-medium">{item.item_no}</td>
                          <td className="px-3 py-3 text-gray-900 font-medium text-xs">{displayItem.inspection_item_name}</td>
                          <td className="px-3 py-3 text-xs text-gray-700">
                            {displayItem.specification || '-'}
                            {(displayItem.lsl != null || displayItem.usl != null) && (
                              <span className="ml-1 text-gray-400">
                                ({displayItem.lsl ?? ''}~{displayItem.usl ?? ''}{displayItem.unit ? ` ${displayItem.unit}` : ''})
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">{inspTypeBadge(displayItem.inspection_type)}</td>
                          <td className="px-3 py-3 text-xs text-gray-700">{displayItem.inspection_method || '-'}</td>
                          <td className="px-3 py-3 text-xs text-gray-700">{displayItem.measurement_tool || '-'}</td>
                          <td className="px-3 py-3 text-center text-xs text-gray-600">{displayItem.sample_size || '-'}</td>
                          <td className="px-3 py-3 text-center text-xs text-gray-600">{displayItem.frequency || '-'}</td>
                          <td className="px-3 py-3 text-xs text-gray-700">{displayItem.acceptance_criteria || '-'}</td>
                          <td className="px-3 py-3 text-xs text-gray-700">{displayItem.ng_handling || '-'}</td>
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
        {isEditMode && editPanelItemId && editItem && (
          <div className="fixed top-0 right-0 h-full w-[420px] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
            {/* 패널 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { if (canGoPrev) setEditPanelItemId(items[editItemIdx - 1].id); }}
                  disabled={!canGoPrev}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ▲
                </button>
                <button
                  onClick={() => { if (canGoNext) setEditPanelItemId(items[editItemIdx + 1].id); }}
                  disabled={!canGoNext}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ▼
                </button>
                <span className="text-sm font-semibold text-gray-700">
                  항목 {editItemIdx + 1} / {items.length}
                </span>
              </div>
              <button onClick={() => setEditPanelItemId(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {/* 패널 본문 */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* 특성 참조 정보 */}
              {(() => {
                const char = getChar(editItem.characteristic_id);
                if (!char) return null;
                return (
                  <div className="bg-pink-50 rounded-xl p-4">
                    <label className="block text-xs font-semibold text-pink-600 mb-2">연결된 특성 (참조)</label>
                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                      <div><span className="text-gray-400">특성명:</span> {char.name}</div>
                      <div><span className="text-gray-400">유형:</span> {char.type === 'product' ? '제품' : '공정'}</div>
                      <div><span className="text-gray-400">등급:</span> {char.category === 'critical' ? 'CC(중요)' : char.category === 'major' ? 'SC(주요)' : '일반'}</div>
                      <div><span className="text-gray-400">측정:</span> {char.measurement_method || '-'}</div>
                    </div>
                  </div>
                );
              })()}

              {/* 검사항목명 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">검사항목명</label>
                <input
                  type="text"
                  value={editItem.inspection_item_name}
                  onChange={(e) => handleEditingChange(editPanelItemId, 'inspection_item_name', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                />
              </div>

              {/* 규격 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">규격/시방</label>
                <input
                  type="text"
                  value={editItem.specification || ''}
                  onChange={(e) => handleEditingChange(editPanelItemId, 'specification', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                  placeholder="규격 내용 (예: 10.0 ± 0.1)"
                />
              </div>

              {/* LSL / USL / 단위 */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">하한 (LSL)</label>
                  <input
                    type="number" step="any"
                    value={editItem.lsl ?? ''}
                    onChange={(e) => handleEditingChange(editPanelItemId, 'lsl', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">상한 (USL)</label>
                  <input
                    type="number" step="any"
                    value={editItem.usl ?? ''}
                    onChange={(e) => handleEditingChange(editPanelItemId, 'usl', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">단위</label>
                  <input
                    type="text"
                    value={editItem.unit || ''}
                    onChange={(e) => handleEditingChange(editPanelItemId, 'unit', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-center focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="mm"
                  />
                </div>
              </div>

              {/* 검사유형 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">검사유형</label>
                <div className="flex gap-2">
                  {([
                    { value: 'incoming', label: '수입검사' },
                    { value: 'in-process', label: '공정검사' },
                    { value: 'final', label: '최종검사' },
                    { value: 'outgoing', label: '출하검사' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleEditingChange(editPanelItemId, 'inspection_type', opt.value)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${
                        editItem.inspection_type === opt.value
                          ? 'bg-pink-100 border-pink-400 text-pink-700'
                          : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 검사방법 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">검사방법</label>
                <input
                  type="text"
                  value={editItem.inspection_method || ''}
                  onChange={(e) => handleEditingChange(editPanelItemId, 'inspection_method', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                  placeholder="예: 캘리퍼 측정, 육안검사"
                />
              </div>

              {/* 측정도구 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">측정도구</label>
                <input
                  type="text"
                  value={editItem.measurement_tool || ''}
                  onChange={(e) => handleEditingChange(editPanelItemId, 'measurement_tool', e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                  placeholder="예: 디지털 캘리퍼, 토크 렌치"
                />
              </div>

              {/* 샘플 크기 / 주기 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">샘플 크기</label>
                  <input
                    type="text"
                    value={editItem.sample_size || ''}
                    onChange={(e) => handleEditingChange(editPanelItemId, 'sample_size', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="예: 5ea, 전수"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">검사 주기</label>
                  <input
                    type="text"
                    value={editItem.frequency || ''}
                    onChange={(e) => handleEditingChange(editPanelItemId, 'frequency', e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="예: 매 로트, 매 시간"
                  />
                </div>
              </div>

              {/* 합격기준 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">합격기준</label>
                <textarea
                  value={editItem.acceptance_criteria || ''}
                  onChange={(e) => handleEditingChange(editPanelItemId, 'acceptance_criteria', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                  placeholder="합격/불합격 판정 기준"
                />
              </div>

              {/* 부적합 처리 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">부적합 처리</label>
                <textarea
                  value={editItem.ng_handling || ''}
                  onChange={(e) => handleEditingChange(editPanelItemId, 'ng_handling', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent text-sm"
                  placeholder="부적합 발생 시 처리 방법"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== PRINT LAYOUT ===== */}
      <div className="insp-print">
        <h2>검사기준서 (Inspection Standard)</h2>

        {/* 문서 정보 */}
        <table className="info-table">
          <tbody>
            <tr>
              <td className="label">문서명</td>
              <td>{inspection.name}</td>
              <td className="label">문서번호</td>
              <td>{inspection.doc_number || '-'}</td>
              <td className="label">리비전</td>
              <td>Rev. {inspection.revision}</td>
            </tr>
            <tr>
              <td className="label">제품명</td>
              <td>{product?.name || '-'}</td>
              <td className="label">Part No.</td>
              <td>{product?.part_number || product?.code || '-'}</td>
              <td className="label">작성일</td>
              <td>{new Date(inspection.created_at).toLocaleDateString('ko-KR')}</td>
            </tr>
            <tr>
              <td className="label">고객사</td>
              <td>{product?.customer || '-'}</td>
              <td className="label">차종</td>
              <td>{product?.vehicle_model || '-'}</td>
              <td className="label">작성자</td>
              <td>{inspection.author || '-'}</td>
            </tr>
          </tbody>
        </table>

        {/* 검사항목 테이블 */}
        <table>
          <thead>
            <tr>
              <th style={{width: '4%'}}>No</th>
              <th style={{width: '12%'}}>검사항목<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Inspection Item</span></th>
              <th style={{width: '10%'}}>규격/시방<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Specification</span></th>
              <th style={{width: '5%'}}>LSL</th>
              <th style={{width: '5%'}}>USL</th>
              <th style={{width: '4%'}}>단위</th>
              <th style={{width: '7%'}}>검사유형<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Type</span></th>
              <th style={{width: '12%'}}>검사방법<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Method</span></th>
              <th style={{width: '10%'}}>측정도구<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Tool</span></th>
              <th style={{width: '5%'}}>샘플<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Size</span></th>
              <th style={{width: '5%'}}>주기<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Freq.</span></th>
              <th style={{width: '10%'}}>합격기준<br/><span style={{fontWeight: 400, fontSize: '8px'}}>Acceptance</span></th>
              <th style={{width: '11%'}}>부적합 처리<br/><span style={{fontWeight: 400, fontSize: '8px'}}>NG Handling</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className="c">{item.item_no}</td>
                <td>{item.inspection_item_name}</td>
                <td>{item.specification || ''}</td>
                <td className="c">{item.lsl ?? ''}</td>
                <td className="c">{item.usl ?? ''}</td>
                <td className="c">{item.unit || ''}</td>
                <td className="c">{inspTypeLabel(item.inspection_type)}</td>
                <td>{item.inspection_method || ''}</td>
                <td>{item.measurement_tool || ''}</td>
                <td className="c">{item.sample_size || ''}</td>
                <td className="c">{item.frequency || ''}</td>
                <td>{item.acceptance_criteria || ''}</td>
                <td>{item.ng_handling || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 비고 */}
        <div className="footer">
          <p>※ 검사기준서는 관리계획서(Control Plan) 및 PFMEA 검출관리 항목과 연계됩니다.</p>
          <p>※ 특별특성(CC/SC) 항목의 검사 주기/방법은 PFMEA 검출관리와 일치하여야 합니다.</p>
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
