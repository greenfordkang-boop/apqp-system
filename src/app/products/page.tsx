'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { productStore, characteristicStore, type Product, type Characteristic } from '@/lib/store';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
                ← 홈
              </Link>
              <div className="w-px h-6 bg-gray-200"></div>
              <h1 className="text-2xl font-bold text-gray-900">제품 관리</h1>
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

      <main className="max-w-7xl mx-auto px-6 py-8">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Products List - Left Column */}
            <div className="lg:col-span-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">제품 목록</h2>
              <div className="space-y-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className={`group bg-white rounded-xl shadow-sm border-2 transition-all duration-200 cursor-pointer overflow-hidden ${
                      selectedProductId === product.id
                        ? 'border-blue-400 ring-1 ring-blue-200 shadow-md'
                        : 'border-gray-200/50 hover:border-gray-300 hover:shadow-md'
                    }`}
                    onClick={() => loadCharacteristics(product.id)}
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors">{product.name}</h3>
                        <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                          {new Date(product.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">
                        <span className="font-medium text-gray-700">코드:</span> {product.code}
                      </p>
                      {product.customer && (
                        <p className="text-sm text-gray-600 mb-1">
                          <span className="font-medium text-gray-700">고객:</span> {product.customer}
                        </p>
                      )}
                      {product.description && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-2">{product.description}</p>
                      )}
                      <div className="mt-3 inline-block">
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
                          특성 {characteristics.length}개
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-50 border-t border-gray-100">
                      <Link
                        href={`/products/${product.id}/edit`}
                        className="flex-1 text-center px-3 py-2 text-sm bg-white text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 font-semibold transition-all"
                      >
                        편집
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProduct(product.id);
                        }}
                        disabled={deleting === product.id}
                        className="flex-1 px-3 py-2 text-sm bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 font-semibold transition-all disabled:opacity-50"
                      >
                        {deleting === product.id ? '삭제 중...' : '삭제'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Characteristics Table - Right Columns */}
            <div className="lg:col-span-2">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">특성 목록</h2>
              {selectedProductId ? (
                characteristics.length > 0 ? (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 overflow-hidden backdrop-blur-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gradient-to-r from-gray-50 to-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-gray-700 font-semibold">특성명</th>
                            <th className="px-4 py-3 text-left text-gray-700 font-semibold">유형</th>
                            <th className="px-4 py-3 text-left text-gray-700 font-semibold">중요도</th>
                            <th className="px-4 py-3 text-left text-gray-700 font-semibold">규격</th>
                            <th className="px-4 py-3 text-right text-gray-700 font-semibold">LSL/USL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {characteristics.map((char, idx) => (
                            <tr key={char.id} className={`border-t border-gray-100 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-blue-50/50`}>
                              <td className="px-4 py-3 font-medium text-gray-900">{char.name}</td>
                              <td className="px-4 py-3">{getTypeBadge(char.type)}</td>
                              <td className="px-4 py-3">{getCategoryBadge(char.category)}</td>
                              <td className="px-4 py-3 text-gray-600 text-xs">
                                {char.specification || '-'}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-600 text-xs">
                                {char.lsl !== null && char.usl !== null ? (
                                  <span className="font-mono">
                                    {char.lsl} ~ {char.usl} {char.unit}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 p-8 text-center">
                    <p className="text-gray-500">등록된 특성이 없습니다</p>
                  </div>
                )
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200/50 p-8 text-center">
                  <p className="text-gray-500">제품을 선택하면 특성 목록이 표시됩니다</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
