'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { controlPlanStore, characteristicStore, productStore, pfmeaStore } from '@/lib/store';
import type { ControlPlan, ControlPlanItem, Characteristic, Product } from '@/lib/store';

interface EditingLine extends ControlPlanItem {
  isEditing?: boolean;
}

export default function ControlPlanViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: cpId } = use(params);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [copying, setCopying] = useState(false);
  const [controlPlan, setControlPlan] = useState<ControlPlan | null>(null);
  const [lines, setLines] = useState<EditingLine[]>([]);
  const [product, setProduct] = useState<any>(null);
  const [pfmea, setPfmea] = useState<any>(null);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [saving, setSaving] = useState(false);
  const [editPanelLineId, setEditPanelLineId] = useState<string | null>(null);

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
          process_number: line.process_number,
          process_step: line.process_step,
          machine_device: line.machine_device,
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

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      for (const line of lines) {
        await controlPlanStore.updateItem(line.id, {
          process_number: line.process_number,
          process_step: line.process_step,
          machine_device: line.machine_device,
          characteristic_name: line.characteristic_name,
          control_type: line.control_type,
          control_method: line.control_method,
          sample_size: line.sample_size,
          frequency: line.frequency,
          reaction_plan: line.reaction_plan,
          responsible: line.responsible,
        });
      }
      await fetchControlPlan();
      setEditMode(false);
      setEditPanelLineId(null);
    } catch (err) {
      console.error('Error saving all:', err);
    }
    setSaving(false);
  };

  const handleOpenCopyModal = async () => {
    setShowCopyModal(true);
    setSelectedProductId('');
    try {
      const products = await productStore.getAll();
      setAllProducts(products.filter(p => p.id !== product?.id));
    } catch (err) {
      console.error('Error loading products:', err);
    }
  };

  const handleCopy = async () => {
    if (!selectedProductId) {
      alert('복사할 대상 제품을 선택하세요.');
      return;
    }
    setCopying(true);
    try {
      const newPlan = await controlPlanStore.duplicate(cpId, selectedProductId);
      setShowCopyModal(false);
      router.push(`/documents/control-plan/${newPlan.id}`);
    } catch (err) {
      console.error('Error copying:', err);
      alert('복사 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    }
    setCopying(false);
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
              {product && (
                <Link href={`/documents/traceability/${product.id}`} className="px-2.5 py-1 text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                  추적성
                </Link>
              )}
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

        {/* 컨트롤 버튼 */}
        <div className="flex gap-3 mb-6 flex-wrap">
          {canEdit && (
            <>
              <button
                onClick={() => { if (editMode) { setEditMode(false); setEditPanelLineId(null); } else { setEditMode(true); } }}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${editMode ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'}`}
              >
                {editMode ? '편집 취소' : '편집'}
              </button>
              {editMode && (
                <button onClick={handleSaveAll} disabled={saving} className="px-4 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg font-medium transition-all disabled:opacity-50">
                  {saving ? '저장 중...' : '전체 저장'}
                </button>
              )}
            </>
          )}

          {!editMode && (
            <>
              {controlPlan.status === 'draft' && (
                <button onClick={() => handleStatusChange('review')} className="px-4 py-2 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg font-medium transition-all">검토 요청</button>
              )}
              {controlPlan.status === 'review' && (
                <>
                  <button onClick={() => handleStatusChange('approved')} className="px-4 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg font-medium transition-all">승인</button>
                  <button onClick={() => handleStatusChange('draft')} className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all">초안으로</button>
                </>
              )}
              {controlPlan.status === 'approved' && (
                <button onClick={() => { handleStatusChange('draft'); setEditMode(true); }} className="px-4 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg font-medium transition-all">수정하기</button>
              )}
              <button onClick={handlePrint} className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg font-medium transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                PDF 다운로드
              </button>
              {lines.length > 0 && (
                <button onClick={handleOpenCopyModal} className="px-4 py-2 bg-teal-100 text-teal-700 hover:bg-teal-200 rounded-lg font-medium transition-all flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                  </svg>
                  다른 Part No로 복사
                </button>
              )}
            </>
          )}
        </div>

        {/* Control Plan Table */}
        <div className="bg-white/70 backdrop-blur rounded-2xl shadow-sm border border-white/50 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">관리 항목</h2>
            <p className="text-sm text-gray-500 mt-1">
              {lines.length}개 항목
              {editMode && <span className="ml-2 text-blue-600 font-medium">— 행을 클릭하면 편집 패널이 열립니다</span>}
            </p>
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
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">No</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">공정번호</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">공정명</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">설비</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">특성명</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700">유형</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">관리방법</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700">샘플</th>
                    <th className="px-3 py-3 text-center text-xs font-semibold text-gray-700">주기</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">조치</th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700">담당</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {lines.map((line, idx) => (
                    <tr
                      key={line.id}
                      onClick={() => { if (editMode) setEditPanelLineId(line.id); }}
                      className={`transition-colors ${editMode ? 'cursor-pointer' : ''} ${
                        editPanelLineId === line.id ? 'bg-blue-100/70' : editMode ? 'hover:bg-blue-50' : 'hover:bg-gray-50/50'
                      }`}
                    >
                      <td className="px-3 py-3 text-gray-600 font-medium">
                        {editMode && <svg className="w-3.5 h-3.5 text-blue-400 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>}
                        {idx + 1}
                      </td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{line.process_number || '-'}</td>
                      <td className="px-3 py-3 text-gray-900 font-medium text-xs">{line.process_step || '-'}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{line.machine_device || '-'}</td>
                      <td className="px-3 py-3 text-xs font-medium text-gray-900">{line.characteristic_name || '-'}</td>
                      <td className="px-3 py-3 text-center">{getControlTypeBadge(line.control_type)}</td>
                      <td className="px-3 py-3 text-gray-900 text-xs">{line.control_method || '-'}</td>
                      <td className="px-3 py-3 text-center text-gray-600 text-xs">{line.sample_size || '-'}</td>
                      <td className="px-3 py-3 text-center text-gray-600 text-xs">{line.frequency || '-'}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{line.reaction_plan || '-'}</td>
                      <td className="px-3 py-3 text-gray-600 text-xs">{line.responsible || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ===== Edit Slide-Out Panel ===== */}
      {editMode && editPanelLineId && (() => {
        const editLine = lines.find(l => l.id === editPanelLineId);
        if (!editLine) return null;
        const lineIdx = lines.findIndex(l => l.id === editPanelLineId);
        const char = getChar(editLine.characteristic_id);
        return (
          <>
            <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setEditPanelLineId(null)} />
            <div className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
              {/* Panel Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-between flex-shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-white">항목 #{lineIdx + 1} 편집</h3>
                  <p className="text-sm text-blue-100">{editLine.process_step || '공정명 미입력'}</p>
                </div>
                <button onClick={() => setEditPanelLineId(null)} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Panel Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* 공정 정보 */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">공정 정보</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">공정번호</label>
                      <input type="text" value={editLine.process_number || ''} onChange={(e) => handleEditChange(editLine.id, 'process_number', e.target.value)} placeholder="예: I-10" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">공정명 / 작업설명</label>
                      <input type="text" value={editLine.process_step} onChange={(e) => handleEditChange(editLine.id, 'process_step', e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                  </div>
                </div>

                {/* 설비 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">설비 / 기계, 장치, 지그, 공구</label>
                  <input type="text" value={editLine.machine_device || ''} onChange={(e) => handleEditChange(editLine.id, 'machine_device', e.target.value)} placeholder="예: 호퍼드라이어, 항온기, 온수기..." className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>

                {/* 특성 정보 (읽기 전용) */}
                {char && (
                  <div className="bg-blue-50 rounded-xl p-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">특성 정보 (자동 연결)</label>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div><span className="text-gray-500 text-xs">특성명:</span> <span className="font-medium">{char.name}</span></div>
                      <div><span className="text-gray-500 text-xs">유형:</span> <span className="font-medium">{char.type === 'product' ? '제품특성' : '공정특성'}</span></div>
                      <div><span className="text-gray-500 text-xs">분류:</span> <span className="font-medium">{char.category === 'critical' ? 'CC (Critical)' : char.category === 'major' ? 'SC (Safety)' : '일반'}</span></div>
                      <div><span className="text-gray-500 text-xs">규격:</span> <span className="font-medium">{getSpecText(editLine.characteristic_id) || '-'}</span></div>
                      {char.measurement_method && <div className="col-span-2"><span className="text-gray-500 text-xs">측정방법:</span> <span className="font-medium">{char.measurement_method}</span></div>}
                    </div>
                  </div>
                )}

                {/* 특성명 (직접 수정) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">특성명</label>
                  <input type="text" value={editLine.characteristic_name} onChange={(e) => handleEditChange(editLine.id, 'characteristic_name', e.target.value)} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>

                {/* 관리유형 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">관리유형</label>
                  <div className="flex gap-3">
                    {(['prevention', 'detection'] as const).map((t) => (
                      <button key={t} onClick={() => handleEditChange(editLine.id, 'control_type', t)}
                        className={`flex-1 py-2.5 rounded-lg font-bold text-sm border-2 transition-all ${
                          editLine.control_type === t
                            ? t === 'prevention' ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-purple-100 border-purple-400 text-purple-700'
                            : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                        }`}>
                        {t === 'prevention' ? '예방 (Prevention)' : '검출 (Detection)'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 관리방법 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">관리방법 (Control Method)</label>
                  <input type="text" value={editLine.control_method || ''} onChange={(e) => handleEditChange(editLine.id, 'control_method', e.target.value)} placeholder="예: 공정 조건 관리, SPC 관리..." className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>

                {/* 샘플 */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">샘플 (Sample)</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">크기 (Size)</label>
                      <input type="text" value={editLine.sample_size || ''} onChange={(e) => handleEditChange(editLine.id, 'sample_size', e.target.value)} placeholder="예: 전수, 5, 1회" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">주기 (Frequency)</label>
                      <input type="text" value={editLine.frequency || ''} onChange={(e) => handleEditChange(editLine.id, 'frequency', e.target.value)} placeholder="예: 매 LOT, 매 시간, 전수검사" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </div>
                  </div>
                </div>

                {/* 대응계획 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">조치 / 대응계획 (Reaction Plan)</label>
                  <textarea value={editLine.reaction_plan || ''} onChange={(e) => handleEditChange(editLine.id, 'reaction_plan', e.target.value)} rows={2} placeholder="예: 공정 중단 후 원인 조사, 부적합품 격리..." className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>

                {/* 책임자 */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">책임자 (Owner / Responsible)</label>
                  <input type="text" value={editLine.responsible || ''} onChange={(e) => handleEditChange(editLine.id, 'responsible', e.target.value)} placeholder="예: 작업자, 검사원, 품질팀장" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                </div>
              </div>

              {/* Panel Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
                <div className="flex gap-2">
                  <button onClick={() => { if (lineIdx > 0) setEditPanelLineId(lines[lineIdx - 1].id); }} disabled={lineIdx <= 0} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">← 이전</button>
                  <button onClick={() => { if (lineIdx < lines.length - 1) setEditPanelLineId(lines[lineIdx + 1].id); }} disabled={lineIdx >= lines.length - 1} className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">다음 →</button>
                </div>
                <button onClick={() => setEditPanelLineId(null)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all">완료</button>
              </div>
            </div>
          </>
        );
      })()}

      {/* ===== Copy Modal ===== */}
      {showCopyModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50" onClick={() => setShowCopyModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-teal-600 to-cyan-600">
                <h3 className="text-lg font-bold text-white">관리계획서 복사</h3>
                <p className="text-sm text-teal-100 mt-1">현재 관리 항목 {lines.length}건을 다른 제품으로 복사합니다</p>
              </div>
              <div className="p-6">
                <div className="mb-4">
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-500">현재 제품</p>
                    <p className="text-sm font-semibold text-gray-900">{product?.name} ({product?.part_number || product?.code})</p>
                  </div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">복사할 대상 제품 선택</label>
                  {allProducts.length === 0 ? (
                    <p className="text-sm text-gray-500">다른 등록된 제품이 없습니다. 먼저 제품을 등록해주세요.</p>
                  ) : (
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    >
                      <option value="">제품을 선택하세요</option>
                      {allProducts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.part_number ? `(${p.part_number})` : p.code ? `(${p.code})` : ''} {p.customer ? `- ${p.customer}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {selectedProductId && (
                  <div className="bg-teal-50 rounded-lg p-3 mb-4">
                    <p className="text-xs text-teal-600 font-medium">복사 내용</p>
                    <ul className="text-xs text-teal-800 mt-1 space-y-0.5">
                      <li>• 관리 항목 {lines.length}건 (공정, 설비, 관리방법, 샘플, 대응계획 등)</li>
                      <li>• 새 관리계획서가 초안 상태로 생성됩니다</li>
                      <li>• 기본정보(제품명, Part No 등)는 선택한 제품으로 변경됩니다</li>
                    </ul>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                <button onClick={() => setShowCopyModal(false)} className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-all">취소</button>
                <button onClick={handleCopy} disabled={!selectedProductId || copying} className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-all disabled:opacity-50">
                  {copying ? '복사 중...' : '복사 생성'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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
              return (
                <tr key={line.id}>
                  <td className="c">{line.process_number || `I-${(idx + 1) * 10}`}</td>
                  <td>{line.process_step}</td>
                  <td>{line.machine_device || ''}</td>
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
