'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { controlPlanStore, characteristicStore, productStore, pfmeaStore } from '@/lib/store';
import type { ControlPlan, ControlPlanItem, Characteristic } from '@/lib/store';

interface EditingLine extends ControlPlanItem {
  isEditing?: boolean;
}

export default function ControlPlanViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: cpId } = use(params);

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [controlPlan, setControlPlan] = useState<ControlPlan | null>(null);
  const [lines, setLines] = useState<EditingLine[]>([]);
  const [product, setProduct] = useState<any>(null);
  const [pfmea, setPfmea] = useState<any>(null);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (cpId) {
      fetchControlPlan();
    }
  }, [cpId]);

  async function fetchControlPlan() {
    setLoading(true);
    try {
      const cpData = await controlPlanStore.getById(cpId);
      if (!cpData) {
        setLoading(false);
        return;
      }

      setControlPlan(cpData);

      const pfmeaData = await pfmeaStore.getHeaderById(cpData.pfmea_id);
      if (pfmeaData) {
        setPfmea(pfmeaData);

        const productData = await productStore.getById(pfmeaData.product_id);
        if (productData) {
          setProduct(productData);
          const chars = await characteristicStore.getByProductId(productData.id);
          setCharacteristics(chars);
        }
      }

      const linesData = await controlPlanStore.getItems(cpId);
      setLines(
        linesData.map((line: ControlPlanItem) => ({
          ...line,
          isEditing: false,
        }))
      );
    } catch (err) {
      console.error('Error fetching Control Plan:', err);
    }
    setLoading(false);
  }

  const handleEditClick = (lineId: string) => {
    setLines(
      lines.map((line) => {
        if (line.id === lineId) {
          return {
            ...line,
            isEditing: true,
          };
        }
        return line;
      })
    );
  };

  const handleEditChange = (
    lineId: string,
    field: keyof ControlPlanItem,
    value: any
  ) => {
    setLines(
      lines.map((line) => {
        if (line.id === lineId) {
          return {
            ...line,
            [field]: value,
          };
        }
        return line;
      })
    );
  };

  const handleSave = async (lineId: string) => {
    setSaving(true);
    try {
      const line = lines.find((l) => l.id === lineId);
      if (line) {
        await controlPlanStore.updateItem(lineId, {
          process_step: line.process_step,
          characteristic_name: line.characteristic_name,
          control_type: line.control_type,
          control_method: line.control_method,
          sample_size: line.sample_size,
          frequency: line.frequency,
          reaction_plan: line.reaction_plan,
          responsible: line.responsible,
        });

        setLines(
          lines.map((l) => {
            if (l.id === lineId) {
              return {
                ...l,
                isEditing: false,
              };
            }
            return l;
          })
        );
      }
    } catch (err) {
      console.error('Error saving line:', err);
    }
    setSaving(false);
  };

  const handleCancel = async (lineId: string) => {
    setLines(
      lines.map((line) => {
        if (line.id === lineId) {
          return {
            ...line,
            isEditing: false,
          };
        }
        return line;
      })
    );
    await fetchControlPlan();
  };

  const handleStatusChange = async (newStatus: 'draft' | 'review' | 'approved') => {
    if (!controlPlan) return;

    try {
      await controlPlanStore.updateStatus(cpId, newStatus);
      setControlPlan({
        ...controlPlan,
        status: newStatus,
      });
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handlePrint = () => {
    const prevTitle = document.title;
    const date = controlPlan ? new Date(controlPlan.created_at).toISOString().slice(0, 10).replace(/-/g, '') : '';
    const parts = ['CP', product?.customer, product?.vehicle_model, product?.name, product?.part_number || product?.code, date].filter(Boolean);
    document.title = parts.join('_');
    window.print();
    document.title = prevTitle;
  };

  const getStatusBadge = (status: 'draft' | 'review' | 'approved') => {
    const badges = {
      approved: {
        bg: 'bg-green-100',
        text: 'text-green-700',
        label: '승인됨',
      },
      review: {
        bg: 'bg-yellow-100',
        text: 'text-yellow-700',
        label: '검토중',
      },
      draft: {
        bg: 'bg-gray-100',
        text: 'text-gray-700',
        label: '초안',
      },
    };

    const badge = badges[status];
    return (
      <span
        className={`px-3 py-1 ${badge.bg} ${badge.text} text-xs font-medium rounded-full`}
      >
        {badge.label}
      </span>
    );
  };

  const getControlTypeBadge = (type: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      prevention: {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        label: '예방',
      },
      detection: {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        label: '검출',
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

  const preventionCount = lines.filter((l) => l.control_type === 'prevention').length;
  const detectionCount = lines.filter((l) => l.control_type === 'detection').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-gray-500 text-sm font-medium">로딩 중...</div>
      </div>
    );
  }

  if (!controlPlan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4 font-medium">관리계획서를 찾을 수 없습니다</p>
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

  const canEdit = controlPlan.status !== 'approved';

  // 특성 조회 헬퍼
  const getChar = (charId: string | null): Characteristic | undefined => {
    if (!charId) return undefined;
    return characteristics.find(c => c.id === charId);
  };

  const getCharClass = (charId: string | null): string => {
    const c = getChar(charId);
    if (!c) return '';
    if (c.category === 'critical') return 'CC';
    if (c.category === 'major') return 'SC';
    return '';
  };

  const getSpecText = (charId: string | null): string => {
    const c = getChar(charId);
    if (!c) return '';
    const parts: string[] = [];
    if (c.specification) parts.push(c.specification);
    if (c.lsl !== null && c.usl !== null) {
      parts.push(`${c.lsl} ~ ${c.usl}`);
    } else if (c.lsl !== null) {
      parts.push(`≥ ${c.lsl}`);
    } else if (c.usl !== null) {
      parts.push(`≤ ${c.usl}`);
    }
    if (c.unit) parts.push(c.unit);
    return parts.join(' ');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <style>{`
        @media print {
          *, *::before, *::after { box-shadow: none !important; text-shadow: none !important; }
          body { margin: 0; padding: 0; background: white !important; color: #000 !important; }
          @page { size: A4 landscape; margin: 5mm 6mm; }
          .cp-screen { display: none !important; }
          .cp-print { display: block !important; padding: 0; font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; color: #000; }

          /* 제목 */
          .cp-title { text-align: center; margin-bottom: 4px; border-bottom: 2px solid #000; padding-bottom: 4px; }
          .cp-title h1 { font-size: 16pt; font-weight: bold; margin: 0; }

          /* 적용범위 */
          .cp-scope { margin: 4px 0; font-size: 7pt; }
          .cp-scope b { font-size: 7.5pt; }
          .cp-scope-en { font-size: 6pt; color: #444 !important; margin-top: 1px; font-style: italic; }

          /* 문서 헤더 정보 테이블 */
          .cp-info { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
          .cp-info td { border: 1px solid #000; padding: 2px 4px; font-size: 7pt; vertical-align: top; }
          .cp-info .lbl { font-weight: bold; white-space: nowrap; width: 9%; font-size: 6.5pt; }
          .cp-info .lbl span { font-weight: normal; font-size: 5.5pt; color: #444 !important; }
          .cp-info .val { width: 14%; font-size: 7pt; }
          .cp-info .cp-chk { width: 10%; font-size: 6.5pt; padding: 3px 5px; vertical-align: middle; }
          .cp-info .cp-chk div { margin: 1px 0; }
          .cp-info .cp-date-block { width: 12%; font-size: 6pt; padding: 3px 5px; text-align: left; }
          .cp-info .cp-date-block span { font-size: 5pt; color: #444 !important; }
          .cp-info .cp-date-title { font-weight: bold; font-size: 7pt; margin-bottom: 2px; text-align: center; }
          .cp-info .cp-date-val { font-weight: bold; font-size: 7.5pt; margin: 1px 0 3px; }

          /* 섹션 2 */
          .cp-section2 { margin: 4px 0; font-size: 7pt; }
          .cp-section2 b { font-size: 7.5pt; }

          /* 메인 데이터 테이블 */
          .cp-body { width: 100%; border-collapse: collapse; }
          .cp-body th { border: 1px solid #000; padding: 1px 2px; font-size: 6pt; font-weight: bold; text-align: center; vertical-align: middle; line-height: 1.2; background: #e8e8e8 !important; }
          .cp-body th span { font-weight: normal; font-size: 5pt; color: #444 !important; display: block; }
          .cp-body td { border: 1px solid #000; padding: 1px 2px; font-size: 6.5pt; vertical-align: top; word-break: break-word; }
          .cp-body tbody tr { height: 22px; }
          .cp-body .c { text-align: center; vertical-align: middle; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      {/* Header */}
      <header className="cp-screen bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg">
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
                    onClick={handlePrint}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
                  >
                    PDF 다운로드
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => setEditMode(true)}
                      className="px-4 py-2 bg-white text-blue-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
                    >
                      편집
                    </button>
                  )}
                </>
              )}
              {editMode && (
                <button
                  onClick={() => setEditMode(false)}
                  className="px-4 py-2 bg-white text-blue-600 hover:bg-gray-50 rounded-lg text-sm font-medium transition-colors"
                >
                  완료
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">관리계획서</h1>
              {product && (
                <p className="text-white/80 text-sm">
                  {product.name} {product.code && `(${product.code})`}
                </p>
              )}
            </div>
            {getStatusBadge(controlPlan.status)}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="cp-screen max-w-7xl mx-auto px-6 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-8 print:grid-cols-2 print:gap-2">
          <div className="bg-white/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-white/50">
            <p className="text-gray-600 text-sm font-medium mb-2">총 항목</p>
            <p className="text-3xl font-bold text-gray-900">{lines.length}</p>
          </div>
          <div className="bg-blue-50/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-blue-200/50">
            <p className="text-blue-600 text-sm font-medium mb-2">예방 관리</p>
            <p className="text-3xl font-bold text-blue-700">{preventionCount}</p>
          </div>
          <div className="bg-purple-50/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-purple-200/50">
            <p className="text-purple-600 text-sm font-medium mb-2">검출 관리</p>
            <p className="text-3xl font-bold text-purple-700">{detectionCount}</p>
          </div>
          <div className="bg-gray-100/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-gray-200/50">
            <p className="text-gray-600 text-sm font-medium mb-2">리비전</p>
            <p className="text-3xl font-bold text-gray-900">Rev. {controlPlan.revision}</p>
          </div>
        </div>

        {/* Document Info */}
        <div className="bg-white/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-white/50 mb-8 print:mb-6">
          <div className="grid grid-cols-3 gap-8 mb-6 print:grid-cols-2 print:gap-4">
            <div>
              <p className="text-gray-500 text-sm mb-1">제품명</p>
              <p className="text-gray-900 font-semibold">{product?.name || '-'}</p>
              {product?.code && (
                <p className="text-gray-400 text-xs mt-1">{product.code}</p>
              )}
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">공정명</p>
              <p className="text-gray-900 font-semibold">{pfmea?.process_name || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-sm mb-1">작성 날짜</p>
              <p className="text-gray-900 font-semibold">
                {new Date(controlPlan.created_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
          </div>

          {pfmea && (
            <div className="pt-6 border-t border-gray-200 print:hidden">
              <Link
                href={`/documents/pfmea/${pfmea.id}`}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium inline-flex items-center gap-1"
              >
                → 관련 PFMEA 문서 보기
              </Link>
            </div>
          )}
        </div>

        {/* Status Actions */}
        {editMode && (
          <div className="bg-yellow-50/70 backdrop-blur rounded-2xl shadow-sm p-6 border border-yellow-200/50 mb-8 print:hidden">
            <p className="text-yellow-900 text-sm font-medium mb-4">편집 모드</p>
            <p className="text-yellow-700 text-sm">테이블의 항목을 수정한 후 각 행의 저장 버튼을 클릭하세요.</p>
          </div>
        )}

        {!editMode && controlPlan.status === 'draft' && (
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

        {!editMode && controlPlan.status === 'review' && (
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

        {!editMode && controlPlan.status === 'approved' && (
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

        {/* Control Plan Table */}
        <div className="bg-white/70 backdrop-blur rounded-2xl shadow-sm border border-white/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">관리 항목</h2>
          </div>

          {lines.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-500 text-sm">관리 항목이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">공정</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">특성명</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">관리유형</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">관리방법</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">샘플크기</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">주기</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">대응계획</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">담당</th>
                    {editMode && (
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700 print:hidden">
                        작업
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lines.map((line, idx) => (
                    <tr
                      key={line.id}
                      className={`hover:bg-gray-50/50 transition-colors ${
                        line.isEditing ? 'bg-yellow-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-gray-600 font-medium">{idx + 1}</td>
                      <td className="px-4 py-3 text-gray-900 font-medium text-xs">
                        {editMode && line.isEditing ? (
                          <input
                            type="text"
                            value={line.process_step}
                            onChange={(e) =>
                              handleEditChange(line.id, 'process_step', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          line.process_step || '-'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs">
                          <p className="font-medium text-gray-900">
                            {line.characteristic_name}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editMode && line.isEditing ? (
                          <select
                            value={line.control_type || ''}
                            onChange={(e) =>
                              handleEditChange(line.id, 'control_type', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          >
                            <option value="">선택</option>
                            <option value="prevention">예방</option>
                            <option value="detection">검출</option>
                          </select>
                        ) : (
                          getControlTypeBadge(line.control_type)
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode && line.isEditing ? (
                          <input
                            type="text"
                            value={line.control_method || ''}
                            onChange={(e) =>
                              handleEditChange(line.id, 'control_method', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <span className="text-gray-900 text-xs">{line.control_method || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editMode && line.isEditing ? (
                          <input
                            type="text"
                            value={line.sample_size || ''}
                            onChange={(e) =>
                              handleEditChange(line.id, 'sample_size', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-center"
                          />
                        ) : (
                          <span className="text-gray-600 text-xs">{line.sample_size || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {editMode && line.isEditing ? (
                          <input
                            type="text"
                            value={line.frequency || ''}
                            onChange={(e) =>
                              handleEditChange(line.id, 'frequency', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs text-center"
                          />
                        ) : (
                          <span className="text-gray-600 text-xs">{line.frequency || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode && line.isEditing ? (
                          <input
                            type="text"
                            value={line.reaction_plan || ''}
                            onChange={(e) =>
                              handleEditChange(line.id, 'reaction_plan', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <span className="text-gray-600 text-xs">{line.reaction_plan || '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editMode && line.isEditing ? (
                          <input
                            type="text"
                            value={line.responsible || ''}
                            onChange={(e) =>
                              handleEditChange(line.id, 'responsible', e.target.value)
                            }
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <span className="text-gray-600 text-xs">{line.responsible || '-'}</span>
                        )}
                      </td>
                      {editMode && (
                        <td className="px-4 py-3 text-center print:hidden">
                          {line.isEditing ? (
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleSave(line.id)}
                                disabled={saving}
                                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium transition-colors disabled:opacity-50"
                              >
                                저장
                              </button>
                              <button
                                onClick={() => handleCancel(line.id)}
                                className="px-2 py-1 bg-gray-300 hover:bg-gray-400 text-gray-900 rounded text-xs font-medium transition-colors"
                              >
                                취소
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditClick(line.id)}
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

      {/* ===== Print Layout - 관리계획서 표준양식 (AIAG APQP) ===== */}
      <div className="cp-print hidden">
        {/* 제목 */}
        <div className="cp-title">
          <h1>관리계획서 (Control Plan)</h1>
        </div>

        {/* 1. 적용범위 */}
        <div className="cp-scope">
          <p><b>1. 적용범위(Scope) :</b> 제조공정의 시작부터 끝까지의 전체 공정 (AIAG APQP의 양식 및 참고 매뉴얼을 기반으로 작성)</p>
          <p className="cp-scope-en">Processes involved in the manufacturing process from start to finish (Prepared by AIAG APQP form and Reference Manual as a basis)</p>
        </div>

        {/* 문서 헤더 정보 */}
        <table className="cp-info">
          <tbody>
            <tr>
              {/* 좌측: 체크박스 */}
              <td rowSpan={4} className="cp-chk">
                <div>☐ 시작품(Proto)</div>
                <div>☐ 양산선행(Pre Launch)</div>
                <div><b>☑ 양산(Mass Production)</b></div>
                <div>☐ 안전출시(Safe launching)</div>
              </td>
              <td className="lbl">1) 협력서명<br/><span>Supplier Name</span></td>
              <td className="val">신성오토텍(주)</td>
              <td className="lbl">2) 작성팀<br/><span>Organization</span></td>
              <td className="val"></td>
              <td rowSpan={4} className="cp-date-block">
                <div className="cp-date-title">개발팀</div>
                <div>■ 최초 작성일<br/><span>Date(Org.)</span></div>
                <div className="cp-date-val">{new Date(controlPlan.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}</div>
                <div>■ 최종 개정일 (Rev<br/><span>No)</span></div>
                <div className="cp-date-val">{new Date(controlPlan.updated_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')}</div>
              </td>
            </tr>
            <tr>
              <td className="lbl">3) 작성자<br/><span>Prepared by</span></td>
              <td className="val">{controlPlan.author || pfmea?.author || ''}</td>
              <td className="lbl">4) 부품명<br/><span>Part Name</span></td>
              <td className="val">{product?.name || ''}</td>
            </tr>
            <tr>
              <td className="lbl">5) 부품번호<br/><span>Part Number</span></td>
              <td className="val">{product?.part_number || product?.code || ''}</td>
              <td className="lbl">6) 설계 변경 수준<br/><span>Engineering Change Level</span></td>
              <td className="val"></td>
            </tr>
            <tr>
              <td className="lbl">4) 핵심팀<br/><span>Core Team</span></td>
              <td className="val" colSpan={2}></td>
              <td className="lbl">Dwg. Revision :</td>
              <td className="val">{controlPlan.revision}.0</td>
            </tr>
          </tbody>
        </table>

        {/* 2. 공정흐름도 설명 */}
        <div className="cp-section2">
          <p><b>2. 공정흐름도 및 공정 FMEA 연계성을 고려하여 작성.</b> (해당 시 Rework/Repair 포함)</p>
          <p className="cp-scope-en">Process Flow Diagrams in association with Process FMEA. (If applicable, include Rework/Repair )</p>
        </div>

        {/* 메인 데이터 테이블 */}
        <table className="cp-body">
          <thead>
            <tr>
              <th rowSpan={2} style={{width:'5%'}}>부품/공정<br/>번호<br/><span>Part/Proces</span><br/><span>s Number</span></th>
              <th rowSpan={2} style={{width:'8%'}}>공정명 / 작업설명<br/><span>Process</span><br/><span>Name/Description</span></th>
              <th rowSpan={2} style={{width:'7%'}}>제조를 위한 기계,<br/>장치, 지그, 공구<br/><span>Device, Jig,</span><br/><span>Machine, Tools for</span></th>
              <th colSpan={3}>특성 Characteristics</th>
              <th rowSpan={2} style={{width:'4%'}}>특별특성<br/>분류<br/><span>Special</span><br/><span>Characteris</span><br/><span>tic</span></th>
              <th rowSpan={2} style={{width:'14%'}}>제품 / 공정, 시방 / 공차<br/><span>Product/Process, Specification/Tolerance</span></th>
              <th colSpan={3}>방법 Method</th>
              <th colSpan={3}>대응계획 Reaction Plan</th>
            </tr>
            <tr>
              <th style={{width:'3%'}}>번호<br/><span>No.</span></th>
              <th style={{width:'7%'}}>제품<br/><span>Product</span></th>
              <th style={{width:'6%'}}>공정<br/><span>Process</span></th>
              <th style={{width:'8%'}}>평가 / 측정방법<br/><span>Evaluation/Measure</span><br/><span>method/Method</span></th>
              <th style={{width:'4%'}}>크기<br/><span>Size</span></th>
              <th style={{width:'4%'}}>주기<br/><span>Frequency</span></th>
              <th style={{width:'8%'}}>관리방법<br/><span>Control Method</span></th>
              <th style={{width:'6%'}}>조치<br/><span>Action</span></th>
              <th style={{width:'5%'}}>책임자<br/><span>Owner /</span><br/><span>Responsible</span></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => {
              const char = getChar(line.characteristic_id);
              const processNo = `I-${(idx + 1) * 10}`;
              return (
                <tr key={line.id}>
                  <td className="c">{processNo}</td>
                  <td>{line.process_step}</td>
                  <td></td>
                  <td className="c">{idx + 1}</td>
                  <td>{char?.type === 'product' ? (char.name || line.characteristic_name) : ''}</td>
                  <td>{char?.type === 'process' ? (char.name || line.characteristic_name) : (!char ? line.characteristic_name : '')}</td>
                  <td className="c">{getCharClass(line.characteristic_id)}</td>
                  <td>{getSpecText(line.characteristic_id)}</td>
                  <td>{char?.measurement_method || ''}</td>
                  <td className="c">{line.sample_size || ''}</td>
                  <td className="c">{line.frequency || ''}</td>
                  <td>{line.control_method || ''}</td>
                  <td>{line.reaction_plan || ''}</td>
                  <td>{line.responsible || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
