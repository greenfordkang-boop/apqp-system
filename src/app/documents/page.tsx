'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import Link from 'next/link';
import { productStore, characteristicStore, pfmeaStore, controlPlanStore, sopStore, inspectionStore } from '@/lib/store';

interface Product {
  id: string;
  name: string;
  code: string;
  customer: string;
  vehicle_model: string;
  part_number: string;
  description: string;
  status: string;
  created_at: string;
}

interface Document {
  id: string;
  status: 'draft' | 'review' | 'approved';
  itemCount: number;
  revision: number;
  createdAt: string;
}

interface ProductDocuments {
  product: Product;
  pfmea?: Document;
  controlPlan?: Document;
  sop?: Document;
  inspection?: Document;
  docCount: number;
  charCount: number;
}

type SortKey = 'customer' | 'vehicle_model' | 'name' | 'part_number' | 'docCount';
type SortDir = 'asc' | 'desc';

function getStatusBadge(doc?: Document) {
  if (!doc) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-400 text-xs rounded-full font-medium">
        <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>
        미생성
      </span>
    );
  }
  switch (doc.status) {
    case 'draft':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full font-medium">
          <span className="w-1.5 h-1.5 bg-gray-500 rounded-full"></span>
          작성중
        </span>
      );
    case 'review':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">
          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
          검토중
        </span>
      );
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
          승인됨
        </span>
      );
    default:
      return null;
  }
}

export default function DocumentsPage() {
  const [productDocuments, setProductDocuments] = useState<ProductDocuments[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Filter state
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterPartNo, setFilterPartNo] = useState('');
  const [filterDocStatus, setFilterDocStatus] = useState('');

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('customer');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // AI fix state
  const [fixingProductId, setFixingProductId] = useState<string | null>(null);
  const [fixResult, setFixResult] = useState<{ productId: string; summary: { generated: string[]; existing: string[] } } | null>(null);

  useEffect(() => {
    setMounted(true);
    loadProductDocuments();
  }, []);

  async function loadProductDocuments() {
    setLoading(true);
    try {
      const products = await productStore.getAll();

      const docsWithProducts: ProductDocuments[] = await Promise.all(
        products.map(async (product) => {
          const chars = await characteristicStore.getByProductId(product.id);
          const charCount = chars.length;

          const pfmeaHeader = await pfmeaStore.getHeaderByProductId(product.id);
          const pfmea = pfmeaHeader ? {
            id: pfmeaHeader.id,
            status: pfmeaHeader.status,
            itemCount: (await pfmeaStore.getLines(pfmeaHeader.id)).length,
            revision: pfmeaHeader.revision,
            createdAt: pfmeaHeader.created_at,
          } : undefined;

          const controlPlanHeader = await controlPlanStore.getByProductId(product.id);
          const controlPlan = controlPlanHeader ? {
            id: controlPlanHeader.id,
            status: controlPlanHeader.status,
            itemCount: (await controlPlanStore.getItems(controlPlanHeader.id)).length,
            revision: controlPlanHeader.revision,
            createdAt: controlPlanHeader.created_at,
          } : undefined;

          const sopHeader = await sopStore.getByProductId(product.id);
          const sop = sopHeader ? {
            id: sopHeader.id,
            status: sopHeader.status,
            itemCount: (await sopStore.getSteps(sopHeader.id)).length,
            revision: sopHeader.revision,
            createdAt: sopHeader.created_at,
          } : undefined;

          const inspectionHeader = await inspectionStore.getByProductId(product.id);
          const inspection = inspectionHeader ? {
            id: inspectionHeader.id,
            status: inspectionHeader.status,
            itemCount: (await inspectionStore.getItems(inspectionHeader.id)).length,
            revision: inspectionHeader.revision,
            createdAt: inspectionHeader.created_at,
          } : undefined;

          const docCount = [pfmea, controlPlan, sop, inspection].filter(Boolean).length;

          return { product, pfmea, controlPlan, sop, inspection, docCount, charCount } as ProductDocuments;
        })
      );

      // 특성이 있거나 문서가 있는 제품 모두 표시
      setProductDocuments(docsWithProducts.filter(d => d.docCount > 0 || d.charCount > 0));
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }

  // Unique values for dropdown filters
  const uniqueCustomers = useMemo(() =>
    [...new Set(productDocuments.map(d => d.product.customer).filter(Boolean))].sort(),
    [productDocuments]
  );
  const uniqueVehicles = useMemo(() =>
    [...new Set(productDocuments.map(d => d.product.vehicle_model).filter(Boolean))].sort(),
    [productDocuments]
  );

  // Filtered & sorted
  const filteredDocs = useMemo(() => {
    let result = productDocuments.filter(d => {
      if (filterCustomer && d.product.customer !== filterCustomer) return false;
      if (filterVehicle && d.product.vehicle_model !== filterVehicle) return false;
      if (filterName && !d.product.name.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterPartNo && !d.product.part_number?.toLowerCase().includes(filterPartNo.toLowerCase())) return false;
      if (filterDocStatus) {
        const docs = [d.pfmea, d.controlPlan, d.sop, d.inspection];
        if (filterDocStatus === 'complete') {
          if (docs.filter(Boolean).length < 4) return false;
        } else if (filterDocStatus === 'incomplete') {
          if (docs.filter(Boolean).length >= 4) return false;
        }
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortKey === 'docCount') {
        const cmp = a.docCount - b.docCount;
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const valA = (a.product[sortKey] ?? '').toString().toLowerCase();
      const valB = (b.product[sortKey] ?? '').toString().toLowerCase();
      const cmp = valA.localeCompare(valB, 'ko');
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [productDocuments, filterCustomer, filterVehicle, filterName, filterPartNo, filterDocStatus, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function SortIcon({ columnKey }: { columnKey: SortKey }) {
    if (sortKey !== columnKey) {
      return <span className="ml-1 text-gray-300 text-xs">↕</span>;
    }
    return <span className="ml-1 text-blue-600 text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  }

  function clearFilters() {
    setFilterCustomer('');
    setFilterVehicle('');
    setFilterName('');
    setFilterPartNo('');
    setFilterDocStatus('');
  }

  const hasFilters = filterCustomer || filterVehicle || filterName || filterPartNo || filterDocStatus;

  async function handleAiFix(productId: string) {
    if (fixingProductId) return;
    setFixingProductId(productId);
    setFixResult(null);
    try {
      const res = await fetch('/api/fix/traceability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      });
      const data = await res.json();
      if (data.success) {
        setFixResult({ productId, summary: data.summary });
        await loadProductDocuments();
      } else {
        alert(`AI 보완 실패: ${data.error}`);
      }
    } catch (err) {
      console.error('AI fix error:', err);
      alert('AI 보완 중 오류가 발생했습니다.');
    } finally {
      setFixingProductId(null);
    }
  }

  function toggleExpand(productId: string) {
    setExpandedId(prev => prev === productId ? null : productId);
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  }

  if (!mounted) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/70 border-b border-gray-200/50 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                ← 홈
              </Link>
              <div className="w-px h-6 bg-gray-200"></div>
              <h1 className="text-2xl font-bold text-gray-900">품질 문서 관리</h1>
              <span className="text-sm text-gray-400 ml-2">
                {filteredDocs.length}건{hasFilters ? ` / 전체 ${productDocuments.length}건` : ''}
              </span>
            </div>
            <Link
              href="/documents/generate"
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all text-sm"
            >
              문서 생성
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500 font-medium">로딩 중...</div>
          </div>
        ) : productDocuments.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl shadow-sm p-12 backdrop-blur-sm border border-gray-200/50">
              <p className="text-gray-500 mb-2 text-lg">생성된 문서가 없습니다</p>
              <p className="text-gray-400 mb-6 text-sm">먼저 제품을 등록한 후 문서를 생성해주세요.</p>
              <Link
                href="/products/new"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg inline-block font-semibold hover:shadow-lg hover:scale-105 transition-all"
              >
                제품 등록하기
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-gray-700 shrink-0">필터</span>
                <div className="w-px h-6 bg-gray-200 shrink-0"></div>

                <select
                  value={filterCustomer}
                  onChange={e => setFilterCustomer(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
                >
                  <option value="">고객사 전체</option>
                  {uniqueCustomers.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>

                <select
                  value={filterVehicle}
                  onChange={e => setFilterVehicle(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
                >
                  <option value="">차종 전체</option>
                  {uniqueVehicles.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="품명 검색..."
                  value={filterName}
                  onChange={e => setFilterName(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[160px]"
                />

                <input
                  type="text"
                  placeholder="Part No 검색..."
                  value={filterPartNo}
                  onChange={e => setFilterPartNo(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[160px]"
                />

                <select
                  value={filterDocStatus}
                  onChange={e => setFilterDocStatus(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[140px]"
                >
                  <option value="">문서상태 전체</option>
                  <option value="complete">전체 완비 (4종)</option>
                  <option value="incomplete">미완성</option>
                </select>

                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium shrink-0"
                  >
                    초기화
                  </button>
                )}
              </div>
            </div>

            {/* Document Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                    <tr>
                      <th
                        className="px-4 py-3 text-left text-gray-700 font-semibold cursor-pointer hover:text-blue-600 select-none whitespace-nowrap"
                        onClick={() => handleSort('customer')}
                      >
                        고객사<SortIcon columnKey="customer" />
                      </th>
                      <th
                        className="px-4 py-3 text-left text-gray-700 font-semibold cursor-pointer hover:text-blue-600 select-none whitespace-nowrap"
                        onClick={() => handleSort('vehicle_model')}
                      >
                        차종<SortIcon columnKey="vehicle_model" />
                      </th>
                      <th
                        className="px-4 py-3 text-left text-gray-700 font-semibold cursor-pointer hover:text-blue-600 select-none whitespace-nowrap"
                        onClick={() => handleSort('name')}
                      >
                        품명<SortIcon columnKey="name" />
                      </th>
                      <th
                        className="px-4 py-3 text-left text-gray-700 font-semibold cursor-pointer hover:text-blue-600 select-none whitespace-nowrap"
                        onClick={() => handleSort('part_number')}
                      >
                        Part No<SortIcon columnKey="part_number" />
                      </th>
                      <th className="px-3 py-3 text-center text-gray-700 font-semibold whitespace-nowrap">PFMEA</th>
                      <th className="px-3 py-3 text-center text-gray-700 font-semibold whitespace-nowrap">관리계획서</th>
                      <th className="px-3 py-3 text-center text-gray-700 font-semibold whitespace-nowrap">작업표준서</th>
                      <th className="px-3 py-3 text-center text-gray-700 font-semibold whitespace-nowrap">검사기준서</th>
                      <th className="px-3 py-3 text-center text-gray-700 font-semibold whitespace-nowrap">추적성</th>
                      <th
                        className="px-3 py-3 text-center text-gray-700 font-semibold cursor-pointer hover:text-blue-600 select-none whitespace-nowrap"
                        onClick={() => handleSort('docCount')}
                      >
                        완성<SortIcon columnKey="docCount" />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocs.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-gray-400">
                          {hasFilters ? '필터 조건에 맞는 문서가 없습니다' : '생성된 문서가 없습니다'}
                        </td>
                      </tr>
                    ) : (
                      filteredDocs.map((doc, idx) => (
                        <Fragment key={doc.product.id}>
                          <tr
                            className={`border-t border-gray-100 transition-colors cursor-pointer ${
                              expandedId === doc.product.id
                                ? 'bg-blue-50/70'
                                : idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/30 hover:bg-gray-100/50'
                            }`}
                            onClick={() => toggleExpand(doc.product.id)}
                          >
                            <td className="px-4 py-3 text-gray-900 font-medium">{doc.product.customer || <span className="text-gray-300">-</span>}</td>
                            <td className="px-4 py-3 text-gray-700">{doc.product.vehicle_model || <span className="text-gray-300">-</span>}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{doc.product.name}</div>
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-700 text-xs">{doc.product.part_number || <span className="text-gray-300">-</span>}</td>
                            <td className="px-3 py-3 text-center">{getStatusBadge(doc.pfmea)}</td>
                            <td className="px-3 py-3 text-center">{getStatusBadge(doc.controlPlan)}</td>
                            <td className="px-3 py-3 text-center">{getStatusBadge(doc.sop)}</td>
                            <td className="px-3 py-3 text-center">{getStatusBadge(doc.inspection)}</td>
                            <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                              {doc.charCount === 0 ? (
                                <Link
                                  href={`/products/${doc.product.id}/edit`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  특성 등록 필요
                                </Link>
                              ) : doc.docCount >= 4 ? (
                                <Link
                                  href={`/documents/traceability/${doc.product.id}`}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                                >
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  완전
                                </Link>
                              ) : (
                                <div className="flex items-center justify-center gap-1.5">
                                  <Link
                                    href={`/documents/traceability/${doc.product.id}`}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                                  >
                                    누락 {4 - doc.docCount}
                                  </Link>
                                  <button
                                    onClick={() => handleAiFix(doc.product.id)}
                                    disabled={fixingProductId !== null}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full font-semibold transition-all ${
                                      fixingProductId === doc.product.id
                                        ? 'bg-purple-200 text-purple-700 animate-pulse'
                                        : 'bg-purple-600 text-white hover:bg-purple-700 hover:scale-105 disabled:opacity-50 disabled:hover:scale-100'
                                    }`}
                                  >
                                    {fixingProductId === doc.product.id ? (
                                      <>
                                        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                        </svg>
                                        AI 생성중
                                      </>
                                    ) : (
                                      <>
                                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                        </svg>
                                        AI 보완
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                              {fixResult?.productId === doc.product.id && (
                                <div className="mt-1 text-[10px] text-green-600 font-medium">
                                  {fixResult.summary.generated.length > 0
                                    ? `${fixResult.summary.generated.join(', ')} 생성 완료`
                                    : '이미 모두 존재'}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className={`text-xs font-bold ${doc.docCount >= 4 ? 'text-green-600' : doc.docCount >= 2 ? 'text-amber-600' : 'text-gray-500'}`}>
                                {doc.docCount}/4
                              </span>
                            </td>
                          </tr>

                          {/* Expanded Detail Row */}
                          {expandedId === doc.product.id && (
                            <tr className="bg-blue-50/30">
                              <td colSpan={10} className="px-4 py-4">
                                <div className="ml-4 border-l-2 border-blue-300 pl-4">
                                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    {/* PFMEA */}
                                    <DocDetailCard
                                      label="PFMEA"
                                      doc={doc.pfmea}
                                      href={doc.pfmea ? `/documents/pfmea/${doc.pfmea.id}` : undefined}
                                      formatDate={formatDate}
                                    />
                                    {/* Control Plan */}
                                    <DocDetailCard
                                      label="관리계획서"
                                      doc={doc.controlPlan}
                                      href={doc.controlPlan ? `/documents/control-plan/${doc.controlPlan.id}` : undefined}
                                      formatDate={formatDate}
                                    />
                                    {/* SOP */}
                                    <DocDetailCard
                                      label="작업표준서"
                                      doc={doc.sop}
                                      href={doc.sop ? `/documents/sop/${doc.sop.id}` : undefined}
                                      formatDate={formatDate}
                                    />
                                    {/* Inspection */}
                                    <DocDetailCard
                                      label="검사기준서"
                                      doc={doc.inspection}
                                      href={doc.inspection ? `/documents/inspection/${doc.inspection.id}` : undefined}
                                      formatDate={formatDate}
                                    />
                                  </div>

                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function DocDetailCard({
  label,
  doc,
  href,
  formatDate,
}: {
  label: string;
  doc?: Document;
  href?: string;
  formatDate: (d: string) => string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3" onClick={e => e.stopPropagation()}>
      <div className="text-xs font-semibold text-gray-500 mb-2">{label}</div>
      {doc ? (
        <div className="space-y-1.5">
          {getStatusBadge(doc)}
          <div className="text-xs text-gray-500">{doc.itemCount}개 항목 · v{doc.revision}</div>
          <div className="text-xs text-gray-400">{formatDate(doc.createdAt)}</div>
          {href && (
            <Link
              href={href}
              className="inline-block mt-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              보기 →
            </Link>
          )}
        </div>
      ) : (
        <div className="text-xs text-gray-400">미생성</div>
      )}
    </div>
  );
}
