'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface SopStep {
  id: string;
  step_number: number;
  title: string;
  description: string;
  safety_notes: string | null;
  equipment: string[] | null;
  created_at: string;
  control_plan_item: {
    id: string;
    characteristic: {
      name: string;
      type: string;
    };
  };
}

interface InspectionItem {
  id: string;
  inspection_type: string;
  method: string;
  frequency: string;
  acceptance_criteria: string;
  created_at: string;
  control_plan_item: {
    id: string;
    characteristic: {
      name: string;
      type: string;
    };
  };
}

type Tab = 'sop' | 'inspection';

export default function DocumentsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('sop');
  const [sopSteps, setSopSteps] = useState<SopStep[]>([]);
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<SopStep | InspectionItem | null>(null);

  useEffect(() => {
    if (activeTab === 'sop') {
      fetchSopSteps();
    } else {
      fetchInspectionItems();
    }
  }, [activeTab]);

  async function fetchSopSteps() {
    setLoading(true);
    const { data, error } = await supabase
      .from('sop_steps')
      .select(`
        *,
        control_plan_item:control_plan_items(
          id,
          characteristic:characteristics(name, type)
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setSopSteps(data as unknown as SopStep[]);
    }
    setLoading(false);
  }

  async function fetchInspectionItems() {
    setLoading(true);
    const { data, error } = await supabase
      .from('inspection_items')
      .select(`
        *,
        control_plan_item:control_plan_items(
          id,
          characteristic:characteristics(name, type)
        )
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setInspectionItems(data as unknown as InspectionItem[]);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-white/80 hover:text-white">← 홈</Link>
              <h1 className="text-2xl font-bold">문서 열람</h1>
            </div>
            <Link
              href="/documents/generate"
              className="px-4 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-blue-50"
            >
              + 문서 생성
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('sop')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'sop'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            📝 SOP (표준작업절차서)
          </button>
          <button
            onClick={() => setActiveTab('inspection')}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              activeTab === 'inspection'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            ✅ 검사기준서
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Document List */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              {activeTab === 'sop' ? 'SOP 목록' : '검사기준서 목록'}
            </h2>

            {loading ? (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                로딩 중...
              </div>
            ) : activeTab === 'sop' ? (
              sopSteps.length === 0 ? (
                <EmptyState type="SOP" />
              ) : (
                <div className="space-y-3">
                  {sopSteps.map((step) => (
                    <div
                      key={step.id}
                      onClick={() => setSelectedDoc(step)}
                      className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
                        selectedDoc?.id === step.id
                          ? 'ring-2 ring-blue-500'
                          : 'hover:shadow-md'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-800">
                            Step {step.step_number}: {step.title}
                          </h3>
                          <p className="text-sm text-gray-500">
                            특성: {step.control_plan_item?.characteristic?.name || 'N/A'}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(step.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              inspectionItems.length === 0 ? (
                <EmptyState type="검사기준서" />
              ) : (
                <div className="space-y-3">
                  {inspectionItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedDoc(item)}
                      className={`bg-white rounded-lg shadow p-4 cursor-pointer transition-all ${
                        selectedDoc?.id === item.id
                          ? 'ring-2 ring-green-500'
                          : 'hover:shadow-md'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold text-gray-800">
                            {item.control_plan_item?.characteristic?.name || 'N/A'}
                          </h3>
                          <p className="text-sm text-gray-500">
                            검사유형: {item.inspection_type} | 주기: {item.frequency}
                          </p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(item.created_at).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Document Detail */}
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">문서 상세</h2>

            {selectedDoc ? (
              <div className="bg-white rounded-lg shadow p-6">
                {activeTab === 'sop' && 'step_number' in selectedDoc ? (
                  <SopDetail step={selectedDoc} />
                ) : activeTab === 'inspection' && 'inspection_type' in selectedDoc ? (
                  <InspectionDetail item={selectedDoc} />
                ) : null}
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
                문서를 선택하면 상세 내용이 표시됩니다
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function EmptyState({ type }: { type: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-6 text-center">
      <p className="text-gray-500 mb-4">생성된 {type}가 없습니다</p>
      <Link
        href="/documents/generate"
        className="px-4 py-2 bg-blue-600 text-white rounded-lg inline-block"
      >
        문서 생성하기
      </Link>
    </div>
  );
}

function SopDetail({ step }: { step: SopStep }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold text-gray-800">
          Step {step.step_number}: {step.title}
        </h3>
        <p className="text-sm text-gray-500">
          관련 특성: {step.control_plan_item?.characteristic?.name}
        </p>
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 mb-2">작업 설명</h4>
        <p className="text-gray-600 whitespace-pre-wrap">{step.description}</p>
      </div>

      {step.safety_notes && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
          <h4 className="font-semibold text-yellow-800 mb-1">⚠️ 안전 주의사항</h4>
          <p className="text-yellow-700">{step.safety_notes}</p>
        </div>
      )}

      {step.equipment && step.equipment.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-700 mb-2">필요 장비</h4>
          <ul className="list-disc list-inside text-gray-600">
            {step.equipment.map((eq, i) => (
              <li key={i}>{eq}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-4 border-t text-xs text-gray-400">
        문서 ID: {step.id}<br/>
        생성일: {new Date(step.created_at).toLocaleString('ko-KR')}
      </div>
    </div>
  );
}

function InspectionDetail({ item }: { item: InspectionItem }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold text-gray-800">
          {item.control_plan_item?.characteristic?.name}
        </h3>
        <p className="text-sm text-gray-500">
          특성 유형: {item.control_plan_item?.characteristic?.type}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="font-semibold text-gray-700">검사 유형</h4>
          <p className="text-gray-600">{item.inspection_type}</p>
        </div>
        <div>
          <h4 className="font-semibold text-gray-700">검사 주기</h4>
          <p className="text-gray-600">{item.frequency}</p>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-700 mb-2">검사 방법</h4>
        <p className="text-gray-600 whitespace-pre-wrap">{item.method}</p>
      </div>

      <div className="bg-green-50 border-l-4 border-green-400 p-4">
        <h4 className="font-semibold text-green-800 mb-1">✅ 합격 기준</h4>
        <p className="text-green-700">{item.acceptance_criteria}</p>
      </div>

      <div className="pt-4 border-t text-xs text-gray-400">
        문서 ID: {item.id}<br/>
        생성일: {new Date(item.created_at).toLocaleString('ko-KR')}
      </div>
    </div>
  );
}
