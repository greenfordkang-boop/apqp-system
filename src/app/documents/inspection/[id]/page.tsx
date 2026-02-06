'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { inspectionStore, controlPlanStore, productStore, characteristicStore } from '@/lib/store';
import type { InspectionStandard, InspectionItem } from '@/lib/store';

interface EditingItem extends InspectionItem {
  isEditing?: boolean;
}

export default function InspectionViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: inspId } = use(params);

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [inspection, setInspection] = useState<InspectionStandard | null>(null);
  const [items, setItems] = useState<EditingItem[]>([]);
  const [product, setProduct] = useState<any>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (inspId) {
      fetchData();
    }
  }, [inspId]);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch inspection standard
      const inspectionData = await inspectionStore.getById(inspId);
      if (!inspectionData) {
        setLoading(false);
        return;
      }
      setInspection(inspectionData);

      // Fetch product
      if (inspectionData.product_id) {
        const productData = await productStore.getById(inspectionData.product_id);
        if (productData) {
          setProduct(productData);
        }
      }

      // Fetch inspection items
      const itemsData = await inspectionStore.getItems(inspId);
      setItems(
        itemsData.map((item: InspectionItem) => ({
          ...item,
          isEditing: false,
        }))
      );
    } catch (err) {
      console.error('Error fetching data:', err);
    }
    setLoading(false);
  }

  const handleEditStart = (itemId: string) => {
    if (inspection?.status !== 'approved') {
      setIsEditMode(true);
      setItems(
        items.map((item) =>
          item.id === itemId ? { ...item, isEditing: true } : item
        )
      );
    }
  };

  const handleCellChange = (itemId: string, field: keyof InspectionItem, value: any) => {
    setItems(
      items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const handleSave = async (itemId: string) => {
    setIsSaving(true);
    try {
      const item = items.find((i) => i.id === itemId);
      if (item) {
        await inspectionStore.updateItem(itemId, {
          inspection_item_name: item.inspection_item_name,
          specification: item.specification,
          lsl: item.lsl,
          usl: item.usl,
          unit: item.unit,
          inspection_method: item.inspection_method,
          measurement_tool: item.measurement_tool,
          sample_size: item.sample_size,
          frequency: item.frequency,
          acceptance_criteria: item.acceptance_criteria,
          ng_handling: item.ng_handling,
          inspection_type: item.inspection_type,
        });

        setItems(
          items.map((i) =>
            i.id === itemId ? { ...i, isEditing: false } : i
          )
        );
      }
    } catch (err) {
      console.error('Error saving item:', err);
    }
    setIsSaving(false);
  };

  const handleCancel = async (itemId: string) => {
    setItems(
      items.map((item) =>
        item.id === itemId ? { ...item, isEditing: false } : item
      )
    );
    await fetchData();
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

  const getStatusBadge = (status: 'draft' | 'review' | 'approved') => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
            승인됨
          </span>
        );
      case 'review':
        return (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
            검토중
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded-full">
            초안
          </span>
        );
    }
  };

  const getInspectionTypeBadge = (type: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      incoming: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        label: '수입검사',
      },
      'in-process': {
        bg: 'bg-orange-100',
        text: 'text-orange-700',
        label: '공정검사',
      },
      final: {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        label: '최종검사',
      },
      outgoing: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        label: '출하검사',
      },
    };

    const badge = badges[type] || {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      label: type,
    };
    return (
      <span className={`px-2 py-1 ${badge.bg} ${badge.text} text-xs font-medium rounded`}>
        {badge.label}
      </span>
    );
  };

  if (!mounted) {
    return <div className="min-h-screen" />;
  }

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
          <Link
            href="/documents/generate"
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            ← 문서 생성 페이지로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const canEdit = inspection.status !== 'approved';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-pink-500 to-pink-600 text-white shadow-lg print:hidden">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Link
                href="/documents/generate"
                className="text-white/70 hover:text-white transition-colors text-sm"
              >
                ← 돌아가기
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {!isEditMode && (
                <>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    PDF 다운로드
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => setIsEditMode(true)}
                      className="px-4 py-2 bg-white text-pink-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      편집
                    </button>
                  )}
                </>
              )}
              {isEditMode && (
                <button
                  onClick={() => setIsEditMode(false)}
                  className="px-4 py-2 bg-white text-pink-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
                >
                  완료
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">검사기준서</h1>
              {product && (
                <p className="text-white/80 text-sm">
                  {product.name} {product.code && `(${product.code})`}
                </p>
              )}
            </div>
            {getStatusBadge(inspection.status)}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Summary Card */}
        <div className="bg-white/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-white/50 mb-8 print:mb-6">
          <div className="grid grid-cols-3 gap-8 mb-6 print:grid-cols-2 print:gap-4">
            <div>
              <p className="text-gray-500 text-sm mb-1">문서명</p>
              <p className="text-gray-900 font-semibold">{inspection.name}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">리비전</p>
              <p className="text-gray-900 font-semibold">Rev. {inspection.revision}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">작성 날짜</p>
              <p className="text-gray-900 font-semibold">
                {new Date(inspection.created_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>
        </div>

        {/* Status Actions */}
        {isEditMode && (
          <div className="bg-yellow-50/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-yellow-200/50 mb-8 print:hidden">
            <p className="text-yellow-900 text-sm font-medium mb-4">편집 모드</p>
            <p className="text-yellow-700 text-sm">테이블의 항목을 수정한 후 각 행의 저장 버튼을 클릭하세요.</p>
          </div>
        )}

        {!isEditMode && inspection.status === 'draft' && (
          <div className="bg-blue-50/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-blue-200/50 mb-8 print:hidden flex items-center justify-between">
            <div>
              <p className="text-blue-900 font-medium mb-1">검토 준비 완료?</p>
              <p className="text-blue-700 text-sm">검토 요청을 통해 담당자의 검토를 요청할 수 있습니다.</p>
            </div>
            <button
              onClick={() => handleStatusChange('review')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              검토 요청
            </button>
          </div>
        )}

        {!isEditMode && inspection.status === 'review' && (
          <div className="bg-yellow-50/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-yellow-200/50 mb-8 print:hidden flex items-center justify-between">
            <div>
              <p className="text-yellow-900 font-medium mb-1">검토 중입니다</p>
              <p className="text-yellow-700 text-sm">승인 또는 초안으로 되돌릴 수 있습니다.</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleStatusChange('draft')}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg text-sm font-medium transition-colors"
              >
                초안으로
              </button>
              <button
                onClick={() => handleStatusChange('approved')}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                승인
              </button>
            </div>
          </div>
        )}

        {!isEditMode && inspection.status === 'approved' && (
          <div className="bg-green-50/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-green-200/50 mb-8 print:hidden flex items-center justify-between">
            <div>
              <p className="text-green-900 font-medium mb-1">승인 완료</p>
              <p className="text-green-700 text-sm">이 문서를 수정하려면 아래 버튼을 클릭하세요.</p>
            </div>
            <button
              onClick={() => {
                handleStatusChange('draft');
                setIsEditMode(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              수정하기
            </button>
          </div>
        )}

        {/* Inspection Items Table */}
        <div className="bg-white/70 backdrop-blur rounded-2xl shadow-sm border border-white/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">검사 항목</h2>
            <p className="text-sm text-gray-500 mt-1">{items.length}개의 검사 항목</p>
          </div>

          {items.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 text-sm">검사 항목이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">검사항목</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">규격</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">검사유형</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">검사방법</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">측정도구</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">샘플크기</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">주기</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">합격기준</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">부적합 처리</th>
                    {isEditMode && (
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 print:hidden">
                        작업
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, idx) => (
                    <tr
                      key={item.id}
                      className={`hover:bg-gray-50/50 transition-colors ${
                        item.isEditing ? 'bg-yellow-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-600 font-medium">{item.item_no}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium text-xs">
                        {isEditMode && item.isEditing ? (
                          <input
                            type="text"
                            value={item.inspection_item_name}
                            onChange={(e) =>
                              handleCellChange(item.id, 'inspection_item_name', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          item.inspection_item_name
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {isEditMode && item.isEditing ? (
                          <input
                            type="text"
                            value={item.specification || ''}
                            onChange={(e) =>
                              handleCellChange(item.id, 'specification', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <span className="text-gray-700">{item.specification || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditMode && item.isEditing ? (
                          <select
                            value={item.inspection_type || ''}
                            onChange={(e) =>
                              handleCellChange(item.id, 'inspection_type', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            <option value="incoming">수입검사</option>
                            <option value="in-process">공정검사</option>
                            <option value="final">최종검사</option>
                            <option value="outgoing">출하검사</option>
                          </select>
                        ) : (
                          getInspectionTypeBadge(item.inspection_type)
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {isEditMode && item.isEditing ? (
                          <input
                            type="text"
                            value={item.inspection_method || ''}
                            onChange={(e) =>
                              handleCellChange(item.id, 'inspection_method', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <span className="text-gray-700">{item.inspection_method || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {isEditMode && item.isEditing ? (
                          <input
                            type="text"
                            value={item.measurement_tool || ''}
                            onChange={(e) =>
                              handleCellChange(item.id, 'measurement_tool', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <span className="text-gray-700">{item.measurement_tool || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditMode && item.isEditing ? (
                          <input
                            type="text"
                            value={item.sample_size || ''}
                            onChange={(e) =>
                              handleCellChange(item.id, 'sample_size', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <span className="text-gray-600 text-xs">{item.sample_size || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isEditMode && item.isEditing ? (
                          <input
                            type="text"
                            value={item.frequency || ''}
                            onChange={(e) =>
                              handleCellChange(item.id, 'frequency', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-center"
                          />
                        ) : (
                          <span className="text-gray-600 text-xs">{item.frequency || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {isEditMode && item.isEditing ? (
                          <input
                            type="text"
                            value={item.acceptance_criteria || ''}
                            onChange={(e) =>
                              handleCellChange(item.id, 'acceptance_criteria', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <span className="text-gray-700">{item.acceptance_criteria || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {isEditMode && item.isEditing ? (
                          <input
                            type="text"
                            value={item.ng_handling || ''}
                            onChange={(e) =>
                              handleCellChange(item.id, 'ng_handling', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <span className="text-gray-700">{item.ng_handling || '-'}</span>
                        )}
                      </td>
                      {isEditMode && (
                        <td className="px-4 py-3 text-center print:hidden">
                          {item.isEditing ? (
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleSave(item.id)}
                                disabled={isSaving}
                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                              >
                                저장
                              </button>
                              <button
                                onClick={() => handleCancel(item.id)}
                                className="px-2 py-1 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded text-xs font-medium transition-colors"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditStart(item.id)}
                              className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-xs font-medium transition-colors"
                            >
                              편집
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Print Styles */}
      <style jsx>{`
        @media print {
          .print\:hidden {
            display: none !important;
          }
          header {
            display: none !important;
          }
          main {
            padding: 0 !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}
