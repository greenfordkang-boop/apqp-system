'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface CharacteristicInput {
  id?: string;
  name: string;
  type: 'product' | 'process';
  category: 'critical' | 'major' | 'minor';
  specification: string;
  usl: string;
  lsl: string;
  unit: string;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface Product {
  id: string;
  name: string;
  code: string;
  customer: string | null;
  description: string | null;
  status: string;
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [customer, setCustomer] = useState('');
  const [description, setDescription] = useState('');
  const [originalCode, setOriginalCode] = useState('');

  const [characteristics, setCharacteristics] = useState<CharacteristicInput[]>([]);

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  async function fetchProduct() {
    setLoading(true);
    try {
      // Fetch product
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productError || !product) {
        setError('제품을 찾을 수 없습니다.');
        setLoading(false);
        return;
      }

      setProductName(product.name);
      setProductCode(product.code);
      setOriginalCode(product.code);
      setCustomer(product.customer || '');
      setDescription(product.description || '');

      // Fetch characteristics for this product
      const { data: chars, error: charError } = await supabase
        .from('characteristics')
        .select('*')
        .eq('product_id', productId);

      if (!charError && chars) {
        setCharacteristics(chars.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type as 'product' | 'process',
          category: c.category as 'critical' | 'major' | 'minor',
          specification: c.specification || '',
          usl: c.usl?.toString() || '',
          lsl: c.lsl?.toString() || '',
          unit: c.unit || 'mm',
          isNew: false,
          isDeleted: false,
        })));
      }
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    }
    setLoading(false);
  }

  const addCharacteristic = () => {
    setCharacteristics([
      ...characteristics,
      {
        name: '',
        type: 'process',
        category: 'minor',
        specification: '',
        usl: '',
        lsl: '',
        unit: 'mm',
        isNew: true,
        isDeleted: false,
      }
    ]);
  };

  const removeCharacteristic = (index: number) => {
    const updated = [...characteristics];
    if (updated[index].isNew) {
      // New items can be removed directly
      updated.splice(index, 1);
    } else {
      // Existing items are marked for deletion
      updated[index].isDeleted = true;
    }
    setCharacteristics(updated);
  };

  const restoreCharacteristic = (index: number) => {
    const updated = [...characteristics];
    updated[index].isDeleted = false;
    setCharacteristics(updated);
  };

  const updateCharacteristic = (index: number, field: keyof CharacteristicInput, value: string) => {
    const updated = [...characteristics];
    updated[index] = { ...updated[index], [field]: value };
    setCharacteristics(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Update product
      const { error: productError } = await supabase
        .from('products')
        .update({
          name: productName,
          code: productCode,
          customer: customer || null,
          description: description || null,
        })
        .eq('id', productId);

      if (productError) throw productError;

      // Get process for this product (to link new characteristics)
      const { data: processes } = await supabase
        .from('processes')
        .select('id')
        .eq('code', `${originalCode}-PROC-001`)
        .single();

      const processId = processes?.id;

      // Handle characteristics
      for (const char of characteristics) {
        if (char.isDeleted && char.id) {
          // Delete existing characteristic
          await supabase.from('characteristics').delete().eq('id', char.id);
        } else if (char.isNew && !char.isDeleted) {
          // Insert new characteristic
          await supabase.from('characteristics').insert({
            product_id: productId,
            process_id: processId,
            name: char.name,
            type: char.type,
            category: char.category,
            specification: char.specification || null,
            usl: parseFloat(char.usl) || null,
            lsl: parseFloat(char.lsl) || null,
            unit: char.unit,
            canonical_name: char.name.toLowerCase().replace(/\s+/g, '_'),
          });
        } else if (char.id && !char.isDeleted) {
          // Update existing characteristic
          await supabase.from('characteristics')
            .update({
              name: char.name,
              type: char.type,
              category: char.category,
              specification: char.specification || null,
              usl: parseFloat(char.usl) || null,
              lsl: parseFloat(char.lsl) || null,
              unit: char.unit,
              canonical_name: char.name.toLowerCase().replace(/\s+/g, '_'),
            })
            .eq('id', char.id);
        }
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/products');
      }, 1500);

    } catch (err: unknown) {
      console.error('Error updating product:', err);
      setError(err instanceof Error ? err.message : '제품 수정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  const visibleCharacteristics = characteristics.filter(c => !c.isDeleted);
  const deletedCharacteristics = characteristics.filter(c => c.isDeleted);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/products" className="text-white/80 hover:text-white">← 제품 목록</Link>
            <h1 className="text-2xl font-bold">제품 수정</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            ✅ 제품이 성공적으로 수정되었습니다! 잠시 후 목록으로 이동합니다...
          </div>
        )}

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            ❌ 오류: {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <section className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">제품 정보</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제품명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  제품 코드 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">고객사</label>
                <input
                  type="text"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-800">특성 (Characteristics)</h2>
              <button
                type="button"
                onClick={addCharacteristic}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                + 특성 추가
              </button>
            </div>

            {visibleCharacteristics.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                등록된 특성이 없습니다. 특성을 추가해주세요.
              </div>
            ) : (
              visibleCharacteristics.map((char, index) => {
                const realIndex = characteristics.findIndex(c => c === char);
                return (
                  <div key={char.id || `new-${index}`} className={`border rounded-lg p-4 mb-4 ${char.isNew ? 'bg-green-50 border-green-200' : 'bg-gray-50'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-medium text-gray-700">
                        특성 #{index + 1}
                        {char.isNew && <span className="ml-2 text-xs text-green-600">(새로 추가)</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCharacteristic(realIndex)}
                        className="text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">특성명</label>
                        <input
                          type="text"
                          required
                          value={char.name}
                          onChange={(e) => updateCharacteristic(realIndex, 'name', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">유형</label>
                        <select
                          value={char.type}
                          onChange={(e) => updateCharacteristic(realIndex, 'type', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        >
                          <option value="process">공정 특성</option>
                          <option value="product">제품 특성</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">중요도</label>
                        <select
                          value={char.category}
                          onChange={(e) => updateCharacteristic(realIndex, 'category', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        >
                          <option value="critical">Critical (중요)</option>
                          <option value="major">Major (주요)</option>
                          <option value="minor">Minor (일반)</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">규격 (Specification)</label>
                        <input
                          type="text"
                          value={char.specification}
                          onChange={(e) => updateCharacteristic(realIndex, 'specification', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                          placeholder="예: 10.0 ± 0.5mm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">단위</label>
                        <input
                          type="text"
                          value={char.unit}
                          onChange={(e) => updateCharacteristic(realIndex, 'unit', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">상한 (USL)</label>
                        <input
                          type="number"
                          step="0.001"
                          value={char.usl}
                          onChange={(e) => updateCharacteristic(realIndex, 'usl', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">하한 (LSL)</label>
                        <input
                          type="number"
                          step="0.001"
                          value={char.lsl}
                          onChange={(e) => updateCharacteristic(realIndex, 'lsl', e.target.value)}
                          className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Show deleted characteristics */}
            {deletedCharacteristics.length > 0 && (
              <div className="mt-6 pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-500 mb-3">삭제 예정 특성 (저장 시 삭제됨)</h3>
                {deletedCharacteristics.map((char) => {
                  const realIndex = characteristics.findIndex(c => c === char);
                  return (
                    <div key={char.id} className="flex justify-between items-center bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                      <span className="text-red-700 line-through">{char.name}</span>
                      <button
                        type="button"
                        onClick={() => restoreCharacteristic(realIndex)}
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        복원
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
            >
              {saving ? '저장 중...' : '변경사항 저장'}
            </button>
            <Link
              href="/products"
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 text-center"
            >
              취소
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
