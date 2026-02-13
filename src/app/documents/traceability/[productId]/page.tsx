'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import {
  productStore, characteristicStore, pfmeaStore, controlPlanStore, sopStore, inspectionStore,
  Product, Characteristic, PfmeaHeader, PfmeaLine, ControlPlan, ControlPlanItem, Sop, SopStep, InspectionStandard, InspectionItem,
} from '@/lib/store';

// --- 추적성 행 타입 ---
interface TraceRow {
  characteristic: Characteristic;
  pfmeaLine?: PfmeaLine;
  cpPrevention?: ControlPlanItem;
  cpDetection?: ControlPlanItem;
  sopStep?: SopStep;
  inspectionItem?: InspectionItem;
}

interface DocIds {
  pfmeaId?: string;
  cpId?: string;
  sopId?: string;
  inspectionId?: string;
}

export default function TraceabilityPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = use(params);
  const [product, setProduct] = useState<Product | null>(null);
  const [rows, setRows] = useState<TraceRow[]>([]);
  const [docIds, setDocIds] = useState<DocIds>({});
  const [loading, setLoading] = useState(true);
  const [filterMissing, setFilterMissing] = useState(false);

  useEffect(() => {
    loadTraceability();
  }, [productId]);

  async function loadTraceability() {
    setLoading(true);
    try {
      const [prod, chars] = await Promise.all([
        productStore.getById(productId),
        characteristicStore.getByProductId(productId),
      ]);
      setProduct(prod);
      if (!prod || chars.length === 0) { setLoading(false); return; }

      // 문서 헤더 로드
      const [pfmeaHeader, cp, sop, inspection] = await Promise.all([
        pfmeaStore.getHeaderByProductId(productId),
        controlPlanStore.getByProductId(productId),
        sopStore.getByProductId(productId),
        inspectionStore.getByProductId(productId),
      ]);

      setDocIds({
        pfmeaId: pfmeaHeader?.id,
        cpId: cp?.id,
        sopId: sop?.id,
        inspectionId: inspection?.id,
      });

      // 각 문서의 아이템 로드
      const [pfmeaLines, cpItems, sopSteps, inspItems] = await Promise.all([
        pfmeaHeader ? pfmeaStore.getLines(pfmeaHeader.id) : Promise.resolve([]),
        cp ? controlPlanStore.getItems(cp.id) : Promise.resolve([]),
        sop ? sopStore.getSteps(sop.id) : Promise.resolve([]),
        inspection ? inspectionStore.getItems(inspection.id) : Promise.resolve([]),
      ]);

      // 특성별 매트릭스 구성
      const traceRows: TraceRow[] = chars.map(char => {
        const pfmeaLine = pfmeaLines.find(l => l.characteristic_id === char.id);
        const cpPrevention = cpItems.find(i => i.characteristic_id === char.id && i.control_type === 'prevention');
        const cpDetection = cpItems.find(i => i.characteristic_id === char.id && i.control_type === 'detection');
        const sopStep = sopSteps.find(s => s.linked_cp_item_id === cpPrevention?.id);
        const inspectionItem = inspItems.find(i => i.characteristic_id === char.id);
        return { characteristic: char, pfmeaLine, cpPrevention, cpDetection, sopStep, inspectionItem };
      });

      setRows(traceRows);
    } catch (err) {
      console.error('Traceability load error:', err);
    } finally {
      setLoading(false);
    }
  }

  // --- 커버리지 계산 ---
  const total = rows.length;
  const pfmeaCov = rows.filter(r => r.pfmeaLine).length;
  const cpPrevCov = rows.filter(r => r.cpPrevention).length;
  const cpDetCov = rows.filter(r => r.cpDetection).length;
  const sopCov = rows.filter(r => r.sopStep).length;
  const inspCov = rows.filter(r => r.inspectionItem).length;
  const fullCov = rows.filter(r => r.pfmeaLine && r.cpPrevention && r.cpDetection && r.sopStep && r.inspectionItem).length;
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  const displayRows = filterMissing
    ? rows.filter(r => !r.pfmeaLine || !r.cpPrevention || !r.cpDetection || !r.sopStep || !r.inspectionItem)
    : rows;

  const missingCount = rows.length - fullCov;

  // AP 색상
  const apColor = (ap?: string) => {
    if (ap === 'H') return 'bg-red-100 text-red-700';
    if (ap === 'M') return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  };

  // 카테고리 색상
  const catColor = (cat: string) => {
    if (cat === 'critical') return 'bg-red-600 text-white';
    if (cat === 'major') return 'bg-amber-500 text-white';
    return 'bg-gray-400 text-white';
  };
  const catLabel = (cat: string) => {
    if (cat === 'critical') return 'CC';
    if (cat === 'major') return 'SC';
    return 'MI';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">추적성 매트릭스 로딩 중...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">제품을 찾을 수 없습니다</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/documents" className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </Link>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">추적성 매트릭스</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                  {product.name} {product.customer && `| ${product.customer}`} {product.part_number && `| ${product.part_number}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setFilterMissing(!filterMissing)}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  filterMissing
                    ? 'bg-red-50 border-red-200 text-red-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {filterMissing ? `누락 항목만 (${missingCount})` : '누락 필터'}
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                인쇄
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-6">
        {/* Coverage Summary */}
        <div className="grid grid-cols-2 md:grid-cols-7 gap-3 mb-6">
          <CoverageCard label="전체 커버리지" value={pct(fullCov)} count={`${fullCov}/${total}`} highlight />
          <CoverageCard label="PFMEA" value={pct(pfmeaCov)} count={`${pfmeaCov}/${total}`} />
          <CoverageCard label="CP(예방)" value={pct(cpPrevCov)} count={`${cpPrevCov}/${total}`} />
          <CoverageCard label="CP(검출)" value={pct(cpDetCov)} count={`${cpDetCov}/${total}`} />
          <CoverageCard label="SOP" value={pct(sopCov)} count={`${sopCov}/${total}`} />
          <CoverageCard label="검사기준서" value={pct(inspCov)} count={`${inspCov}/${total}`} />
          <div className="rounded-xl border border-gray-200 p-3 flex flex-col justify-center items-center">
            <div className="text-xs text-gray-500 mb-1">누락 항목</div>
            <div className={`text-xl font-bold ${missingCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {missingCount}
            </div>
          </div>
        </div>

        {/* Document Quick Links */}
        <div className="flex flex-wrap gap-2 mb-6">
          {docIds.pfmeaId && (
            <Link href={`/documents/pfmea/${docIds.pfmeaId}`} className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors">
              PFMEA 보기
            </Link>
          )}
          {docIds.cpId && (
            <Link href={`/documents/control-plan/${docIds.cpId}`} className="px-3 py-1.5 text-xs font-medium bg-purple-50 text-purple-700 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors">
              관리계획서 보기
            </Link>
          )}
          {docIds.sopId && (
            <Link href={`/documents/sop/${docIds.sopId}`} className="px-3 py-1.5 text-xs font-medium bg-orange-50 text-orange-700 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors">
              작업표준서 보기
            </Link>
          )}
          {docIds.inspectionId && (
            <Link href={`/documents/inspection/${docIds.inspectionId}`} className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 transition-colors">
              검사기준서 보기
            </Link>
          )}
        </div>

        {/* Matrix Table */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 w-8">#</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 min-w-[140px]">특성<br/><span className="font-normal text-gray-400">Characteristic</span></th>
                  <th className="px-3 py-3 text-center text-xs font-semibold text-gray-600 w-12">등급</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 min-w-[180px]">PFMEA<br/><span className="font-normal text-gray-400">Risk Analysis</span></th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 min-w-[140px]">CP 예방<br/><span className="font-normal text-gray-400">Prevention</span></th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 min-w-[140px]">CP 검출<br/><span className="font-normal text-gray-400">Detection</span></th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 min-w-[140px]">SOP<br/><span className="font-normal text-gray-400">Work Instruction</span></th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 min-w-[140px]">검사기준서<br/><span className="font-normal text-gray-400">Inspection</span></th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                      {filterMissing ? '누락 항목이 없습니다' : '특성 데이터가 없습니다'}
                    </td>
                  </tr>
                ) : displayRows.map((row, idx) => {
                  const isFull = !!row.pfmeaLine && !!row.cpPrevention && !!row.cpDetection && !!row.sopStep && !!row.inspectionItem;
                  return (
                    <tr key={row.characteristic.id} className={`border-b border-gray-100 hover:bg-gray-50/50 ${!isFull ? 'bg-red-50/30' : ''}`}>
                      <td className="px-3 py-3 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-900 text-sm">{row.characteristic.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{row.characteristic.process_name || '-'}</div>
                        {row.characteristic.specification && (
                          <div className="text-xs text-gray-400 mt-0.5">
                            {row.characteristic.specification}
                            {row.characteristic.lsl !== null && row.characteristic.usl !== null && (
                              <span> ({row.characteristic.lsl}~{row.characteristic.usl}{row.characteristic.unit})</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-block px-1.5 py-0.5 text-[10px] font-bold rounded ${catColor(row.characteristic.category)}`}>
                          {catLabel(row.characteristic.category)}
                        </span>
                      </td>
                      {/* PFMEA */}
                      <td className="px-3 py-3">
                        {row.pfmeaLine ? (
                          <div>
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${apColor(row.pfmeaLine.action_priority)}`}>
                                AP:{row.pfmeaLine.action_priority}
                              </span>
                              <span className="text-xs text-gray-500">
                                S{row.pfmeaLine.severity}/O{row.pfmeaLine.occurrence}/D{row.pfmeaLine.detection}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{row.pfmeaLine.potential_failure_mode}</div>
                            <div className="text-[10px] text-gray-400">RPN: {row.pfmeaLine.rpn}</div>
                          </div>
                        ) : <MissingBadge />}
                      </td>
                      {/* CP Prevention */}
                      <td className="px-3 py-3">
                        {row.cpPrevention ? (
                          <div>
                            <div className="text-xs text-gray-700 truncate max-w-[150px]">{row.cpPrevention.control_method}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{row.cpPrevention.frequency} / {row.cpPrevention.sample_size}</div>
                          </div>
                        ) : <MissingBadge />}
                      </td>
                      {/* CP Detection */}
                      <td className="px-3 py-3">
                        {row.cpDetection ? (
                          <div>
                            <div className="text-xs text-gray-700 truncate max-w-[150px]">{row.cpDetection.control_method}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{row.cpDetection.frequency} / {row.cpDetection.sample_size}</div>
                          </div>
                        ) : <MissingBadge />}
                      </td>
                      {/* SOP */}
                      <td className="px-3 py-3">
                        {row.sopStep ? (
                          <div>
                            <div className="text-xs text-gray-700 truncate max-w-[150px]">{row.sopStep.process_step}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[150px]">{row.sopStep.action}</div>
                          </div>
                        ) : <MissingBadge />}
                      </td>
                      {/* Inspection */}
                      <td className="px-3 py-3">
                        {row.inspectionItem ? (
                          <div>
                            <div className="text-xs text-gray-700">{row.inspectionItem.inspection_method}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{row.inspectionItem.frequency} / {row.inspectionItem.sample_size}</div>
                          </div>
                        ) : <MissingBadge />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span> CC: 중요특성 (Critical)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> SC: 주요특성 (Significant)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span> MI: 일반특성 (Minor)
          </span>
          <span className="mx-2 text-gray-300">|</span>
          <span className="flex items-center gap-1.5">
            <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-600">누락</span> 문서 미연계
          </span>
        </div>
      </main>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          header, button, .no-print { display: none !important; }
          main { max-width: 100% !important; padding: 0 !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { font-size: 9px !important; }
          th, td { padding: 4px 6px !important; }
          @page { size: A3 landscape; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}

function CoverageCard({ label, value, count, highlight }: { label: string; value: number; count: string; highlight?: boolean }) {
  const barColor = value === 100 ? 'bg-green-500' : value >= 80 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className={`rounded-xl border p-3 ${highlight ? 'border-blue-200 bg-blue-50/50' : 'border-gray-200'}`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-lg font-bold ${value === 100 ? 'text-green-600' : value >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
        {value}%
      </div>
      <div className="text-[10px] text-gray-400 mb-1.5">{count}</div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function MissingBadge() {
  return (
    <span className="inline-block px-2 py-1 text-[10px] font-medium bg-red-100 text-red-600 rounded">
      누락
    </span>
  );
}
