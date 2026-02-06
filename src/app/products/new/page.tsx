'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { productStore, characteristicStore, type Product } from '@/lib/store';

interface CharacteristicInput {
  name: string;
  type: 'product' | 'process';
  category: 'critical' | 'major' | 'minor';
  specification: string;
  lsl: string;
  usl: string;
  unit: string;
  measurement_method: string;
  process_name: string;
}

export default function NewProductPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Product Info
  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [customer, setCustomer] = useState('');
  const [description, setDescription] = useState('');

  // Step 2: Characteristics
  const [characteristics, setCharacteristics] = useState<CharacteristicInput[]>([
    {
      name: '',
      type: 'process',
      category: 'minor',
      specification: '',
      lsl: '',
      usl: '',
      unit: 'mm',
      measurement_method: '',
      process_name: ''
    }
  ]);

  function addCharacteristic() {
    setCharacteristics([
      ...characteristics,
      {
        name: '',
        type: 'process',
        category: 'minor',
        specification: '',
        lsl: '',
        usl: '',
        unit: 'mm',
        measurement_method: '',
        process_name: ''
      }
    ]);
  }

  function removeCharacteristic(index: number) {
    if (characteristics.length > 1) {
      setCharacteristics(characteristics.filter((_, i) => i !== index));
    }
  }

  function updateCharacteristic(index: number, field: keyof CharacteristicInput, value: string) {
    const updated = [...characteristics];
    updated[index] = { ...updated[index], [field]: value };
    setCharacteristics(updated);
  }

  function handleStep1Submit() {
    setError(null);
    
    if (!productName.trim()) {
      setError('제품명을 입력하세요');
      return;
    }
    if (!productCode.trim()) {
      setError('제품코드를 입력하세요');
      return;
    }
    
    setStep(2);
  }

  async function handleStep2Submit() {
    setError(null);
    setLoading(true);

    try {
      // Create product
      const product = await productStore.create({
        name: productName,
        code: productCode,
        customer: customer || '',
        description: description || ''
      });

      // Create characteristics
      for (const char of characteristics) {
        if (char.name.trim()) {
          await characteristicStore.create({
            product_id: product.id,
            name: char.name,
            type: char.type,
            category: char.category,
            specification: char.specification,
            lsl: char.lsl ? parseFloat(char.lsl) : null,
            usl: char.usl ? parseFloat(char.usl) : null,
            unit: char.unit,
            measurement_method: char.measurement_method,
            process_name: char.process_name
          });
        }
      }

      router.push('/products');
    } catch (err) {
      console.error('Error creating product:', err);
      setError('제품 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/70 border-b border-gray-200/50 shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/products" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              ← 제품 관리
            </Link>
            <div className="w-px h-6 bg-gray-200"></div>
            <h1 className="text-2xl font-bold text-gray-900">신규 제품 등록</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Step Indicator */}
        <div className="mb-8">
          <div className="flex items-center gap-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm transition-all ${
              step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              1
            </div>
            <div className={`flex-1 h-1 rounded-full transition-all ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm transition-all ${
              step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              2
            </div>
          </div>
          <div className="flex justify-between text-sm text-gray-600 mt-2">
            <span>제품 정보</span>
            <span>특성 관리</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Step 1: Product Info */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-8 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">제품 정보</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  제품명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="예: 자동차 부품 A"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  제품 코드 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productCode}
                  onChange={(e) => setProductCode(e.target.value)}
                  placeholder="예: PROD-001"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">고객사</label>
                <input
                  type="text"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  placeholder="예: ABC 자동차"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">설명</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="제품에 대한 설명을 입력하세요"
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <Link
                href="/products"
                className="flex-1 text-center px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                취소
              </Link>
              <button
                onClick={handleStep1Submit}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all"
              >
                다음
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Characteristics */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-8 backdrop-blur-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">특성 관리</h2>

            <div className="space-y-6">
              {characteristics.map((char, idx) => (
                <div key={idx} className="border border-gray-200 rounded-xl p-6 bg-gray-50/30">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-gray-900">특성 {idx + 1}</h3>
                    {characteristics.length > 1 && (
                      <button
                        onClick={() => removeCharacteristic(idx)}
                        className="text-red-600 hover:text-red-700 text-sm font-semibold"
                      >
                        제거
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">특성명</label>
                      <input
                        type="text"
                        value={char.name}
                        onChange={(e) => updateCharacteristic(idx, 'name', e.target.value)}
                        placeholder="예: 길이"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">유형</label>
                      <select
                        value={char.type}
                        onChange={(e) => updateCharacteristic(idx, 'type', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      >
                        <option value="product">제품특성</option>
                        <option value="process">공정특성</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">중요도</label>
                      <select
                        value={char.category}
                        onChange={(e) => updateCharacteristic(idx, 'category', e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      >
                        <option value="critical">Critical</option>
                        <option value="major">Major</option>
                        <option value="minor">Minor</option>
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">규격</label>
                      <input
                        type="text"
                        value={char.specification}
                        onChange={(e) => updateCharacteristic(idx, 'specification', e.target.value)}
                        placeholder="예: 좌표 특성"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">LSL</label>
                      <input
                        type="number"
                        step="0.01"
                        value={char.lsl}
                        onChange={(e) => updateCharacteristic(idx, 'lsl', e.target.value)}
                        placeholder="0.0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">USL</label>
                      <input
                        type="number"
                        step="0.01"
                        value={char.usl}
                        onChange={(e) => updateCharacteristic(idx, 'usl', e.target.value)}
                        placeholder="10.0"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-900 mb-2">단위</label>
                      <input
                        type="text"
                        value={char.unit}
                        onChange={(e) => updateCharacteristic(idx, 'unit', e.target.value)}
                        placeholder="mm"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">측정 방법</label>
                      <input
                        type="text"
                        value={char.measurement_method}
                        onChange={(e) => updateCharacteristic(idx, 'measurement_method', e.target.value)}
                        placeholder="예: 마이크로미터"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      />
                    </div>

                    <div className="col-span-2">
                      <label className="block text-sm font-semibold text-gray-900 mb-2">공정명</label>
                      <input
                        type="text"
                        value={char.process_name}
                        onChange={(e) => updateCharacteristic(idx, 'process_name', e.target.value)}
                        placeholder="예: 선반 가공"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={addCharacteristic}
              className="w-full mt-6 px-4 py-3 bg-gray-100 text-gray-900 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-200 transition-all text-sm"
            >
              + 특성 추가
            </button>

            <div className="flex gap-3 mt-8">
              <button
                onClick={() => setStep(1)}
                className="flex-1 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                이전
              </button>
              <button
                onClick={() => router.push('/products')}
                className="flex-1 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                취소
              </button>
              <button
                onClick={handleStep2Submit}
                disabled={loading}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '등록 중...' : '등록'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
