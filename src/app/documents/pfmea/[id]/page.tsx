'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface PfmeaHeader {
  id: string;
  project_id: string;
  process_name: string;
  revision: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface PfmeaLine {
  id: string;
  step_no: number;
  process_step: string;
  characteristic_id: string | null;
  potential_failure_mode: string;
  potential_effect: string;
  severity: number;
  potential_cause: string;
  occurrence: number;
  current_control_prevention: string | null;
  current_control_detection: string | null;
  detection: number;
  rpn: number;
  recommended_action: string | null;
  action_priority: string | null;
  characteristics?: {
    name: string;
    type: string;
    category: string;
  };
}

interface Product {
  id: string;
  name: string;
  code: string;
}

export default function PfmeaViewPage() {
  const params = useParams();
  const pfmeaId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [pfmea, setPfmea] = useState<PfmeaHeader | null>(null);
  const [lines, setLines] = useState<PfmeaLine[]>([]);
  const [product, setProduct] = useState<Product | null>(null);

  useEffect(() => {
    if (pfmeaId) {
      fetchPfmea();
    }
  }, [pfmeaId]);

  async function fetchPfmea() {
    setLoading(true);
    try {
      // Fetch PFMEA header
      const { data: pfmeaData, error: pfmeaError } = await supabase
        .from('pfmea_headers')
        .select('*')
        .eq('id', pfmeaId)
        .single();

      if (pfmeaError || !pfmeaData) {
        console.error('PFMEA not found:', pfmeaError);
        setLoading(false);
        return;
      }

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

      // Fetch PFMEA lines with characteristics
      const { data: linesData, error: linesError } = await supabase
        .from('pfmea_lines')
        .select(`
          *,
          characteristics:characteristic_id (
            name,
            type,
            category
          )
        `)
        .eq('pfmea_id', pfmeaId)
        .order('step_no', { ascending: true });

      if (!linesError && linesData) {
        setLines(linesData);
      }
    } catch (err) {
      console.error('Error fetching PFMEA:', err);
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

  const getPriorityBadge = (priority: string | null) => {
    switch (priority) {
      case 'H':
        return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">HIGH</span>;
      case 'M':
        return <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-bold rounded">MED</span>;
      case 'L':
        return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded">LOW</span>;
      default:
        return <span className="text-gray-400">-</span>;
    }
  };

  const getRpnColor = (rpn: number) => {
    if (rpn >= 200) return 'text-red-600 font-bold';
    if (rpn >= 100) return 'text-orange-600 font-semibold';
    return 'text-gray-700';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (!pfmea) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">PFMEA를 찾을 수 없습니다</p>
          <Link href="/documents/generate" className="text-blue-600 hover:underline">
            ← 문서 생성 페이지로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/documents/generate" className="text-white/80 hover:text-white">← 문서 생성</Link>
              <h1 className="text-2xl font-bold">PFMEA 문서</h1>
            </div>
            {getStatusBadge(pfmea.status)}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* PFMEA Header Info */}
        <section className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">PFMEA 정보</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">제품</p>
              <p className="font-medium">{product?.name || '-'}</p>
              <p className="text-xs text-gray-400">{product?.code}</p>
            </div>
            <div>
              <p className="text-gray-500">공정명</p>
              <p className="font-medium">{pfmea.process_name}</p>
            </div>
            <div>
              <p className="text-gray-500">리비전</p>
              <p className="font-medium">Rev. {pfmea.revision}</p>
            </div>
            <div>
              <p className="text-gray-500">생성일</p>
              <p className="font-medium">{new Date(pfmea.created_at).toLocaleDateString('ko-KR')}</p>
            </div>
          </div>
        </section>

        {/* PFMEA Lines Table */}
        <section className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-800">
              PFMEA 분석 항목 ({lines.length}개)
            </h2>
          </div>

          {lines.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              PFMEA 항목이 없습니다
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
                    <th className="px-3 py-3 text-left font-medium text-gray-600">잠재 영향</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600">S</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">잠재 원인</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600">O</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">예방 관리</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">검출 관리</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600">D</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600">RPN</th>
                    <th className="px-3 py-3 text-center font-medium text-gray-600">우선순위</th>
                    <th className="px-3 py-3 text-left font-medium text-gray-600">권고 조치</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} className="border-t hover:bg-gray-50">
                      <td className="px-3 py-3 text-gray-600">{line.step_no}</td>
                      <td className="px-3 py-3 font-medium">{line.process_step}</td>
                      <td className="px-3 py-3">
                        {line.characteristics ? (
                          <div>
                            <span className="font-medium">{line.characteristics.name}</span>
                            <span className="ml-1 text-xs text-gray-400">
                              ({line.characteristics.type === 'product' ? '제품' : '공정'})
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-red-700">{line.potential_failure_mode}</td>
                      <td className="px-3 py-3">{line.potential_effect}</td>
                      <td className="px-3 py-3 text-center font-semibold">{line.severity}</td>
                      <td className="px-3 py-3">{line.potential_cause}</td>
                      <td className="px-3 py-3 text-center font-semibold">{line.occurrence}</td>
                      <td className="px-3 py-3 text-xs">{line.current_control_prevention || '-'}</td>
                      <td className="px-3 py-3 text-xs">{line.current_control_detection || '-'}</td>
                      <td className="px-3 py-3 text-center font-semibold">{line.detection}</td>
                      <td className={`px-3 py-3 text-center ${getRpnColor(line.rpn)}`}>{line.rpn}</td>
                      <td className="px-3 py-3 text-center">{getPriorityBadge(line.action_priority)}</td>
                      <td className="px-3 py-3 text-xs">{line.recommended_action || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Summary Statistics */}
        <section className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{lines.length}</p>
            <p className="text-sm text-gray-500">총 항목 수</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {lines.filter(l => l.action_priority === 'H').length}
            </p>
            <p className="text-sm text-gray-500">HIGH 우선순위</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-orange-600">
              {lines.filter(l => l.rpn >= 100).length}
            </p>
            <p className="text-sm text-gray-500">RPN ≥ 100</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-gray-600">
              {lines.length > 0 ? Math.round(lines.reduce((sum, l) => sum + l.rpn, 0) / lines.length) : 0}
            </p>
            <p className="text-sm text-gray-500">평균 RPN</p>
          </div>
        </section>
      </main>
    </div>
  );
}
