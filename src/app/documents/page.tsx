'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { productStore, pfmeaStore, controlPlanStore, sopStore, inspectionStore } from '@/lib/store';

interface Product {
  id: string;
  name: string;
  code: string;
  customer: string;
}

interface Document {
  id: string;
  status: 'draft' | 'review' | 'approved';
  itemCount: number;
  revision: number;
  createdAt: string;
}

interface ProductDocuments {
  product: Product;
  pfmea?: Document;
  controlPlan?: Document;
  sop?: Document;
  inspection?: Document;
}

function getStatusColor(status?: string) {
  if (!status) return 'bg-gray-100 text-gray-600';
  switch (status) {
    case 'draft':
      return 'bg-gray-100 text-gray-700';
    case 'review':
      return 'bg-amber-100 text-amber-700';
    case 'approved':
      return 'bg-green-100 text-green-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

function getStatusLabel(status?: string) {
  if (!status) return '미생성';
  switch (status) {
    case 'draft':
      return '작성중';
    case 'review':
      return '검토중';
    case 'approved':
      return '승인됨';
    default:
      return '미생성';
  }
}

interface DocumentStatusProps {
  document?: Document;
  type: 'PFMEA' | '관리계획서' | '작업표준서' | '검사기준서';
  documentPath: string;
}

function DocumentStatus({ document, type, documentPath }: DocumentStatusProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    });
  };

  if (!document) {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-sm font-medium text-gray-500">{type}</div>
        <div className="inline-block px-2.5 py-1 text-xs font-medium bg-gray-100 text-gray-500 rounded-full">
          미생성
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="text-sm font-medium text-gray-700">{type}</div>
      <div className="flex flex-wrap gap-2 items-center">
        <div className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${getStatusColor(document.status)}`}>
          {getStatusLabel(document.status)}
        </div>
        <span className="text-xs text-gray-500">
          {document.itemCount}개 항목
        </span>
        {document.revision > 0 && (
          <span className="text-xs text-gray-500">
            v{document.revision}
          </span>
        )}
      </div>
      <Link
        href={documentPath}
        className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors mt-1"
      >
        보기 →
      </Link>
      <div className="text-xs text-gray-400 mt-1">
        {formatDate(document.createdAt)}
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  const [productDocuments, setProductDocuments] = useState<ProductDocuments[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadProductDocuments();
  }, []);

  async function loadProductDocuments() {
    setLoading(true);

    try {
      const products = await productStore.getAll();

      const docsWithProducts = await Promise.all(
        products.map(async (product) => {
          // Get PFMEA document
          const pfmeaHeader = await pfmeaStore.getHeaderByProductId(product.id);
          const pfmea = pfmeaHeader ? {
            id: pfmeaHeader.id,
            status: pfmeaHeader.status,
            itemCount: (await pfmeaStore.getLines(pfmeaHeader.id)).length,
            revision: pfmeaHeader.revision,
            createdAt: pfmeaHeader.created_at,
          } : undefined;

          // Get Control Plan document
          const controlPlanHeader = await controlPlanStore.getByProductId(product.id);
          const controlPlan = controlPlanHeader ? {
            id: controlPlanHeader.id,
            status: controlPlanHeader.status,
            itemCount: (await controlPlanStore.getItems(controlPlanHeader.id)).length,
            revision: controlPlanHeader.revision,
            createdAt: controlPlanHeader.created_at,
          } : undefined;

          // Get SOP document
          const sopHeader = await sopStore.getByProductId(product.id);
          const sop = sopHeader ? {
            id: sopHeader.id,
            status: sopHeader.status,
            itemCount: (await sopStore.getSteps(sopHeader.id)).length,
            revision: sopHeader.revision,
            createdAt: sopHeader.created_at,
          } : undefined;

          // Get Inspection document
          const inspectionHeader = await inspectionStore.getByProductId(product.id);
          const inspection = inspectionHeader ? {
            id: inspectionHeader.id,
            status: inspectionHeader.status,
            itemCount: (await inspectionStore.getItems(inspectionHeader.id)).length,
            revision: inspectionHeader.revision,
            createdAt: inspectionHeader.created_at,
          } : undefined;

          return {
            product,
            pfmea,
            controlPlan,
            sop,
            inspection,
          };
        })
      );

      setProductDocuments(
        docsWithProducts.filter(
          (d) => d.pfmea || d.controlPlan || d.sop || d.inspection
        )
      );
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!mounted) {
    return <div className="min-h-screen" />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-gray-900">품질 문서 관리</h1>
            <Link
              href="/documents/generate"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              문서 생성
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500 font-medium">로딩 중...</div>
          </div>
        ) : productDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-lg border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">생성된 문서가 없습니다</h2>
            <p className="text-gray-600 mb-6">먼저 제품을 등록한 후 문서를 생성해주세요.</p>
            <Link
              href="/products/new"
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              제품 등록하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {productDocuments.map((doc) => (
              <div
                key={doc.product.id}
                className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow p-6"
              >
                {/* Product Header */}
                <div className="mb-6 pb-4 border-b border-gray-100">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {doc.product.name}
                  </h2>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-sm text-gray-600">
                      <span className="font-medium">코드:</span> {doc.product.code}
                    </span>
                    <span className="text-sm text-gray-600">
                      <span className="font-medium">고객사:</span> {doc.product.customer || '-'}
                    </span>
                  </div>
                </div>

                {/* Document Status Grid */}
                <div className="grid grid-cols-2 gap-6">
                  <DocumentStatus
                    document={doc.pfmea}
                    type="PFMEA"
                    documentPath={doc.pfmea ? `/documents/pfmea/${doc.pfmea.id}` : '#'}
                  />
                  <DocumentStatus
                    document={doc.controlPlan}
                    type="관리계획서"
                    documentPath={doc.controlPlan ? `/documents/control-plan/${doc.controlPlan.id}` : '#'}
                  />
                  <DocumentStatus
                    document={doc.sop}
                    type="작업표준서"
                    documentPath={doc.sop ? `/documents/sop/${doc.sop.id}` : '#'}
                  />
                  <DocumentStatus
                    document={doc.inspection}
                    type="검사기준서"
                    documentPath={doc.inspection ? `/documents/inspection/${doc.inspection.id}` : '#'}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
