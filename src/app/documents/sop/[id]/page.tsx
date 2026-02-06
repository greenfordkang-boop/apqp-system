'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { sopStore, controlPlanStore, productStore } from '@/lib/store';
import type { Sop, SopStep } from '@/lib/store';

interface EditingStep extends SopStep {
  isEditing?: boolean;
}

export default function SopViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sopId } = use(params);

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [sop, setSop] = useState<Sop | null>(null);
  const [steps, setSteps] = useState<EditingStep[]>([]);
  const [productName, setProductName] = useState<string>('');
  const [editMode, setEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (sopId) {
      fetchSop();
    }
  }, [sopId]);

  async function fetchSop() {
    setLoading(true);
    try {
      const sopData = await sopStore.getById(sopId);
      if (sopData) {
        setSop(sopData);

        const stepsData = await sopStore.getSteps(sopId);
        setSteps(stepsData.map((step) => ({ ...step, isEditing: false })));

        if (sopData.product_id) {
          const productData = await productStore.getById(sopData.product_id);
          if (productData) {
            setProductName(productData.name);
          }
        }
      }
    } catch (err) {
      console.error('Error fetching SOP:', err);
    }
    setLoading(false);
  }

  const handleEditClick = (stepId: string) => {
    setSteps(
      steps.map((step) =>
        step.id === stepId ? { ...step, isEditing: true } : step
      )
    );
  };

  const handleEditChange = (
    stepId: string,
    field: keyof SopStep,
    value: any
  ) => {
    setSteps(
      steps.map((step) =>
        step.id === stepId ? { ...step, [field]: value } : step
      )
    );
  };

  const handleSave = async (stepId: string) => {
    setIsSaving(true);
    try {
      const step = steps.find((s) => s.id === stepId);
      if (step) {
        await sopStore.updateStep(stepId, {
          process_step: step.process_step,
          action: step.action,
          key_point: step.key_point,
          safety_note: step.safety_note,
          quality_point: step.quality_point,
          tools_equipment: step.tools_equipment,
          estimated_time_sec: step.estimated_time_sec,
        });

        setSteps(
          steps.map((s) =>
            s.id === stepId ? { ...s, isEditing: false } : s
          )
        );
      }
    } catch (err) {
      console.error('Error saving step:', err);
    }
    setIsSaving(false);
  };

  const handleCancel = async (stepId: string) => {
    setSteps(
      steps.map((step) =>
        step.id === stepId ? { ...step, isEditing: false } : step
      )
    );
    await fetchSop();
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

  const getStatusBadge = (status: string) => {
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

  if (!sop) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4 font-medium">작업표준서를 찾을 수 없습니다</p>
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

  const canEdit = sop.status !== 'approved';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg print:hidden">
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
              {!editMode && (
                <>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    PDF 다운로드
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => setEditMode(true)}
                      className="px-4 py-2 bg-white text-orange-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      편집
                    </button>
                  )}
                </>
              )}
              {editMode && (
                <button
                  onClick={() => setEditMode(false)}
                  className="px-4 py-2 bg-white text-orange-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
                >
                  완료
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">작업표준서 (SOP)</h1>
              {productName && (
                <p className="text-white/80 text-sm">{productName}</p>
              )}
            </div>
            {getStatusBadge(sop.status)}
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
              <p className="text-gray-900 font-semibold">{sop.name}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">리비전</p>
              <p className="text-gray-900 font-semibold">Rev. {sop.revision}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">작성 날짜</p>
              <p className="text-gray-900 font-semibold">
                {new Date(sop.created_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>
        </div>

        {/* Status Actions */}
        {editMode && (
          <div className="bg-yellow-50/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-yellow-200/50 mb-8 print:hidden">
            <p className="text-yellow-900 text-sm font-medium mb-4">편집 모드</p>
            <p className="text-yellow-700 text-sm">테이블의 항목을 수정한 후 각 행의 저장 버튼을 클릭하세요.</p>
          </div>
        )}

        {!editMode && sop.status === 'draft' && (
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

        {!editMode && sop.status === 'review' && (
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

        {!editMode && sop.status === 'approved' && (
          <div className="bg-green-50/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-green-200/50 mb-8 print:hidden flex items-center justify-between">
            <div>
              <p className="text-green-900 font-medium mb-1">승인 완료</p>
              <p className="text-green-700 text-sm">이 문서를 수정하려면 아래 버튼을 클릭하세요.</p>
            </div>
            <button
              onClick={() => {
                handleStatusChange('draft');
                setEditMode(true);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
            >
              수정하기
            </button>
          </div>
        )}

        {/* SOP Steps Table */}
        <div className="bg-white/70 backdrop-blur rounded-2xl shadow-sm border border-white/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">작업 단계</h2>
            <p className="text-sm text-gray-500 mt-1">{steps.length}개의 작업 단계</p>
          </div>

          {steps.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 text-sm">작업 단계가 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">공정단계</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">작업내용</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">핵심 포인트</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">안전 주의사항</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">품질 포인트</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">도구/장비</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">소요시간(초)</th>
                    {editMode && (
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 print:hidden">
                        작업
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {steps.map((step, idx) => (
                    <tr
                      key={step.id}
                      className={`hover:bg-gray-50/50 transition-colors ${
                        step.isEditing ? 'bg-yellow-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-600 font-medium">{step.step_no}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium text-xs">
                        {editMode && step.isEditing ? (
                          <input
                            type="text"
                            value={step.process_step}
                            onChange={(e) =>
                              handleEditChange(step.id, 'process_step', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          step.process_step
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode && step.isEditing ? (
                          <textarea
                            value={step.action}
                            onChange={(e) =>
                              handleEditChange(step.id, 'action', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            rows={2}
                          />
                        ) : (
                          <span className="text-gray-900 text-xs">{step.action}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode && step.isEditing ? (
                          <textarea
                            value={step.key_point || ''}
                            onChange={(e) =>
                              handleEditChange(step.id, 'key_point', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            rows={2}
                          />
                        ) : (
                          <span className="text-gray-700 text-xs">{step.key_point || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode && step.isEditing ? (
                          <textarea
                            value={step.safety_note || ''}
                            onChange={(e) =>
                              handleEditChange(step.id, 'safety_note', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            rows={2}
                          />
                        ) : (
                          <span className="text-gray-700 text-xs">{step.safety_note || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode && step.isEditing ? (
                          <textarea
                            value={step.quality_point || ''}
                            onChange={(e) =>
                              handleEditChange(step.id, 'quality_point', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                            rows={2}
                          />
                        ) : (
                          <span className="text-gray-700 text-xs">{step.quality_point || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode && step.isEditing ? (
                          <input
                            type="text"
                            value={step.tools_equipment || ''}
                            onChange={(e) =>
                              handleEditChange(step.id, 'tools_equipment', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <span className="text-gray-700 text-xs">{step.tools_equipment || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editMode && step.isEditing ? (
                          <input
                            type="number"
                            value={step.estimated_time_sec || 0}
                            onChange={(e) =>
                              handleEditChange(step.id, 'estimated_time_sec', parseInt(e.target.value))
                            }
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-xs text-right"
                          />
                        ) : (
                          <span className="text-gray-700 text-xs">{step.estimated_time_sec || '-'}</span>
                        )}
                      </td>
                      {editMode && (
                        <td className="px-4 py-3 text-center print:hidden">
                          {step.isEditing ? (
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleSave(step.id)}
                                disabled={isSaving}
                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                              >
                                저장
                              </button>
                              <button
                                onClick={() => handleCancel(step.id)}
                                className="px-2 py-1 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded text-xs font-medium transition-colors"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditClick(step.id)}
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
