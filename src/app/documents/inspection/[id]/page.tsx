'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface InspectionStandard {
  id: string;
  sop_id: string;
  inspection_type: string;
  revision: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface InspectionItem {
  id: string;
  item_no: number;
  sop_step_id: string | null;
  inspection_item: string;
  specification: string | null;
  measurement_method: string | null;
  measurement_tool: string | null;
  sample_size: string | null;
  frequency: string | null;
  accept_criteria: string | null;
  reject_criteria: string | null;
  sop_steps?: {
    step_no: number;
    operation: string;
  };
}

interface SopHeader {
  id: string;
  process_name: string;
  control_plan_id: string;
}

interface Product {
  id: string;
  name: string;
  code: string;
}

export default function InspectionViewPage() {
  const params = useParams();
  const inspectionId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [inspection, setInspection] = useState<InspectionStandard | null>(null);
  const [items, setItems] = useState<InspectionItem[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [sop, setSop] = useState<SopHeader | null>(null);

  useEffect(() => {
    if (inspectionId) {
      fetchInspection();
    }
  }, [inspectionId]);

  async function fetchInspection() {
    setLoading(true);
    try {
      // Fetch Inspection Standard header
      const { data: inspectionData, error: inspectionError } = await supabase
        .from('inspection_standards')
        .select('*')
        .eq('id', inspectionId)
        .single();

      if (inspectionError || !inspectionData) {
        console.error('Inspection Standard not found:', inspectionError);
        setLoading(false);
        return;
      }

      setInspection(inspectionData);

      // Fetch SOP info
      const { data: sopData } = await supabase
        .from('sop_headers')
        .select('id, process_name, control_plan_id')
        .eq('id', inspectionData.sop_id)
        .single();

      if (sopData) {
        setSop(sopData);

        // Trace back to product through control plan -> pfmea -> product
        const { data: cpData } = await supabase
          .from('control_plan_headers')
          .select('pfmea_id')
          .eq('id', sopData.control_plan_id)
          .single();

        if (cpData) {
          const { data: pfmeaData } = await supabase
            .from('pfmea_headers')
            .select('project_id')
            .eq('id', cpData.pfmea_id)
            .single();

          if (pfmeaData) {
            const { data: productData } = await supabase
              .from('products')
              .select('id, name, code')
              .eq('id', pfmeaData.project_id)
              .single();

            if (productData) {
              setProduct(productData);
            }
          }
        }
      }

      // Fetch Inspection items with SOP step info
      const { data: itemsData, error: itemsError } = await supabase
        .from('inspection_items')
        .select(`
          *,
          sop_steps:sop_step_id (
            step_no,
            operation
          )
        `)
        .eq('inspection_standard_id', inspectionId)
        .order('item_no', { ascending: true });

      if (!itemsError && itemsData) {
        setItems(itemsData);
      }
    } catch (err) {
      console.error('Error fetching Inspection:', err);
    }
    setLoading(false);
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">승인됨</span>;
      case 'review':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded-full">검토중</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">초안</span>;
    }
  };

  const getInspectionTypeBadge = (type: string) => {
    switch (type) {
      case 'incoming':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">수입검사</span>;
      case 'in_process':
        return <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">공정검사</span>;
      case 'final':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">최종검사</span>;
      case 'outgoing':
        return <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">출하검사</span>;
      default:
        return <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">{type}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">검사기준서를 찾을 수 없습니다</p>
          <Link href="/documents/generate" className="text-blue-600 hover:underline">
            ← 문서 생성 페이지로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-purple-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/documents/generate" className="text-white/80 hover:text-white">← 문서 생성</Link>
              <h1 className="text-2xl font-bold">검사기준서</h1>
            </div>
            <div className="flex items-center gap-2">
              {getInspectionTypeBadge(inspection.inspection_type)}
              {getStatusBadge(inspection.status)}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Inspection Header Info */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">검사기준서 정보</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">제품</p>
              <p className="font-medium">{product?.name || '-'}</p>
              <p className="text-xs text-gray-400">{product?.code}</p>
            </div>
            <div>
              <p className="text-gray-500">공정명</p>
              <p className="font-medium">{sop?.process_name || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">리비전</p>
              <p className="font-medium">Rev. {inspection.revision}</p>
            </div>
            <div>
              <p className="text-gray-500">생성일</p>
              <p className="font-medium">{new Date(inspection.created_at).toLocaleDateString('ko-KR')}</p>
            </div>
          </div>
          {sop && (
            <div className="mt-4 pt-4 border-t">
              <Link
                href={`/documents/sop/${sop.id}`}
                className="text-blue-600 hover:underline text-sm"
              >
                → 관련 SOP 문서 보기
              </Link>
            </div>
          )}
        </section>

        {/* Inspection Items Table */}
        <section className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">
              검사 항목 ({items.length}개)
            </h2>
          </div>

          {items.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              검사 항목이 없습니다
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">No</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">관련 작업</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">검사 항목</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">규격</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">측정 방법</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">측정 장비</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600">샘플 크기</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600">검사 주기</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">합격 기준</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">불합격 기준</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-3 text-gray-600">{item.item_no}</td>
                      <td className="px-3 py-3">
                        {item.sop_steps ? (
                          <div>
                            <span className="text-xs text-gray-400">Step {item.sop_steps.step_no}</span>
                            <p className="text-xs">{item.sop_steps.operation}</p>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-medium">{item.inspection_item}</td>
                      <td className="px-3 py-3 text-blue-700 font-mono text-xs">{item.specification || '-'}</td>
                      <td className="px-3 py-3 text-xs">{item.measurement_method || '-'}</td>
                      <td className="px-3 py-3 text-xs">{item.measurement_tool || '-'}</td>
                      <td className="px-3 py-3 text-center">{item.sample_size || '-'}</td>
                      <td className="px-3 py-3 text-center">{item.frequency || '-'}</td>
                      <td className="px-3 py-3 text-xs text-green-700">{item.accept_criteria || '-'}</td>
                      <td className="px-3 py-3 text-xs text-red-700">{item.reject_criteria || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Summary Statistics */}
        <section className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{items.length}</p>
            <p className="text-sm text-gray-500">총 검사 항목</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {items.filter(i => i.specification).length}
            </p>
            <p className="text-sm text-gray-500">규격 정의됨</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {items.filter(i => i.measurement_tool).length}
            </p>
            <p className="text-sm text-gray-500">측정 장비 지정</p>
          </div>
        </section>
      </main>
    </div>
  );
}
