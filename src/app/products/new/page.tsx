'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface CharacteristicInput {
  name: string;
  type: 'dimension' | 'visual' | 'functional' | 'material';
  nominal: string;
  usl: string;
  lsl: string;
  unit: string;
  is_critical: boolean;
}

export default function NewProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [customer, setCustomer] = useState('');
  const [description, setDescription] = useState('');

  const [characteristics, setCharacteristics] = useState<CharacteristicInput[]>([
    { name: '', type: 'dimension', nominal: '', usl: '', lsl: '', unit: 'mm', is_critical: false }
  ]);

  const addCharacteristic = () => {
    setCharacteristics([
      ...characteristics,
      { name: '', type: 'dimension', nominal: '', usl: '', lsl: '', unit: 'mm', is_critical: false }
    ]);
  };

  const removeCharacteristic = (index: number) => {
    if (characteristics.length > 1) {
      setCharacteristics(characteristics.filter((_, i) => i !== index));
    }
  };

  const updateCharacteristic = (index: number, field: keyof CharacteristicInput, value: string | boolean) => {
    const updated = [...characteristics];
    updated[index] = { ...updated[index], [field]: value };
    setCharacteristics(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          name: productName,
          code: productCode,
          customer: customer || null,
          description: description || null,
          status: 'active'
        })
        .select()
        .single();

      if (productError) throw productError;

      const { data: process, error: processError } = await supabase
        .from('processes')
        .insert({
          product_id: product.id,
          name: 'Main Process',
          sequence: 1
        })
        .select()
        .single();

      if (processError) throw processError;

      const charData = characteristics.map((char, index) => ({
        process_id: process.id,
        name: char.name,
        type: char.type,
        nominal: parseFloat(char.nominal) || 0,
        usl: parseFloat(char.usl) || null,
        lsl: parseFloat(char.lsl) || null,
        unit: char.unit,
        is_critical: char.is_critical,
        sequence: index + 1
      }));

      const { error: charError } = await supabase
        .from('characteristics')
        .insert(charData);

      if (charError) throw charError;

      setSuccess(true);
      setTimeout(() => {
        router.push('/products');
      }, 2000);

    } catch (err: unknown) {
      console.error('Error creating product:', err);
      setError(err instanceof Error ? err.message : 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-white/80 hover:text-white">← 홈</Link>
            <h1 className="text-2xl font-bold">신규 제품 등록</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
            ✅ 제품이 성공적으로 등록되었습니다! 잠시 후 목록으로 이동합니다...
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
                  제품명 (차종) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 현대 아반떼 CN7"
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
                  placeholder="예: CN7-2024"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">고객사</label>
                <input
                  type="text"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 현대자동차"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 현대 아반떼 CN7 2024년형 부품"
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

            <p className="text-sm text-gray-500 mb-4">
              특성은 Single Source of Truth로, 모든 문서(PFMEA, Control Plan, SOP, 검사기준서)의 기준이 됩니다.
            </p>

            {characteristics.map((char, index) => (
              <div key={index} className="border rounded-lg p-4 mb-4 bg-gray-50">
                <div className="flex justify-between items-start mb-3">
                  <span className="font-medium text-gray-700">특성 #{index + 1}</span>
                  {characteristics.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeCharacteristic(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      삭제
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-sm text-gray-600 mb-1">특성명</label>
                    <input
                      type="text"
                      required
                      value={char.name}
                      onChange={(e) => updateCharacteristic(index, 'name', e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      placeholder="예: 외경 치수"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">유형</label>
                    <select
                      value={char.type}
                      onChange={(e) => updateCharacteristic(index, 'type', e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="dimension">치수</option>
                      <option value="visual">외관</option>
                      <option value="functional">기능</option>
                      <option value="material">재질</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">기준값 (Nominal)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={char.nominal}
                      onChange={(e) => updateCharacteristic(index, 'nominal', e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      placeholder="10.0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">상한 (USL)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={char.usl}
                      onChange={(e) => updateCharacteristic(index, 'usl', e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      placeholder="10.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">하한 (LSL)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={char.lsl}
                      onChange={(e) => updateCharacteristic(index, 'lsl', e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      placeholder="9.5"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">단위</label>
                    <input
                      type="text"
                      value={char.unit}
                      onChange={(e) => updateCharacteristic(index, 'unit', e.target.value)}
                      className="w-full px-3 py-2 border rounded-md text-sm"
                      placeholder="mm"
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={char.is_critical}
                        onChange={(e) => updateCharacteristic(index, 'is_critical', e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-gray-600">중요 특성 (Critical)</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </section>

          <div className="flex gap-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? '등록 중...' : '제품 등록'}
            </button>
            <Link
              href="/"
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
