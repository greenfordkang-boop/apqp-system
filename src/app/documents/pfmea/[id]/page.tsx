'use client';

import { use, useState, useEffect } from 'react';
import Link from 'next/link';
import { pfmeaStore, characteristicStore, productStore } from '@/lib/store';
import type { PfmeaHeader, PfmeaLine } from '@/lib/store';

type EditingLine = PfmeaLine;

interface Product {
  id: string;
  name: string;
  code: string;
}

export default function PfmeaViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: pfmeaId } = use(params);

  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [pfmea, setPfmea] = useState<PfmeaHeader | null>(null);
  const [lines, setLines] = useState<PfmeaLine[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingLines, setEditingLines] = useState<Map<string, EditingLine>>(new Map());
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (pfmeaId) {
      fetchPfmea();
    }
  }, [pfmeaId]);

  async function fetchPfmea() {
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
      }

      const linesData = await pfmeaStore.getLines(pfmeaId);
      setLines(linesData);
    } catch (err) {
      console.error('Error fetching PFMEA:', err);
    }
    setLoading(false);
  }

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

  const handleEditingChange = (lineId: string, field: string, value: any) => {
    const current = editingLines.get(lineId);
    if (!current) return;

    const updated = { ...current, [field]: value };

    if (field === 'severity' || field === 'occurrence' || field === 'detection') {
      const num = Math.max(1, Math.min(10, parseInt(value) || 1));
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

  const handleStatusChange = async (newStatus: 'draft' | 'review' | 'approved') => {
    if (!pfmea) return;
    try {
      await pfmeaStore.updateHeaderStatus(pfmeaId, newStatus);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
            승인됨
          </span>
        );
      case 'review':
        return (
          <span className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
            검토중
          </span>
        );
      default:
        return (
          <span className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
            초안
          </span>
        );
    }
  };

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case 'H':
        return (
          <span className="inline-block px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded">
            H
          </span>
        );
      case 'M':
        return (
          <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded">
            M
          </span>
        );
      case 'L':
        return (
          <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded">
            L
          </span>
        );
      default:
        return <span className="text-gray-400">-</span>;
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

  if (!mounted) {
    return <div className="min-h-screen" />;
  }

  const highRiskCount = lines.filter((l) => l.rpn >= 200).length;
  const avgRpn = lines.length > 0 ? Math.round(lines.reduce((sum, l) => sum + l.rpn, 0) / lines.length) : 0;

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      <style>{`
        @media print {
          * {
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            border-color: #ddd !important;
          }
          body {
            margin: 0;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
          .print-header {
            page-break-after: avoid;
            margin-bottom: 20px;
          }
          .print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
          }
          .print-table th,
          .print-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          .print-table th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          .print-table tr:nth-child(even) {
            background-color: #fafafa;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
          }
        }
      `}</style>

      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                href="/documents/generate"
                className="no-print p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="돌아가기"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">PFMEA 분석</h1>
                <p className="text-sm text-gray-500">{product?.name || '제품'} · {pfmea.process_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {getStatusBadge(pfmea.status)}
              <span className="text-sm text-gray-500">Rev. {pfmea.revision}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Control Buttons */}
        <div className="no-print flex gap-3 mb-6 flex-wrap">
          {pfmea.status !== 'approved' && (
            <button
              onClick={handleEditModeToggle}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                isEditMode
                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              {isEditMode ? '취소' : '편집'}
            </button>
          )}

          {isEditMode && (
            <>
              <button
                onClick={handleSaveChanges}
                className="px-4 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg font-medium transition-all"
              >
                저장
              </button>
              <button
                onClick={handleCancel}
                className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
              >
                취소
              </button>
            </>
          )}

          {!isEditMode && (
            <>
              {pfmea.status === 'draft' && (
                <button
                  onClick={() => handleStatusChange('review')}
                  className="px-4 py-2 bg-yellow-100 text-yellow-700 hover:bg-yellow-200 rounded-lg font-medium transition-all"
                >
                  검토 요청
                </button>
              )}

              {pfmea.status === 'review' && (
                <>
                  <button
                    onClick={() => handleStatusChange('approved')}
                    className="px-4 py-2 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg font-medium transition-all"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => handleStatusChange('draft')}
                    className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg font-medium transition-all"
                  >
                    초안으로
                  </button>
                </>
              )}

              {pfmea.status === 'approved' && (
                <button
                  onClick={() => handleStatusChange('draft')}
                  className="px-4 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg font-medium transition-all"
                >
                  수정하기
                </button>
              )}

              <button
                onClick={handlePdfDownload}
                className="px-4 py-2 bg-indigo-100 text-indigo-700 hover:bg-indigo-200 rounded-lg font-medium transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8m0 8l-9-2m9 2l9-2m-9-8l9 2m-9-2l-9 2" />
                </svg>
                PDF 다운로드
              </button>
            </>
          )}
        </div>

        {/* Summary Statistics */}
        <div className="no-print grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-2">총 분석 항목</div>
            <div className="text-3xl font-bold text-blue-600">{lines.length}</div>
          </div>
          <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-2">고위험 (RPN ≥200)</div>
            <div className="text-3xl font-bold text-red-600">{highRiskCount}</div>
          </div>
          <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-2">중위험 (RPN ≥100)</div>
            <div className="text-3xl font-bold text-orange-600">
              {lines.filter((l) => l.rpn >= 100 && l.rpn < 200).length}
            </div>
          </div>
          <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl p-6 shadow-sm">
            <div className="text-sm font-medium text-gray-600 mb-2">평균 RPN</div>
            <div className="text-3xl font-bold text-gray-600">{avgRpn}</div>
          </div>
        </div>

        {/* PFMEA Table */}
        <div className="bg-white/70 backdrop-blur-md border border-white/20 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200/50">
            <h2 className="text-lg font-semibold text-gray-900">PFMEA 분석 항목</h2>
            <p className="text-sm text-gray-500 mt-1">{lines.length}개의 분석 항목</p>
          </div>

          {lines.length === 0 ? (
            <div className="p-8 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-500 font-medium">PFMEA 항목이 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className={`w-full text-sm ${isPrinting ? 'print-table' : ''}`}>
                <thead className="bg-gray-50/80 border-b border-gray-200/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">No</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">공정</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">특성명</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">잠재고장모드</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">잠재영향</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">S</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">원인</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">O</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">예방관리</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">검출관리</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">D</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">RPN</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-700">우선순위</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">권장조치</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/50">
                  {lines.map((line) => {
                    const displayLine = getDisplayLine(line.id);
                    const rpn = displayLine.rpn;

                    return (
                      <tr key={line.id} className="hover:bg-blue-50/50 transition-colors">
                        <td className="px-4 py-3 text-gray-700 font-medium">{lines.indexOf(line) + 1}</td>

                        {/* 공정 */}
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <input
                              type="text"
                              value={displayLine.process_step}
                              onChange={(e) =>
                                handleEditingChange(line.id, 'process_step', e.target.value)
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded font-medium"
                            />
                          ) : (
                            <span className="font-medium text-gray-900">{displayLine.process_step}</span>
                          )}
                        </td>

                        {/* 특성명 */}
                        <td className="px-4 py-3 text-sm">
                          {line.characteristic_id ? (
                            <CharName charId={line.characteristic_id} />
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        {/* 잠재고장모드 */}
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <textarea
                              value={displayLine.potential_failure_mode}
                              onChange={(e) =>
                                handleEditingChange(line.id, 'potential_failure_mode', e.target.value)
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                              rows={2}
                            />
                          ) : (
                            <span className="text-red-700 font-medium">{displayLine.potential_failure_mode}</span>
                          )}
                        </td>

                        {/* 잠재영향 */}
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <textarea
                              value={displayLine.potential_effect}
                              onChange={(e) =>
                                handleEditingChange(line.id, 'potential_effect', e.target.value)
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                              rows={2}
                            />
                          ) : (
                            <span className="text-gray-700">{displayLine.potential_effect}</span>
                          )}
                        </td>

                        {/* S */}
                        <td className="px-4 py-3 text-center">
                          {isEditMode ? (
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={displayLine.severity}
                              onChange={(e) =>
                                handleEditingChange(line.id, 'severity', e.target.value)
                              }
                              className="w-12 px-2 py-1 border border-gray-300 rounded text-center font-semibold"
                            />
                          ) : (
                            <span className="font-semibold text-gray-900">{displayLine.severity}</span>
                          )}
                        </td>

                        {/* 원인 */}
                        <td className="px-4 py-3">
                          {isEditMode ? (
                            <textarea
                              value={displayLine.potential_cause}
                              onChange={(e) =>
                                handleEditingChange(line.id, 'potential_cause', e.target.value)
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                              rows={2}
                            />
                          ) : (
                            <span className="text-gray-700">{displayLine.potential_cause}</span>
                          )}
                        </td>

                        {/* O */}
                        <td className="px-4 py-3 text-center">
                          {isEditMode ? (
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={displayLine.occurrence}
                              onChange={(e) =>
                                handleEditingChange(line.id, 'occurrence', e.target.value)
                              }
                              className="w-12 px-2 py-1 border border-gray-300 rounded text-center font-semibold"
                            />
                          ) : (
                            <span className="font-semibold text-gray-900">{displayLine.occurrence}</span>
                          )}
                        </td>

                        {/* 예방관리 */}
                        <td className="px-4 py-3 text-xs">
                          {isEditMode ? (
                            <input
                              type="text"
                              value={displayLine.current_control_prevention || ''}
                              onChange={(e) =>
                                handleEditingChange(line.id, 'current_control_prevention', e.target.value)
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded"
                            />
                          ) : (
                            <span className="text-gray-700">{displayLine.current_control_prevention || '-'}</span>
                          )}
                        </td>

                        {/* 검출관리 */}
                        <td className="px-4 py-3 text-xs">
                          {isEditMode ? (
                            <input
                              type="text"
                              value={displayLine.current_control_detection || ''}
                              onChange={(e) =>
                                handleEditingChange(line.id, 'current_control_detection', e.target.value)
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded"
                            />
                          ) : (
                            <span className="text-gray-700">{displayLine.current_control_detection || '-'}</span>
                          )}
                        </td>

                        {/* D */}
                        <td className="px-4 py-3 text-center">
                          {isEditMode ? (
                            <input
                              type="number"
                              min="1"
                              max="10"
                              value={displayLine.detection}
                              onChange={(e) =>
                                handleEditingChange(line.id, 'detection', e.target.value)
                              }
                              className="w-12 px-2 py-1 border border-gray-300 rounded text-center font-semibold"
                            />
                          ) : (
                            <span className="font-semibold text-gray-900">{displayLine.detection}</span>
                          )}
                        </td>

                        {/* RPN */}
                        <td className={`px-4 py-3 text-center ${getRpnColor(rpn)}`}>{rpn}</td>

                        {/* 우선순위 */}
                        <td className="px-4 py-3 text-center">
                          {isEditMode ? (
                            <select
                              value={displayLine.action_priority || ''}
                              onChange={(e) =>
                                handleEditingChange(line.id, 'action_priority', e.target.value)
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded text-center"
                            >
                              <option value="">-</option>
                              <option value="H">H</option>
                              <option value="M">M</option>
                              <option value="L">L</option>
                            </select>
                          ) : (
                            getPriorityBadge(displayLine.action_priority)
                          )}
                        </td>

                        {/* 권장조치 */}
                        <td className="px-4 py-3 text-xs">
                          {isEditMode ? (
                            <textarea
                              value={displayLine.recommended_action || ''}
                              onChange={(e) =>
                                handleEditingChange(line.id, 'recommended_action', e.target.value)
                              }
                              className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                              rows={2}
                            />
                          ) : (
                            <span className="text-gray-700">{displayLine.recommended_action || '-'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="no-print mt-6 text-center text-sm text-gray-500">
          <p>최종 업데이트: {new Date(pfmea.updated_at).toLocaleString('ko-KR')}</p>
        </div>
      </main>
    </div>
  );
}

function CharName({ charId }: { charId: string }) {
  const [char, setChar] = useState<{ name: string; type: string } | null>(null);
  useEffect(() => {
    characteristicStore.getById(charId).then((c) => {
      if (c) setChar({ name: c.name, type: c.type });
    });
  }, [charId]);
  if (!char) return <span className="text-gray-400">-</span>;
  return (
    <div>
      <div className="font-medium text-gray-900">{char.name}</div>
      <div className="text-xs text-gray-500">{char.type === 'product' ? '제품' : '공정'}</div>
    </div>
  );
}
