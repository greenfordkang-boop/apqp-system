'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { productStore, characteristicStore, type Product, type Characteristic } from '@/lib/store';

interface CharacteristicInput extends Characteristic {
  _isNew?: boolean;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EditProductPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const [product, setProduct] = useState<Product | null>(null);
  const [productName, setProductName] = useState('');
  const [productCode, setProductCode] = useState('');
  const [customer, setCustomer] = useState('');
  const [description, setDescription] = useState('');

  const [characteristics, setCharacteristics] = useState<CharacteristicInput[]>([]);
  const [newCharForm, setNewCharForm] = useState({
    name: '',
    type: 'process' as 'product' | 'process',
    category: 'minor' as 'critical' | 'major' | 'minor',
    specification: '',
    lsl: '',
    usl: '',
    unit: 'mm',
    measurement_method: '',
    process_name: ''
  });

  useEffect(() => {
    const load = async () => {
      await loadData();
    };
    load();
  }, []);

  async function loadData() {
    const prod = await productStore.getById(id);
    if (!prod) {
      router.push('/products');
      return;
    }

    setProduct(prod);
    setProductName(prod.name);
    setProductCode(prod.code);
    setCustomer(prod.customer);
    setDescription(prod.description);

    const chars = await characteristicStore.getByProductId(id);
    setCharacteristics(chars);
    setMounted(true);
  }

  function addCharacteristic() {
    if (!newCharForm.name.trim()) {
      setError('특성명을 입력하세요');
      return;
    }

    setError(null);
    const newChar: CharacteristicInput = {
      id: `new-${Date.now()}`,
      product_id: id,
      name: newCharForm.name,
      type: newCharForm.type,
      category: newCharForm.category,
      specification: newCharForm.specification,
      lsl: newCharForm.lsl ? parseFloat(newCharForm.lsl) : null,
      usl: newCharForm.usl ? parseFloat(newCharForm.usl) : null,
      unit: newCharForm.unit,
      measurement_method: newCharForm.measurement_method,
      process_name: newCharForm.process_name,
      created_at: new Date().toISOString(),
      _isNew: true
    };

    setCharacteristics([...characteristics, newChar]);
    setNewCharForm({
      name: '',
      type: 'process',
      category: 'minor',
      specification: '',
      lsl: '',
      usl: '',
      unit: 'mm',
      measurement_method: '',
      process_name: ''
    });
  }

  function removeCharacteristic(charId: string) {
    setCharacteristics(characteristics.filter(c => c.id !== charId));
  }

  function updateCharField(charId: string, field: keyof Characteristic, value: any) {
    setCharacteristics(characteristics.map(c => 
      c.id === charId ? { ...c, [field]: value } : c
    ));
  }

  async function handleSave() {
    setError(null);
    setLoading(true);

    try {
      if (!productName.trim()) {
        setError('제품명을 입력하세요');
        setLoading(false);
        return;
      }
      if (!productCode.trim()) {
        setError('제품코드를 입력하세요');
        setLoading(false);
        return;
      }

      // Update product
      await productStore.update(id, {
        name: productName,
        code: productCode,
        customer: customer || '',
        description: description || ''
      });

      // Handle characteristics: delete removed, update existing, create new
      const originalChars = await characteristicStore.getByProductId(id);
      const originalIds = new Set(originalChars.map(c => c.id));
      const currentIds = new Set(characteristics.filter(c => !c._isNew).map(c => c.id));

      // Delete removed characteristics
      for (const origChar of originalChars) {
        if (!currentIds.has(origChar.id)) {
          await characteristicStore.delete(origChar.id);
        }
      }

      // Update existing characteristics
      for (const char of characteristics) {
        if (!char._isNew) {
          await characteristicStore.update(char.id, {
            name: char.name,
            type: char.type,
            category: char.category,
            specification: char.specification,
            lsl: char.lsl,
            usl: char.usl,
            unit: char.unit,
            measurement_method: char.measurement_method,
            process_name: char.process_name
          });
        } else {
          // Create new characteristic
          await characteristicStore.create({
            product_id: id,
            name: char.name,
            type: char.type,
            category: char.category,
            specification: char.specification,
            lsl: char.lsl,
            usl: char.usl,
            unit: char.unit,
            measurement_method: char.measurement_method,
            process_name: char.process_name
          });
        }
      }

      router.push('/products');
    } catch (err) {
      console.error('Error saving product:', err);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
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

  if (!mounted || !product) {
    return <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-white/70 border-b border-gray-200/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/products" className="text-gray-600 hover:text-gray-900 text-sm font-medium">
              ← 제품 관리
            </Link>
            <div className="w-px h-6 bg-gray-200"></div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name} 편집</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Product Info Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-8 backdrop-blur-sm mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">제품 정보</h2>

          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  제품명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">고객사</label>
              <input
                type="text"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">설명</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
              />
            </div>
          </div>
        </div>

        {/* Existing Characteristics */}
        {characteristics.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-8 backdrop-blur-sm mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">특성 목록</h2>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold">특성명</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold">유형</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold">중요도</th>
                    <th className="px-4 py-3 text-left text-gray-700 font-semibold">규격</th>
                    <th className="px-4 py-3 text-right text-gray-700 font-semibold">LSL/USL</th>
                    <th className="px-4 py-3 text-right text-gray-700 font-semibold">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {characteristics.map((char, idx) => (
                    <tr key={char.id} className={`border-t border-gray-100 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-blue-50/50`}>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={char.name}
                          onChange={(e) => updateCharField(char.id, 'name', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={char.type}
                          onChange={(e) => updateCharField(char.id, 'type', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                        >
                          <option value="product">제품</option>
                          <option value="process">공정</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={char.category}
                          onChange={(e) => updateCharField(char.id, 'category', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs"
                        >
                          <option value="critical">Critical</option>
                          <option value="major">Major</option>
                          <option value="minor">Minor</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={char.specification}
                          onChange={(e) => updateCharField(char.id, 'specification', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-600 font-mono">
                        {char.lsl !== null && char.usl !== null ? (
                          <span>{char.lsl} ~ {char.usl}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => removeCharacteristic(char.id)}
                          className="text-red-600 hover:text-red-700 text-xs font-semibold"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add New Characteristic */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/50 p-8 backdrop-blur-sm mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">새 특성 추가</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-2">특성명</label>
              <input
                type="text"
                value={newCharForm.name}
                onChange={(e) => setNewCharForm({ ...newCharForm, name: e.target.value })}
                placeholder="예: 길이"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">유형</label>
              <select
                value={newCharForm.type}
                onChange={(e) => setNewCharForm({ ...newCharForm, type: e.target.value as 'product' | 'process' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              >
                <option value="product">제품특성</option>
                <option value="process">공정특성</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">중요도</label>
              <select
                value={newCharForm.category}
                onChange={(e) => setNewCharForm({ ...newCharForm, category: e.target.value as 'critical' | 'major' | 'minor' })}
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
                value={newCharForm.specification}
                onChange={(e) => setNewCharForm({ ...newCharForm, specification: e.target.value })}
                placeholder="예: 좌표 특성"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">LSL</label>
              <input
                type="number"
                step="0.01"
                value={newCharForm.lsl}
                onChange={(e) => setNewCharForm({ ...newCharForm, lsl: e.target.value })}
                placeholder="0.0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">USL</label>
              <input
                type="number"
                step="0.01"
                value={newCharForm.usl}
                onChange={(e) => setNewCharForm({ ...newCharForm, usl: e.target.value })}
                placeholder="10.0"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">단위</label>
              <input
                type="text"
                value={newCharForm.unit}
                onChange={(e) => setNewCharForm({ ...newCharForm, unit: e.target.value })}
                placeholder="mm"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-2">측정 방법</label>
              <input
                type="text"
                value={newCharForm.measurement_method}
                onChange={(e) => setNewCharForm({ ...newCharForm, measurement_method: e.target.value })}
                placeholder="예: 마이크로미터"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-2">공정명</label>
              <input
                type="text"
                value={newCharForm.process_name}
                onChange={(e) => setNewCharForm({ ...newCharForm, process_name: e.target.value })}
                placeholder="예: 선반 가공"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
              />
            </div>
          </div>

          <button
            onClick={addCharacteristic}
            className="w-full mt-4 px-4 py-3 bg-gray-100 text-gray-900 border-2 border-gray-300 rounded-lg font-semibold hover:bg-gray-200 transition-all text-sm"
          >
            + 특성 추가
          </button>
        </div>

        {/* Save Button */}
        <div className="flex gap-3">
          <Link
            href="/products"
            className="flex-1 text-center px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50 transition-all"
          >
            취소
          </Link>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-semibold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '저장 중...' : '저장'}
          </button>
        </div>
      </main>
    </div>
  );
}
