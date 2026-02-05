'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface ControlPlanHeader {
  id: string;
  pfmea_id: string;
  revision: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ControlPlanLine {
  id: string;
  line_no: number;
  pfmea_line_id: string;
  control_type: string;
  control_method: string;
  sample_size: string | null;
  sample_frequency: string | null;
  reaction_plan: string | null;
  responsible: string | null;
  pfmea_lines?: {
    process_step: string;
    potential_failure_mode: string;
    characteristics?: {
      name: string;
      type: string;
    };
  };
}

interface Product {
  id: string;
  name: string;
  code: string;
}

interface PfmeaHeader {
  id: string;
  process_name: string;
  project_id: string;
}

export default function ControlPlanViewPage() {
  const params = useParams();
  const cpId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [controlPlan, setControlPlan] = useState<ControlPlanHeader | null>(null);
  const [lines, setLines] = useState<ControlPlanLine[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [pfmea, setPfmea] = useState<PfmeaHeader | null>(null);

  useEffect(() => {
    if (cpId) {
      fetchControlPlan();
    }
  }, [cpId]);

  async function fetchControlPlan() {
    setLoading(true);
    try {
      // Fetch Control Plan header
      const { data: cpData, error: cpError } = await supabase
        .from('control_plan_headers')
        .select('*')
        .eq('id', cpId)
        .single();

      if (cpError || !cpData) {
        console.error('Control Plan not found:', cpError);
        setLoading(false);
        return;
      }

      setControlPlan(cpData);

      // Fetch PFMEA info
      const { data: pfmeaData } = await supabase
        .from('pfmea_headers')
        .select('id, process_name, project_id')
        .eq('id', cpData.pfmea_id)
        .single();

      if (pfmeaData) {
        setPfmea(pfmeaData);

        // Fetch product info
        const { data: productData } = await supabase
          .from('products')
          .select('id, name, code')
          .eq('id', pfmeaData.project_id)
          .single();

        if (productData) {
          setProduct(productData);
        }
      }

      // Fetch Control Plan lines with PFMEA line info
      const { data: linesData, error: linesError } = await supabase
        .from('control_plan_lines')
        .select(`
          *,
          pfmea_lines:pfmea_line_id (
            process_step,
            potential_failure_mode,
            characteristics:characteristic_id (
              name,
              type
            )
          )
        `)
        .eq('control_plan_id', cpId)
        .order('line_no', { ascending: true });

      if (!linesError && linesData) {
        setLines(linesData);
      }
    } catch (err) {
      console.error('Error fetching Control Plan:', err);
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

  const getControlTypeBadge = (type: string) => {
    switch (type) {
      case 'prevention':
        return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">예방</span>;
      case 'detection':
        return <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">검출</span>;
      default:
        return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{type}</span>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!controlPlan) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Control Plan을 찾을 수 없습니다</p>
          <Link href="/documents/generate" className="text-blue-600 hover:underline">
            ← 문서 생성 페이지로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-green-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/documents/generate" className="text-white/80 hover:text-white">← 문서 생성</Link>
              <h1 className="text-2xl font-bold">Control Plan 문서</h1>
            </div>
            {getStatusBadge(controlPlan.status)}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Control Plan Header Info */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Control Plan 정보</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">제품</p>
              <p className="font-medium">{product?.name || '-'}</p>
              <p className="text-xs text-gray-400">{product?.code}</p>
            </div>
            <div>
              <p className="text-gray-500">공정명</p>
              <p className="font-medium">{pfmea?.process_name || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">리비전</p>
              <p className="font-medium">Rev. {controlPlan.revision}</p>
            </div>
            <div>
              <p className="text-gray-500">생성일</p>
              <p className="font-medium">{new Date(controlPlan.created_at).toLocaleDateString('ko-KR')}</p>
            </div>
          </div>
          {pfmea && (
            <div className="mt-4 pt-4 border-t">
              <Link
                href={`/documents/pfmea/${pfmea.id}`}
                className="text-blue-600 hover:underline text-sm"
              >
                → 관련 PFMEA 문서 보기
              </Link>
            </div>
          )}
        </section>

        {/* Control Plan Lines Table */}
        <section className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">
              관리 항목 ({lines.length}개)
            </h2>
          </div>

          {lines.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              관리 항목이 없습니다
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">No</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">공정 단계</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">특성</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">잠재 고장 모드</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600">관리 유형</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">관리 방법</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600">샘플 크기</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600">측정 주기</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">대응 계획</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">담당자</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-3 text-gray-600">{line.line_no}</td>
                      <td className="px-3 py-3 font-medium">
                        {line.pfmea_lines?.process_step || '-'}
                      </td>
                      <td className="px-3 py-3">
                        {line.pfmea_lines?.characteristics ? (
                          <div>
                            <span className="font-medium">{line.pfmea_lines.characteristics.name}</span>
                            <span className="ml-1 text-xs text-gray-400">
                              ({line.pfmea_lines.characteristics.type === 'product' ? '제품' : '공정'})
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-red-700">
                        {line.pfmea_lines?.potential_failure_mode || '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {getControlTypeBadge(line.control_type)}
                      </td>
                      <td className="px-3 py-3">{line.control_method}</td>
                      <td className="px-3 py-3 text-center">{line.sample_size || '-'}</td>
                      <td className="px-3 py-3 text-center">{line.sample_frequency || '-'}</td>
                      <td className="px-3 py-3 text-xs">{line.reaction_plan || '-'}</td>
                      <td className="px-3 py-3">{line.responsible || '-'}</td>
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
            <p className="text-2xl font-bold text-green-600">{lines.length}</p>
            <p className="text-sm text-gray-500">총 관리 항목</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">
              {lines.filter(l => l.control_type === 'prevention').length}
            </p>
            <p className="text-sm text-gray-500">예방 관리</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">
              {lines.filter(l => l.control_type === 'detection').length}
            </p>
            <p className="text-sm text-gray-500">검출 관리</p>
          </div>
        </section>
      </main>
    </div>
  );
}
