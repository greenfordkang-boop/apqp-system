'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  pfmeaStore,
  characteristicStore,
  productStore,
  aiReviewPfmeaLine,
  generateDocNumber,
} from '@/lib/store';
import type { PfmeaHeader, PfmeaLine, Product, Characteristic } from '@/lib/store';

type EditingLine = PfmeaLine;

// 신규 항목 입력용 타입
interface NewLineInput {
  process_step: string;
  characteristic_id: string;
  potential_failure_mode: string;
  potential_effect: string;
}

const emptyNewLine: NewLineInput = {
  process_step: '',
  characteristic_id: '',
  potential_failure_mode: '',
  potential_effect: '',
};

export default function PfmeaViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: pfmeaId } = use(params);

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [pfmea, setPfmea] = useState<PfmeaHeader | null>(null);
  const [lines, setLines] = useState<PfmeaLine[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingLines, setEditingLines] = useState<Map<string, EditingLine>>(new Map());
  const [isPrinting, setIsPrinting] = useState(false);

  // 신규 항목 추가 상태
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLine, setNewLine] = useState<NewLineInput>({ ...emptyNewLine });
  const [aiReviewing, setAiReviewing] = useState(false);
  const [aiReviewingLineId, setAiReviewingLineId] = useState<string | null>(null);

  // AI 전체 리뷰 패널
  const [isFullReviewing, setIsFullReviewing] = useState(false);
  const [fullReviewResult, setFullReviewResult] = useState<{ overall_score: number; findings: { type: string; target: string; message: string }[]; summary: string } | null>(null);
  const [showReviewPanel, setShowReviewPanel] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (pfmeaId) {
      fetchPfmea();
    }
  }, [pfmeaId]);

  const fetchPfmea = useCallback(async () => {
    setLoading(true);
    try {
      const headerData = await pfmeaStore.getHeaderById(pfmeaId);
      if (!headerData) {
        setLoading(false);
        return;
      }
      setPfmea(headerData);

      const productData = await productStore.getById(headerData.product_id);
      if (productData) {
        setProduct(productData);
        const chars = await characteristicStore.getByProductId(productData.id);
        setCharacteristics(chars);
      }

      const linesData = await pfmeaStore.getLines(pfmeaId);
      setLines(linesData);
    } catch (err) {
      console.error('Error fetching PFMEA:', err);
    }
    setLoading(false);
  }, [pfmeaId]);

  // ========== 편집 모드 ==========
  const handleEditModeToggle = () => {
    if (isEditMode) {
      setIsEditMode(false);
      setEditingLines(new Map());
    } else {
      if (pfmea?.status === 'approved') return;
      setIsEditMode(true);
      const newMap = new Map<string, EditingLine>();
      lines.forEach((line) => {
        newMap.set(line.id, { ...line } as EditingLine);
      });
      setEditingLines(newMap);
    }
  };

  const handleEditingChange = (lineId: string, field: string, value: string | number) => {
    const current = editingLines.get(lineId);
    if (!current) return;
    const updated = { ...current, [field]: value };
    if (field === 'severity' || field === 'occurrence' || field === 'detection') {
      const num = Math.max(1, Math.min(10, parseInt(String(value)) || 1));
      (updated as Record<string, unknown>)[field] = num;
      updated.rpn = updated.severity * updated.occurrence * updated.detection;
    }
    editingLines.set(lineId, updated);
    setEditingLines(new Map(editingLines));
  };

  const handleSaveChanges = async () => {
    try {
      for (const [lineId, lineData] of editingLines) {
        await pfmeaStore.updateLine(lineId, {
          process_step: lineData.process_step,
          potential_failure_mode: lineData.potential_failure_mode,
          potential_effect: lineData.potential_effect,
          severity: lineData.severity,
          potential_cause: lineData.potential_cause,
          occurrence: lineData.occurrence,
          current_control_prevention: lineData.current_control_prevention,
          current_control_detection: lineData.current_control_detection,
          detection: lineData.detection,
          recommended_action: lineData.recommended_action,
          action_priority: lineData.action_priority,
        });
      }
      await fetchPfmea();
      setIsEditMode(false);
      setEditingLines(new Map());
    } catch (err) {
      console.error('Error saving changes:', err);
    }
  };

  const handleCancel = () => {
    setIsEditMode(false);
    setEditingLines(new Map());
  };

  // ========== 항목 삭제 ==========
  const handleDeleteLine = async (lineId: string) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    try {
      await pfmeaStore.deleteLine(lineId);
      await fetchPfmea();
    } catch (err) {
      console.error('Error deleting line:', err);
    }
  };

  // ========== 수동 항목 추가 ==========
  const handleAddLine = async () => {
    if (!newLine.process_step.trim() || !newLine.potential_failure_mode.trim()) {
      alert('공정명과 잠재고장모드는 필수입니다.');
      return;
    }

    // characteristic_id 결정: 선택된 것 > 첫 번째 특성 > null
    const charId = newLine.characteristic_id || characteristics[0]?.id || null;
    if (!charId) {
      alert('관련 특성을 선택하거나, 제품에 특성을 먼저 등록해 주세요.');
      return;
    }

    try {
      await pfmeaStore.createLine({
        pfmea_id: pfmeaId,
        characteristic_id: charId,
        process_step: newLine.process_step,
        potential_failure_mode: newLine.potential_failure_mode,
        potential_effect: newLine.potential_effect || '',
        severity: 1,
        potential_cause: '',
        occurrence: 1,
        current_control_prevention: '',
        current_control_detection: '',
        detection: 1,
        recommended_action: '',
      });
      setNewLine({ ...emptyNewLine });
      setShowAddForm(false);
      await fetchPfmea();
    } catch (err) {
      console.error('Error adding line:', err);
      alert('항목 추가 실패: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    }
  };

  // ========== AI 검토 (개별 항목) ==========
  const handleAiReviewLine = async (lineId: string) => {
    const line = lines.find((l) => l.id === lineId);
    if (!line) return;

    setAiReviewingLineId(lineId);
    try {
      // 특성 정보 가져오기
      const char = line.characteristic_id
        ? await characteristicStore.getById(line.characteristic_id)
        : null;

      // AI 검토 실행
      const result = aiReviewPfmeaLine({
        process_step: line.process_step,
        potential_failure_mode: line.potential_failure_mode,
        potential_effect: line.potential_effect,
        characteristic_category: char?.category,
      });

      // 0.8초 딜레이 (AI 느낌)
      await new Promise((r) => setTimeout(r, 800));

      await pfmeaStore.updateLine(lineId, result);
      await fetchPfmea();
    } catch (err) {
      console.error('AI review error:', err);
    }
    setAiReviewingLineId(null);
  };

  // ========== 전체 AI 검토 ==========
  const handleAiReviewAll = async () => {
    const unreviewedLines = lines.filter(
      (l) => l.severity <= 1 && l.occurrence <= 1 && l.detection <= 1
    );
    if (unreviewedLines.length === 0) {
      alert('AI 검토가 필요한 항목이 없습니다.\n(S/O/D가 모두 1인 항목만 대상)');
      return;
    }
    setAiReviewing(true);
    try {
      for (const line of unreviewedLines) {
        setAiReviewingLineId(line.id);
        const char = line.characteristic_id
          ? await characteristicStore.getById(line.characteristic_id)
          : null;
        const result = aiReviewPfmeaLine({
          process_step: line.process_step,
          potential_failure_mode: line.potential_failure_mode,
          potential_effect: line.potential_effect,
          characteristic_category: char?.category,
        });
        await new Promise((r) => setTimeout(r, 500));
        await pfmeaStore.updateLine(line.id, result);
      }
      await fetchPfmea();
    } catch (err) {
      console.error('AI review all error:', err);
    }
    setAiReviewing(false);
    setAiReviewingLineId(null);
  };

  // ========== 상태 변경 ==========
  const handleStatusChange = async (newStatus: 'draft' | 'review' | 'approved') => {
    if (!pfmea) return;
    try {
      // 검토 → 승인 시 revision 증가
      if (newStatus === 'approved' && pfmea.status === 'review') {
        await pfmeaStore.updateHeader(pfmeaId, {
          status: newStatus,
          revision: pfmea.revision + 1,
          doc_number: product
            ? generateDocNumber('PFMEA', product.part_number || product.code, pfmea.revision + 1)
            : pfmea.doc_number,
        });
      } else {
        await pfmeaStore.updateHeaderStatus(pfmeaId, newStatus);
      }
      await fetchPfmea();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handlePdfDownload = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  // ========== AI 전체 리뷰 (API) ==========
  const handleFullReview = async () => {
    if (lines.length === 0) {
      alert('검토할 PFMEA 항목이 없습니다.');
      return;
    }
    setIsFullReviewing(true);
    setShowReviewPanel(true);
    setFullReviewResult(null);
    try {
      // 특성명 매핑
      const charMap = new Map<string, string>();
      for (const c of characteristics) {
        charMap.set(c.id, c.name);
      }

      const payload = {
        product_name: product?.name || '제품',
        process_name: pfmea?.process_name || '공정',
        lines: lines.map((l) => ({
          process_step: l.process_step,
          characteristic_name: l.characteristic_id ? (charMap.get(l.characteristic_id) || '-') : '-',
          potential_failure_mode: l.potential_failure_mode,
          potential_effect: l.potential_effect,
          severity: l.severity,
          potential_cause: l.potential_cause,
          occurrence: l.occurrence,
          current_control_prevention: l.current_control_prevention || '',
          current_control_detection: l.current_control_detection || '',
          detection: l.detection,
          rpn: l.rpn,
          action_priority: l.action_priority || '',
          recommended_action: l.recommended_action || '',
        })),
      };

      const res = await fetch('/api/review/pfmea', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success && data.review) {
        setFullReviewResult(data.review);
      } else {
        alert('AI 리뷰 실패: ' + (data.error || '알 수 없는 오류'));
      }
    } catch (err) {
      console.error('Full review error:', err);
      alert('AI 리뷰 요청 실패: ' + (err instanceof Error ? err.message : '네트워크 오류'));
    }
    setIsFullReviewing(false);
  };

  // ========== 유틸 ==========
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">승인됨</span>;
      case 'review':
        return <span className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">검토중</span>;
      default:
        return <span className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">초안</span>;
    }
  };

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case 'H': return <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">H</span>;
      case 'M': return <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded">M</span>;
      case 'L': return <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">L</span>;
      default: return <span className="text-gray-400">-</span>;
    }
  };

  const getRpnColor = (rpn: number) => {
    if (rpn >= 200) return 'text-red-600 font-bold';
    if (rpn >= 100) return 'text-orange-600 font-semibold';
    return 'text-gray-700';
  };

  const getDisplayLine = (lineId: string): EditingLine | PfmeaLine => {
    return editingLines.get(lineId) || lines.find((l) => l.id === lineId)!;
  };

  const getCharNameForPrint = (charId: string | null): string => {
    if (!charId) return '';
    const char = characteristics.find(c => c.id === charId);
    return char?.name || '';
  };

  const getCharClass = (charId: string | null): string => {
    if (!charId) return '';
    const char = characteristics.find(c => c.id === charId);
    if (char?.category === 'critical') return 'CC';
    if (char?.category === 'major') return 'SC';
    return '';
  };

  if (!mounted) return <div className="min-h-screen" />;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!pfmea) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">PFMEA를 찾을 수 없습니다</p>
          <Link href="/documents/generate" className="text-blue-600 hover:text-blue-700 font-medium">
            문서 생성 페이지로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const highRiskCount = lines.filter((l) => l.rpn >= 200).length;
  const avgRpn = lines.length > 0 ? Math.round(lines.reduce((sum, l) => sum + l.rpn, 0) / lines.length) : 0;
  const unreviewedCount = lines.filter((l) => l.severity <= 1 && l.occurrence <= 1 && l.detection <= 1).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <style>{`
        @media print {
          *, *::before, *::after { background: transparent !important; color: #000 !important; box-shadow: none !important; text-shadow: none !important; }
          body { margin: 0; padding: 0; }
          @page { size: A4 landscape; margin: 6mm; }
          .pfmea-screen { display: none !important; }
          .pfmea-print { display: block !important; padding: 0; font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif; }
          .print-title { text-align: center; margin-bottom: 6px; }
          .print-title h1 { font-size: 14pt; font-weight: bold; margin: 0; }
          .print-title p { font-size: 8pt; margin: 2px 0 0; }
          .print-header { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
          .print-header td { border: 1px solid #000; padding: 2px 4px; font-size: 7pt; }
          .print-header .lbl { font-weight: bold; white-space: nowrap; }
          .print-body { width: 100%; border-collapse: collapse; }
          .print-body th { border: 1px solid #000; padding: 2px; font-size: 6pt; font-weight: bold; text-align: center; vertical-align: middle; line-height: 1.3; }
          .print-body td { border: 1px solid #000; padding: 1px 2px; font-size: 6.5pt; vertical-align: top; word-break: break-word; }
          .print-body tbody tr { height: 24px; }
          .print-body .c { text-align: center; vertical-align: middle; }
          .print-notes { margin-top: 3px; font-size: 6.5pt; }
          .print-notes p { margin: 1px 0; }
          .print-approval { margin-top: 10px; border-collapse: collapse; }
          .print-approval td { border: 1px solid #000; padding: 3px 10px; font-size: 7pt; text-align: center; }
          .print-approval .lbl { font-weight: bold; }
          .print-approval .sign { width: 70px; height: 35px; }
          table { page-break-inside: auto; }
          tr { page-break-inside: avoid; }
        }
      `}</style>

      {/* ===== Header ===== */}
      <header className="pfmea-screen sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link href="/documents/generate" className="no-print p-2 hover:bg-gray-100 rounded-lg transition-colors" title="돌아가기">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PFMEA 분석</h1>
                <p className="text-sm text-gray-500">
                  {pfmea.doc_number || '문서번호 미지정'} · {product?.name || '제품'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getStatusBadge(pfmea.status)}
              <span className="text-sm text-gray-500">Rev. {pfmea.revision}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="pfmea-screen max-w-7xl mx-auto px-4 py-6">

        {/* ===== 1. 기본정보 헤더 ===== */}
        <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl shadow-sm mb-6 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200/50 bg-gradient-to-r from-blue-600 to-indigo-600">
            <h2 className="text-lg font-bold text-white">문서 기본정보</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200/50">
            {[
              { label: '고객사', value: product?.customer || '-' },
              { label: '차종', value: product?.vehicle_model || '-' },
              { label: '품명', value: product?.name || '-' },
              { label: '품번', value: product?.part_number || product?.code || '-' },
              { label: '문서번호', value: pfmea.doc_number || '-' },
              { label: '공정명', value: pfmea.process_name || '-' },
              { label: 'Rev', value: `${pfmea.revision}` },
              { label: '작성일', value: new Date(pfmea.created_at).toLocaleDateString('ko-KR') },
              { label: '최종수정일', value: new Date(pfmea.updated_at).toLocaleDateString('ko-KR') },
              { label: '작성자', value: pfmea.author || '-' },
              { label: '상태', value: pfmea.status === 'approved' ? '승인됨' : pfmea.status === 'review' ? '검토중' : '초안' },
              { label: '제품코드', value: product?.code || '-' },
            ].map((item, i) => (
              <div key={i} className="bg-white px-4 py-3">
                <div className="text-xs font-medium text-gray-500 mb-1">{item.label}</div>
                <div className="text-sm font-semibold text-gray-900 truncate">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ===== 2. 컨트롤 버튼 ===== */}
        <div className="no-print flex gap-3 mb-6 flex-wrap">
          {pfmea.status !== 'approved' && (
            <>
              <button
                onClick={handleEditModeToggle}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  isEditMode ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                }`}
              >
                {isEditMode ? '편집 취소' : '편집'}
              </button>

              {!isEditMode && (
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="px-4 py-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg font-medium transition-all flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  항목 추가
                </button>
              )}

              {!isEditMode && unreviewedCount > 0 && (
                <button
                  onClick={handleAiReviewAll}
                  disabled={aiReviewing}
                  className="px-4 py-2 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {aiReviewing ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-purple-300 border-t-purple-700 animate-spin"></div>
                      AI 검토 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      AI 전체 검토 ({unreviewedCount}건)
                    </>
                  )}
                </button>
              )}
            </>
          )}

          {isEditMode && (
            <>
              <button onClick={handleSaveChanges} className="px-4 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg font-medium transition-all">저장</button>
              <button onClick={handleCancel} className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all">취소</button>
            </>
          )}

          {!isEditMode && (
            <>
              {pfmea.status === 'draft' && (
                <button onClick={() => handleStatusChange('review')} className="px-4 py-2 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg font-medium transition-all">검토 요청</button>
              )}
              {pfmea.status === 'review' && (
                <>
                  <button onClick={() => handleStatusChange('approved')} className="px-4 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg font-medium transition-all">승인</button>
                  <button onClick={() => handleStatusChange('draft')} className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all">초안으로</button>
                </>
              )}
              {pfmea.status === 'approved' && (
                <button onClick={() => handleStatusChange('draft')} className="px-4 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg font-medium transition-all">수정하기</button>
              )}
              <button onClick={handlePdfDownload} className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg font-medium transition-all flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                PDF 다운로드
              </button>

              {lines.length > 0 && (
                <button
                  onClick={handleFullReview}
                  disabled={isFullReviewing}
                  className="px-4 py-2 bg-gradient-to-r from-violet-100 to-purple-100 text-violet-700 hover:from-violet-200 hover:to-purple-200 rounded-lg font-medium transition-all flex items-center gap-2 disabled:opacity-50 border border-violet-200"
                >
                  {isFullReviewing ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-violet-300 border-t-violet-700 animate-spin" />
                      AI 분석 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      AI 전체 리뷰
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>

        {/* ===== 3. 항목 추가 폼 ===== */}
        {showAddForm && (
          <div className="no-print bg-white/90 backdrop-blur-md border-2 border-emerald-200 rounded-2xl shadow-lg mb-6 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              새 분석 항목 추가
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              공정, 잠재고장모드, 잠재영향을 입력하면 <strong className="text-purple-600">AI가 나머지를 자동 완성</strong>합니다.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">공정 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newLine.process_step}
                  onChange={(e) => setNewLine({ ...newLine, process_step: e.target.value })}
                  placeholder="예: 선반 가공, 조립, 용접..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">관련 특성</label>
                <select
                  value={newLine.characteristic_id}
                  onChange={(e) => setNewLine({ ...newLine, characteristic_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                >
                  <option value="">선택 안함</option>
                  {characteristics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.category === 'critical' ? '★ Critical' : c.category === 'major' ? 'Major' : 'Minor'})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">잠재고장모드 <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={newLine.potential_failure_mode}
                  onChange={(e) => setNewLine({ ...newLine, potential_failure_mode: e.target.value })}
                  placeholder="예: 치수 규격 이탈, 부품 누락, 표면 스크래치..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">잠재영향</label>
                <input
                  type="text"
                  value={newLine.potential_effect}
                  onChange={(e) => setNewLine({ ...newLine, potential_effect: e.target.value })}
                  placeholder="예: 조립 불량, 기능 불량, 외관 불량..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleAddLine}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-all"
              >
                항목 추가
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewLine({ ...emptyNewLine }); }}
                className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-all"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ===== 4. 요약 통계 ===== */}
        <div className="no-print grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-medium text-gray-500 mb-1">총 항목</div>
            <div className="text-2xl font-bold text-blue-600">{lines.length}</div>
          </div>
          <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-medium text-gray-500 mb-1">고위험 (≥200)</div>
            <div className="text-2xl font-bold text-red-600">{highRiskCount}</div>
          </div>
          <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-medium text-gray-500 mb-1">중위험 (≥100)</div>
            <div className="text-2xl font-bold text-orange-600">{lines.filter((l) => l.rpn >= 100 && l.rpn < 200).length}</div>
          </div>
          <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-medium text-gray-500 mb-1">평균 RPN</div>
            <div className="text-2xl font-bold text-gray-600">{avgRpn}</div>
          </div>
          <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl p-5 shadow-sm">
            <div className="text-xs font-medium text-gray-500 mb-1">AI 검토 대기</div>
            <div className="text-2xl font-bold text-purple-600">{unreviewedCount}</div>
          </div>
        </div>

        {/* ===== AI 전체 리뷰 패널 ===== */}
        {showReviewPanel && (
          <div className="no-print bg-white/90 backdrop-blur-md border-2 border-violet-200 rounded-2xl shadow-lg mb-6 overflow-hidden">
            <div className="px-6 py-4 border-b border-violet-100 bg-gradient-to-r from-violet-600 to-purple-600 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                AI PFMEA 리뷰
              </h3>
              <button onClick={() => setShowReviewPanel(false)} className="text-white/80 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isFullReviewing && !fullReviewResult && (
              <div className="p-12 text-center">
                <div className="w-12 h-12 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600 font-medium">PFMEA 전체 항목을 AI가 분석하고 있습니다...</p>
                <p className="text-sm text-gray-400 mt-1">IATF 16949 기준으로 S/O/D, 관리방안, 누락 항목을 검토합니다</p>
              </div>
            )}

            {fullReviewResult && (
              <div className="p-6">
                {/* 점수 */}
                <div className="flex items-center gap-6 mb-6">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white ${
                    fullReviewResult.overall_score >= 80 ? 'bg-green-500' :
                    fullReviewResult.overall_score >= 60 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}>
                    {fullReviewResult.overall_score}
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-gray-900">
                      {fullReviewResult.overall_score >= 80 ? '양호' :
                       fullReviewResult.overall_score >= 60 ? '개선 필요' : '주의 필요'}
                    </p>
                    <p className="text-sm text-gray-600 mt-1">{fullReviewResult.summary}</p>
                  </div>
                </div>

                {/* 발견사항 */}
                {fullReviewResult.findings.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">발견사항 ({fullReviewResult.findings.length}건)</h4>
                    {fullReviewResult.findings.map((finding, i) => (
                      <div key={i} className={`p-4 rounded-xl border ${
                        finding.type === 'warning' ? 'bg-red-50 border-red-200' :
                        finding.type === 'missing' ? 'bg-orange-50 border-orange-200' :
                        'bg-blue-50 border-blue-200'
                      }`}>
                        <div className="flex items-start gap-3">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white flex-shrink-0 ${
                            finding.type === 'warning' ? 'bg-red-500' :
                            finding.type === 'missing' ? 'bg-orange-500' :
                            'bg-blue-500'
                          }`}>
                            {finding.type === 'warning' ? '!' : finding.type === 'missing' ? '?' : 'i'}
                          </span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-xs font-bold uppercase ${
                                finding.type === 'warning' ? 'text-red-600' :
                                finding.type === 'missing' ? 'text-orange-600' :
                                'text-blue-600'
                              }`}>
                                {finding.type === 'warning' ? '경고' : finding.type === 'missing' ? '누락' : '개선'}
                              </span>
                              <span className="text-xs font-medium text-gray-500">{finding.target}</span>
                            </div>
                            <p className="text-sm text-gray-800">{finding.message}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {fullReviewResult.findings.length === 0 && (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-gray-600 font-medium">특이사항이 발견되지 않았습니다.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== 5. PFMEA 테이블 ===== */}
        <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200/50">
            <h2 className="text-lg font-semibold text-gray-900">PFMEA 분석 항목</h2>
            <p className="text-sm text-gray-500 mt-1">{lines.length}개의 분석 항목</p>
          </div>

          {lines.length === 0 ? (
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-50 mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <p className="text-gray-600 font-medium mb-2">분석 항목이 없습니다</p>
              <p className="text-sm text-gray-400 mb-4">위의 &quot;항목 추가&quot; 버튼으로 공정/고장모드를 입력하세요</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="no-print px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-all"
              >
                첫 항목 추가하기
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full text-sm ${isPrinting ? 'print-table' : ''}`}>
                <thead className="bg-gray-50/80 border-b border-gray-200/50">
                  <tr>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">No</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">공정</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">특성명</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">잠재고장모드</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">잠재영향</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">S</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">원인</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">O</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">예방관리</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">검출관리</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">D</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">RPN</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700">AP</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-700">권장조치</th>
                    <th className="px-3 py-3 text-center font-semibold text-gray-700 no-print">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/50">
                  {lines.map((line, idx) => {
                    const displayLine = getDisplayLine(line.id);
                    const rpn = displayLine.rpn;
                    const isUnreviewed = line.severity <= 1 && line.occurrence <= 1 && line.detection <= 1;
                    const isReviewing = aiReviewingLineId === line.id;

                    return (
                      <tr
                        key={line.id}
                        className={`transition-colors ${
                          isReviewing
                            ? 'bg-purple-50 animate-pulse'
                            : isUnreviewed
                            ? 'bg-yellow-50/50'
                            : 'hover:bg-blue-50/50'
                        }`}
                      >
                        <td className="px-3 py-3 text-gray-700 font-medium">{idx + 1}</td>

                        {/* 공정 */}
                        <td className="px-3 py-3">
                          {isEditMode ? (
                            <input type="text" value={displayLine.process_step} onChange={(e) => handleEditingChange(line.id, 'process_step', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded font-medium text-sm" />
                          ) : (
                            <span className="font-medium text-gray-900">{displayLine.process_step}</span>
                          )}
                        </td>

                        {/* 특성명 */}
                        <td className="px-3 py-3 text-sm">
                          {line.characteristic_id ? <CharName charId={line.characteristic_id} /> : <span className="text-gray-400">-</span>}
                        </td>

                        {/* 잠재고장모드 */}
                        <td className="px-3 py-3">
                          {isEditMode ? (
                            <textarea value={displayLine.potential_failure_mode} onChange={(e) => handleEditingChange(line.id, 'potential_failure_mode', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" rows={2} />
                          ) : (
                            <span className="text-red-700 font-medium text-xs">{displayLine.potential_failure_mode}</span>
                          )}
                        </td>

                        {/* 잠재영향 */}
                        <td className="px-3 py-3">
                          {isEditMode ? (
                            <textarea value={displayLine.potential_effect} onChange={(e) => handleEditingChange(line.id, 'potential_effect', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" rows={2} />
                          ) : (
                            <span className="text-gray-700 text-xs">{displayLine.potential_effect || '-'}</span>
                          )}
                        </td>

                        {/* S */}
                        <td className="px-3 py-3 text-center">
                          {isEditMode ? (
                            <input type="number" min="1" max="10" value={displayLine.severity} onChange={(e) => handleEditingChange(line.id, 'severity', e.target.value)} className="w-12 px-1 py-1 border border-gray-300 rounded text-center font-semibold text-sm" />
                          ) : (
                            <span className={`font-semibold ${displayLine.severity >= 8 ? 'text-red-600' : 'text-gray-900'}`}>{displayLine.severity}</span>
                          )}
                        </td>

                        {/* 원인 */}
                        <td className="px-3 py-3">
                          {isEditMode ? (
                            <textarea value={displayLine.potential_cause} onChange={(e) => handleEditingChange(line.id, 'potential_cause', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" rows={2} />
                          ) : (
                            <span className="text-gray-700 text-xs">{displayLine.potential_cause || '-'}</span>
                          )}
                        </td>

                        {/* O */}
                        <td className="px-3 py-3 text-center">
                          {isEditMode ? (
                            <input type="number" min="1" max="10" value={displayLine.occurrence} onChange={(e) => handleEditingChange(line.id, 'occurrence', e.target.value)} className="w-12 px-1 py-1 border border-gray-300 rounded text-center font-semibold text-sm" />
                          ) : (
                            <span className="font-semibold text-gray-900">{displayLine.occurrence}</span>
                          )}
                        </td>

                        {/* 예방관리 */}
                        <td className="px-3 py-3 text-xs">
                          {isEditMode ? (
                            <input type="text" value={displayLine.current_control_prevention || ''} onChange={(e) => handleEditingChange(line.id, 'current_control_prevention', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                          ) : (
                            <span className="text-gray-700">{displayLine.current_control_prevention || '-'}</span>
                          )}
                        </td>

                        {/* 검출관리 */}
                        <td className="px-3 py-3 text-xs">
                          {isEditMode ? (
                            <input type="text" value={displayLine.current_control_detection || ''} onChange={(e) => handleEditingChange(line.id, 'current_control_detection', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" />
                          ) : (
                            <span className="text-gray-700">{displayLine.current_control_detection || '-'}</span>
                          )}
                        </td>

                        {/* D */}
                        <td className="px-3 py-3 text-center">
                          {isEditMode ? (
                            <input type="number" min="1" max="10" value={displayLine.detection} onChange={(e) => handleEditingChange(line.id, 'detection', e.target.value)} className="w-12 px-1 py-1 border border-gray-300 rounded text-center font-semibold text-sm" />
                          ) : (
                            <span className="font-semibold text-gray-900">{displayLine.detection}</span>
                          )}
                        </td>

                        {/* RPN */}
                        <td className={`px-3 py-3 text-center ${getRpnColor(rpn)}`}>{rpn}</td>

                        {/* AP */}
                        <td className="px-3 py-3 text-center">
                          {isEditMode ? (
                            <select value={displayLine.action_priority || ''} onChange={(e) => handleEditingChange(line.id, 'action_priority', e.target.value)} className="w-14 px-1 py-1 border border-gray-300 rounded text-center text-xs">
                              <option value="">-</option>
                              <option value="H">H</option>
                              <option value="M">M</option>
                              <option value="L">L</option>
                            </select>
                          ) : getPriorityBadge(displayLine.action_priority)}
                        </td>

                        {/* 권장조치 */}
                        <td className="px-3 py-3 text-xs">
                          {isEditMode ? (
                            <textarea value={displayLine.recommended_action || ''} onChange={(e) => handleEditingChange(line.id, 'recommended_action', e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-xs" rows={2} />
                          ) : (
                            <span className="text-gray-700">{displayLine.recommended_action || '-'}</span>
                          )}
                        </td>

                        {/* 액션 버튼 */}
                        <td className="px-3 py-3 text-center no-print">
                          <div className="flex flex-col gap-1">
                            {isUnreviewed && !isEditMode && (
                              <button
                                onClick={() => handleAiReviewLine(line.id)}
                                disabled={isReviewing}
                                className="px-2 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded text-xs font-medium transition-all disabled:opacity-50"
                                title="AI 검토"
                              >
                                {isReviewing ? '검토중...' : 'AI 검토'}
                              </button>
                            )}
                            {!isEditMode && pfmea.status !== 'approved' && (
                              <button
                                onClick={() => handleDeleteLine(line.id)}
                                className="px-2 py-1 bg-red-50 text-red-500 hover:bg-red-100 rounded text-xs font-medium transition-all"
                                title="삭제"
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===== Footer ===== */}
        <div className="no-print mt-6 text-center text-sm text-gray-500">
          <p>최종 업데이트: {new Date(pfmea.updated_at).toLocaleString('ko-KR')}</p>
        </div>
      </main>

      {/* ===== Print Layout - AIAG & VDA FMEA Format ===== */}
      <div className="pfmea-print hidden">
        <div className="print-title">
          <h1>공정 FMEA (Process FMEA)</h1>
          <p>AIAG &amp; VDA FMEA Handbook 기준</p>
        </div>

        <table className="print-header">
          <tbody>
            <tr>
              <td className="lbl">회사명 / Company</td>
              <td>신성오토텍(주)</td>
              <td className="lbl">FMEA No.</td>
              <td>{pfmea.doc_number || '-'}</td>
              <td className="lbl">작성일 / Date</td>
              <td>{new Date(pfmea.created_at).toLocaleDateString('ko-KR')}</td>
              <td className="lbl">Rev.</td>
              <td>{pfmea.revision}</td>
            </tr>
            <tr>
              <td className="lbl">제품명 / Product</td>
              <td>{product?.name || '-'}</td>
              <td className="lbl">공정명 / Process</td>
              <td>{pfmea.process_name || '-'}</td>
              <td className="lbl">책임자 / Owner</td>
              <td>{pfmea.author || '-'}</td>
              <td className="lbl">Page</td>
              <td>1 / 1</td>
            </tr>
            <tr>
              <td className="lbl">고객 / Customer</td>
              <td>{product?.customer || '-'}</td>
              <td className="lbl">모델 / Model</td>
              <td>{product?.vehicle_model || '-'}</td>
              <td className="lbl">팀 / Team</td>
              <td>-</td>
              <td className="lbl">기밀등급</td>
              <td>-</td>
            </tr>
          </tbody>
        </table>

        <table className="print-body">
          <thead>
            <tr>
              <th rowSpan={2} style={{width:'2.5%'}}>No.</th>
              <th rowSpan={2} style={{width:'6%'}}>공정단계<br/>Process<br/>Step</th>
              <th rowSpan={2} style={{width:'7%'}}>공정기능<br/>및 요구사항<br/>Function/<br/>Requirement</th>
              <th rowSpan={2} style={{width:'7%'}}>잠재적<br/>고장모드<br/>Potential<br/>Failure Mode</th>
              <th rowSpan={2} style={{width:'6%'}}>잠재적<br/>고장영향<br/>Potential<br/>Effect</th>
              <th rowSpan={2} style={{width:'2%'}}>S</th>
              <th rowSpan={2} style={{width:'3%'}}>분류<br/>Class</th>
              <th rowSpan={2} style={{width:'7%'}}>잠재적<br/>고장원인<br/>Potential<br/>Cause</th>
              <th rowSpan={2} style={{width:'7%'}}>예방관리<br/>Prevention<br/>Control</th>
              <th rowSpan={2} style={{width:'2%'}}>O</th>
              <th rowSpan={2} style={{width:'7%'}}>검출관리<br/>Detection<br/>Control</th>
              <th rowSpan={2} style={{width:'2%'}}>D</th>
              <th rowSpan={2} style={{width:'3%'}}>AP<br/>(Action<br/>Priority)</th>
              <th rowSpan={2} style={{width:'9%'}}>권고조치<br/>Recommended<br/>Action</th>
              <th rowSpan={2} style={{width:'5%'}}>책임자<br/>/목표일</th>
              <th colSpan={5}>조치결과</th>
            </tr>
            <tr>
              <th style={{width:'8%'}}>조치내용<br/>Action Taken</th>
              <th style={{width:'2%'}}>S</th>
              <th style={{width:'2%'}}>O</th>
              <th style={{width:'2%'}}>D</th>
              <th style={{width:'2.5%'}}>AP</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.id}>
                <td className="c">{idx + 1}</td>
                <td>{line.process_step}</td>
                <td>{getCharNameForPrint(line.characteristic_id)}</td>
                <td>{line.potential_failure_mode}</td>
                <td>{line.potential_effect || ''}</td>
                <td className="c">{line.severity}</td>
                <td className="c">{getCharClass(line.characteristic_id)}</td>
                <td>{line.potential_cause || ''}</td>
                <td>{line.current_control_prevention || ''}</td>
                <td className="c">{line.occurrence}</td>
                <td>{line.current_control_detection || ''}</td>
                <td className="c">{line.detection}</td>
                <td className="c">{line.action_priority || ''}</td>
                <td>{line.recommended_action || ''}</td>
                <td></td>
                <td></td>
                <td className="c"></td>
                <td className="c"></td>
                <td className="c"></td>
                <td className="c"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="print-notes">
          <p>※ S: 심각도(Severity 1-10) / O: 발생도(Occurrence 1-10) / D: 검출도(Detection 1-10) / AP: 조치우선순위(H/M/L)</p>
          <p>※ AIAG &amp; VDA FMEA Handbook 기준 양식 | 분류(Class): CC=중요특성, SC=안전특성, 공란=일반특성</p>
        </div>

        <table className="print-approval">
          <tbody>
            <tr>
              <td className="lbl">작성</td>
              <td className="sign"></td>
              <td className="lbl">검토</td>
              <td className="sign"></td>
              <td className="lbl">승인</td>
              <td className="sign"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CharName({ charId }: { charId: string }) {
  const [char, setChar] = useState<{ name: string; type: string; category: string } | null>(null);
  useEffect(() => {
    characteristicStore.getById(charId).then((c) => {
      if (c) setChar({ name: c.name, type: c.type, category: c.category });
    });
  }, [charId]);
  if (!char) return <span className="text-gray-400">-</span>;
  return (
    <div>
      <div className="font-medium text-gray-900">{char.name}</div>
      <div className="text-xs text-gray-500">
        {char.type === 'product' ? '제품' : '공정'}
        {char.category === 'critical' && <span className="ml-1 text-red-600 font-bold">★</span>}
      </div>
    </div>
  );
}
