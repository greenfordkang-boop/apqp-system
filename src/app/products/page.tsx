'use client';

import { useState, useEffect, useMemo, Fragment } from 'react';
import Link from 'next/link';
import { productStore, characteristicStore, type Product, type Characteristic } from '@/lib/store';

type SortKey = 'customer' | 'vehicle_model' | 'name' | 'part_number' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterVehicle, setFilterVehicle] = useState('');
  const [filterName, setFilterName] = useState('');
  const [filterPartNo, setFilterPartNo] = useState('');

  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await loadProducts();
      setLoading(false);
    };
    load();
  }, []);

  async function loadProducts() {
    const allProducts = await productStore.getAll();
    setProducts(allProducts);
  }

  async function loadCharacteristics(productId: string) {
    if (selectedProductId === productId) {
      setSelectedProductId(null);
      setCharacteristics([]);
      return;
    }
    setSelectedProductId(productId);
    const chars = await characteristicStore.getByProductId(productId);
    setCharacteristics(chars);
  }

  async function deleteProduct(productId: string) {
    if (!confirm('정말로 이 제품을 삭제하시겠습니까?\n관련된 모든 특성이 함께 삭제됩니다.')) {
      return;
    }
    setDeleting(productId);
    try {
      await productStore.delete(productId);
      await loadProducts();
      if (selectedProductId === productId) {
        setSelectedProductId(null);
        setCharacteristics([]);
      }
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('제품 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(null);
    }
  }

  // Unique values for dropdown filters
  const uniqueCustomers = useMemo(() => [...new Set(products.map(p => p.customer).filter(Boolean))].sort(), [products]);
  const uniqueVehicles = useMemo(() => [...new Set(products.map(p => p.vehicle_model).filter(Boolean))].sort(), [products]);

  // Filtered & sorted products
  const filteredProducts = useMemo(() => {
    let result = products.filter(p => {
      if (filterCustomer && p.customer !== filterCustomer) return false;
      if (filterVehicle && p.vehicle_model !== filterVehicle) return false;
      if (filterName && !p.name.toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterPartNo && !p.part_number?.toLowerCase().includes(filterPartNo.toLowerCase())) return false;
      return true;
    });

    result.sort((a, b) => {
      const valA = (a[sortKey] ?? '').toString().toLowerCase();
      const valB = (b[sortKey] ?? '').toString().toLowerCase();
      const cmp = valA.localeCompare(valB, 'ko');
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [products, filterCustomer, filterVehicle, filterName, filterPartNo, sortKey, sortDir]);

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
  }

  const hasFilters = filterCustomer || filterVehicle || filterName || filterPartNo;

  const getCategoryBadge = (category: 'critical' | 'major' | 'minor') => {
    switch (category) {
      case 'critical':
        return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-medium">Critical</span>;
      case 'major':
        return <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full font-medium">Major</span>;
      default:
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-medium">Minor</span>;
    }
  };

  const getTypeBadge = (type: 'product' | 'process') => {
    return type === 'product'
      ? <span className="text-xs text-blue-600">제품특성</span>
      : <span className="text-xs text-purple-600">공정특성</span>;
  };

  if (loading) {
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
              <h1 className="text-2xl font-bold text-gray-900">제품 관리</h1>
              <span className="text-sm text-gray-400 ml-2">
                {filteredProducts.length}건{hasFilters ? ` / 전체 ${products.length}건` : ''}
              </span>
            </div>
            <Link
              href="/products/new"
              className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all text-sm"
            >
              + 신규 등록
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-8">
        {products.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl shadow-sm p-12 backdrop-blur-sm border border-gray-200/50">
              <p className="text-gray-500 mb-6 text-lg">등록된 제품이 없습니다</p>
              <Link
                href="/products/new"
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg inline-block font-semibold hover:shadow-lg hover:scale-105 transition-all"
              >
                첫 번째 제품 등록하기
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

            {/* Product Table */}
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
                      <th className="px-4 py-3 text-center text-gray-700 font-semibold whitespace-nowrap">상태</th>
                      <th
                        className="px-4 py-3 text-left text-gray-700 font-semibold cursor-pointer hover:text-blue-600 select-none whitespace-nowrap"
                        onClick={() => handleSort('created_at')}
                      >
                        등록일<SortIcon columnKey="created_at" />
                      </th>
                      <th className="px-4 py-3 text-center text-gray-700 font-semibold whitespace-nowrap w-[140px]">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                          {hasFilters ? '필터 조건에 맞는 제품이 없습니다' : '등록된 제품이 없습니다'}
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((product, idx) => (
                        <Fragment key={product.id}>
                          <tr
                            className={`border-t border-gray-100 transition-colors cursor-pointer ${
                              selectedProductId === product.id
                                ? 'bg-blue-50/70'
                                : idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-gray-50/30 hover:bg-gray-100/50'
                            }`}
                            onClick={() => loadCharacteristics(product.id)}
                          >
                            <td className="px-4 py-3 text-gray-900 font-medium">{product.customer || <span className="text-gray-300">-</span>}</td>
                            <td className="px-4 py-3 text-gray-700">{product.vehicle_model || <span className="text-gray-300">-</span>}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{product.name}</div>
                              {product.description && (
                                <div className="text-xs text-gray-400 mt-0.5 line-clamp-1">{product.description}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-700 text-xs">{product.part_number || <span className="text-gray-300">-</span>}</td>
                            <td className="px-4 py-3 text-center">
                              {product.status === 'active' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                  활성
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded-full font-medium">
                                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
                                  비활성
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                              {new Date(product.created_at).toLocaleDateString('ko-KR')}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                                <Link
                                  href={`/products/${product.id}/edit`}
                                  className="px-3 py-1.5 text-xs bg-white text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 font-medium transition-all"
                                >
                                  편집
                                </Link>
                                <button
                                  onClick={() => deleteProduct(product.id)}
                                  disabled={deleting === product.id}
                                  className="px-3 py-1.5 text-xs bg-white text-red-600 border border-red-200 rounded-md hover:bg-red-50 font-medium transition-all disabled:opacity-50"
                                >
                                  {deleting === product.id ? '...' : '삭제'}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Characteristics Row */}
                          {selectedProductId === product.id && (
                            <tr key={`${product.id}-chars`} className="bg-blue-50/30">
                              <td colSpan={7} className="px-4 py-4">
                                <div className="ml-4 border-l-2 border-blue-300 pl-4">
                                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                                    특성 목록
                                    <span className="ml-2 text-xs font-normal text-gray-400">({characteristics.length}건)</span>
                                  </h4>
                                  {characteristics.length > 0 ? (
                                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                      <table className="w-full text-xs">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                          <tr>
                                            <th className="px-3 py-2 text-left text-gray-600 font-semibold">특성명</th>
                                            <th className="px-3 py-2 text-left text-gray-600 font-semibold">유형</th>
                                            <th className="px-3 py-2 text-left text-gray-600 font-semibold">중요도</th>
                                            <th className="px-3 py-2 text-left text-gray-600 font-semibold">규격</th>
                                            <th className="px-3 py-2 text-left text-gray-600 font-semibold">공정</th>
                                            <th className="px-3 py-2 text-right text-gray-600 font-semibold">LSL/USL</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {characteristics.map((char, cIdx) => (
                                            <tr key={char.id} className={`border-t border-gray-100 ${cIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                                              <td className="px-3 py-2 font-medium text-gray-900">{char.name}</td>
                                              <td className="px-3 py-2">{getTypeBadge(char.type)}</td>
                                              <td className="px-3 py-2">{getCategoryBadge(char.category)}</td>
                                              <td className="px-3 py-2 text-gray-600">{char.specification || '-'}</td>
                                              <td className="px-3 py-2 text-gray-600">{char.process_name || '-'}</td>
                                              <td className="px-3 py-2 text-right text-gray-600">
                                                {char.lsl !== null && char.usl !== null ? (
                                                  <span className="font-mono">{char.lsl} ~ {char.usl} {char.unit}</span>
                                                ) : (
                                                  <span className="text-gray-400">-</span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-gray-400">등록된 특성이 없습니다</p>
                                  )}
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
