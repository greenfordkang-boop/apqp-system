'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Product {
  id: string;
  name: string;
  code: string;
  customer: string | null;
  model_year: string | null;
  created_at: string;
}

interface Characteristic {
  id: string;
  name: string;
  type: string;
  nominal: number;
  usl: number | null;
  lsl: number | null;
  unit: string;
  is_critical: boolean;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [characteristics, setCharacteristics] = useState<Characteristic[]>([]);

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

    // First get processes for this product
    const { data: processes } = await supabase
      .from('processes')
      .select('id')
      .eq('product_id', productId);

    if (processes && processes.length > 0) {
      const processIds = processes.map(p => p.id);
      const { data: chars } = await supabase
        .from('characteristics')
        .select('*')
        .in('process_id', processIds)
        .order('sequence');

      if (chars) {
        setCharacteristics(chars);
      }
    } else {
      setCharacteristics([]);
    }
  }

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
                    onClick={() => loadCharacteristics(product.id)}
                    className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
                      selectedProduct === product.id
                        ? 'ring-2 ring-blue-500'
                        : 'hover:shadow-md'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-800">{product.name}</h3>
                        <p className="text-sm text-gray-500">{product.code}</p>
                        {product.customer && (
                          <p className="text-sm text-gray-400">고객: {product.customer}</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(product.created_at).toLocaleDateString('ko-KR')}
                      </span>
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
                          <th className="px-4 py-3 text-right">규격</th>
                          <th className="px-4 py-3 text-center">중요</th>
                        </tr>
                      </thead>
                      <tbody>
                        {characteristics.map((char) => (
                          <tr key={char.id} className="border-t">
                            <td className="px-4 py-3 font-medium">{char.name}</td>
                            <td className="px-4 py-3 text-gray-500">{char.type}</td>
                            <td className="px-4 py-3 text-right">
                              {char.nominal}
                              {char.usl && char.lsl && (
                                <span className="text-gray-400 text-xs ml-1">
                                  ({char.lsl}~{char.usl})
                                </span>
                              )}
                              <span className="text-gray-400 ml-1">{char.unit}</span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {char.is_critical && (
                                <span className="inline-block w-2 h-2 bg-red-500 rounded-full"></span>
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
