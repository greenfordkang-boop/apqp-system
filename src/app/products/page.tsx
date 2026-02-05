'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Product {
  id: string;
  name: string;
  code: string;
  customer: string | null;
  description: string | null;
  status: string;
  created_at: string;
}

interface Characteristic {
  id: string;
  name: string;
  type: string;
  category: string;
  specification: string | null;
  usl: number | null;
  lsl: number | null;
  unit: string | null;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  async function fetchProducts() {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProducts(data);
    }
    setLoading(false);
  }

  async function loadCharacteristics(productId: string) {
    setSelectedProduct(productId);

    // Characteristics are directly linked to product_id
    const { data: chars, error } = await supabase
      .from('characteristics')
      .select('*')
      .eq('product_id', productId);

    if (!error && chars) {
      setCharacteristics(chars);
    } else {
      setCharacteristics([]);
    }
  }

  async function deleteProduct(productId: string) {
    if (!confirm('정말로 이 제품을 삭제하시겠습니까?\n관련된 모든 특성, PFMEA, Control Plan 등이 함께 삭제됩니다.')) {
      return;
    }

    setDeleting(productId);
    try {
      // Delete related data in order (due to foreign key constraints)
      // 1. Get PFMEA for this product
      const { data: pfmea } = await supabase
        .from('pfmea_headers')
        .select('id')
        .eq('project_id', productId)
        .single();

      if (pfmea) {
        // Get Control Plans for this PFMEA
        const { data: controlPlans } = await supabase
          .from('control_plans')
          .select('id')
          .eq('pfmea_id', pfmea.id);

        if (controlPlans) {
          for (const cp of controlPlans) {
            // Delete SOPs for this Control Plan
            await supabase.from('sops').delete().eq('control_plan_id', cp.id);
            // Delete Inspection Standards
            await supabase.from('inspection_standards').delete().eq('control_plan_id', cp.id);
            // Delete Control Plan Items
            await supabase.from('control_plan_items').delete().eq('control_plan_id', cp.id);
          }
          // Delete Control Plans
          await supabase.from('control_plans').delete().eq('pfmea_id', pfmea.id);
        }

        // Delete PFMEA Lines
        await supabase.from('pfmea_lines').delete().eq('pfmea_id', pfmea.id);
        // Delete PFMEA Header
        await supabase.from('pfmea_headers').delete().eq('id', pfmea.id);
      }

      // Delete Characteristics
      await supabase.from('characteristics').delete().eq('product_id', productId);

      // Delete Processes (if any linked to this product code)
      const product = products.find(p => p.id === productId);
      if (product) {
        await supabase.from('processes').delete().eq('code', `${product.code}-PROC-001`);
      }

      // Finally delete the product
      const { error } = await supabase.from('products').delete().eq('id', productId);

      if (error) throw error;

      // Refresh products list
      setProducts(products.filter(p => p.id !== productId));
      if (selectedProduct === productId) {
        setSelectedProduct(null);
        setCharacteristics([]);
      }
    } catch (err) {
      console.error('Error deleting product:', err);
      alert('제품 삭제 중 오류가 발생했습니다.');
    } finally {
      setDeleting(null);
    }
  }

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'critical':
        return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Critical</span>;
      case 'major':
        return <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">Major</span>;
      default:
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">Minor</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-white/80 hover:text-white">← 홈</Link>
              <h1 className="text-2xl font-bold">제품 관리</h1>
            </div>
            <Link
              href="/products/new"
              className="px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50"
            >
              + 신규 등록
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-12">로딩 중...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500 mb-4">등록된 제품이 없습니다</p>
            <Link
              href="/products/new"
              className="px-6 py-3 bg-blue-600 text-white rounded-lg inline-block"
            >
              첫 번째 제품 등록하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Products List */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">제품 목록</h2>
              <div className="space-y-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className={`bg-white rounded-lg shadow p-4 transition-all ${
                      selectedProduct === product.id
                        ? 'ring-2 ring-blue-500'
                        : 'hover:shadow-md'
                    }`}
                  >
                    <div
                      className="cursor-pointer"
                      onClick={() => loadCharacteristics(product.id)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-800">{product.name}</h3>
                          <p className="text-sm text-gray-500">{product.code}</p>
                          {product.customer && (
                            <p className="text-sm text-gray-400">고객: {product.customer}</p>
                          )}
                          {product.description && (
                            <p className="text-xs text-gray-400 mt-1">{product.description}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(product.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <Link
                        href={`/products/${product.id}/edit`}
                        className="flex-1 text-center px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                      >
                        수정
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProduct(product.id);
                        }}
                        disabled={deleting === product.id}
                        className="flex-1 px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
                      >
                        {deleting === product.id ? '삭제 중...' : '삭제'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Characteristics */}
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">특성 목록</h2>
              {selectedProduct ? (
                characteristics.length > 0 ? (
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left">특성명</th>
                          <th className="px-4 py-3 text-left">유형</th>
                          <th className="px-4 py-3 text-left">중요도</th>
                          <th className="px-4 py-3 text-right">규격</th>
                        </tr>
                      </thead>
                      <tbody>
                        {characteristics.map((char) => (
                          <tr key={char.id} className="border-t">
                            <td className="px-4 py-3 font-medium">{char.name}</td>
                            <td className="px-4 py-3 text-gray-500">
                              {char.type === 'product' ? '제품' : '공정'}
                            </td>
                            <td className="px-4 py-3">
                              {getCategoryBadge(char.category)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {char.specification ? (
                                <span>{char.specification}</span>
                              ) : char.lsl !== null && char.usl !== null ? (
                                <span>
                                  {char.lsl} ~ {char.usl}
                                  <span className="text-gray-400 ml-1">{char.unit}</span>
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
                ) : (
                  <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                    등록된 특성이 없습니다
                  </div>
                )
              ) : (
                <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                  제품을 선택하면 특성 목록이 표시됩니다
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
