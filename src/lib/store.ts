// Supabase 기반 APQP 데이터 레이어
// 모든 메서드가 async → Promise 반환

import { supabase } from './supabase';

// ============ 타입 정의 ============

export interface Product {
  id: string;
  name: string;
  code: string;
  customer: string;
  description: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface Characteristic {
  id: string;
  product_id: string;
  name: string;
  type: 'product' | 'process';
  category: 'critical' | 'major' | 'minor';
  specification: string;
  lsl: number | null;
  usl: number | null;
  unit: string;
  measurement_method: string;
  process_name: string;
  created_at: string;
}

export interface PfmeaHeader {
  id: string;
  product_id: string;
  process_name: string;
  revision: number;
  status: 'draft' | 'review' | 'approved';
  created_at: string;
  updated_at: string;
}

export interface PfmeaLine {
  id: string;
  pfmea_id: string;
  characteristic_id: string;
  process_step: string;
  potential_failure_mode: string;
  potential_effect: string;
  severity: number;
  potential_cause: string;
  occurrence: number;
  current_control_prevention: string;
  current_control_detection: string;
  detection: number;
  rpn: number;
  action_priority: 'H' | 'M' | 'L';
  recommended_action: string;
  created_at: string;
}

export interface ControlPlan {
  id: string;
  pfmea_id: string;
  product_id: string;
  name: string;
  revision: number;
  status: 'draft' | 'review' | 'approved';
  created_at: string;
  updated_at: string;
}

export interface ControlPlanItem {
  id: string;
  control_plan_id: string;
  pfmea_line_id: string;
  characteristic_id: string;
  process_step: string;
  characteristic_name: string;
  control_type: 'prevention' | 'detection';
  control_method: string;
  sample_size: string;
  frequency: string;
  reaction_plan: string;
  responsible: string;
  created_at: string;
}

export interface Sop {
  id: string;
  control_plan_id: string;
  product_id: string;
  name: string;
  revision: number;
  status: 'draft' | 'review' | 'approved';
  created_at: string;
  updated_at: string;
}

export interface SopStep {
  id: string;
  sop_id: string;
  linked_cp_item_id: string;
  step_no: number;
  process_step: string;
  action: string;
  key_point: string;
  safety_note: string;
  quality_point: string;
  tools_equipment: string;
  estimated_time_sec: number;
  created_at: string;
}

export interface InspectionStandard {
  id: string;
  control_plan_id: string;
  product_id: string;
  name: string;
  revision: number;
  status: 'draft' | 'review' | 'approved';
  created_at: string;
  updated_at: string;
}

export interface InspectionItem {
  id: string;
  inspection_standard_id: string;
  linked_cp_item_id: string;
  characteristic_id: string;
  item_no: number;
  inspection_item_name: string;
  specification: string;
  lsl: number | null;
  usl: number | null;
  unit: string;
  inspection_method: string;
  measurement_tool: string;
  sample_size: string;
  frequency: string;
  acceptance_criteria: string;
  ng_handling: string;
  inspection_type: 'incoming' | 'in-process' | 'final' | 'outgoing';
  created_at: string;
}

// ============ 제품 (Products) ============

export const productStore = {
  getAll: async (): Promise<Product[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('productStore.getAll:', error); return []; }
    return data || [];
  },

  getById: async (id: string): Promise<Product | null> => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    if (error) { console.error('productStore.getById:', error); return null; }
    return data;
  },

  create: async (input: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<Product> => {
    const { data, error } = await supabase
      .from('products')
      .insert({ ...input, status: 'active' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  update: async (id: string, input: Partial<Product>): Promise<Product | null> => {
    const { data, error } = await supabase
      .from('products')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('productStore.update:', error); return null; }
    return data;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) { console.error('productStore.delete:', error); return false; }
    return true;
  },
};

// ============ 특성 (Characteristics) ============

export const characteristicStore = {
  getAll: async (): Promise<Characteristic[]> => {
    const { data, error } = await supabase.from('characteristics').select('*');
    if (error) { console.error(error); return []; }
    return data || [];
  },

  getByProductId: async (productId: string): Promise<Characteristic[]> => {
    const { data, error } = await supabase
      .from('characteristics')
      .select('*')
      .eq('product_id', productId)
      .order('created_at');
    if (error) { console.error(error); return []; }
    return data || [];
  },

  getById: async (id: string): Promise<Characteristic | null> => {
    const { data, error } = await supabase
      .from('characteristics')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  },

  create: async (input: Omit<Characteristic, 'id' | 'created_at'>): Promise<Characteristic> => {
    const { data, error } = await supabase
      .from('characteristics')
      .insert(input)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  update: async (id: string, input: Partial<Characteristic>): Promise<Characteristic | null> => {
    const { data, error } = await supabase
      .from('characteristics')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) return null;
    return data;
  },

  delete: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('characteristics').delete().eq('id', id);
    return !error;
  },

  deleteByProductId: async (productId: string): Promise<void> => {
    await supabase.from('characteristics').delete().eq('product_id', productId);
  },
};

// ============ PFMEA ============

export const pfmeaStore = {
  getHeaders: async (): Promise<PfmeaHeader[]> => {
    const { data } = await supabase.from('pfmea_headers').select('*');
    return data || [];
  },

  getHeaderByProductId: async (productId: string): Promise<PfmeaHeader | null> => {
    const { data } = await supabase
      .from('pfmea_headers')
      .select('*')
      .eq('product_id', productId)
      .limit(1)
      .maybeSingle();
    return data;
  },

  getHeaderById: async (id: string): Promise<PfmeaHeader | null> => {
    const { data } = await supabase
      .from('pfmea_headers')
      .select('*')
      .eq('id', id)
      .single();
    return data ?? null;
  },

  getLines: async (pfmeaId: string): Promise<PfmeaLine[]> => {
    const { data } = await supabase
      .from('pfmea_lines')
      .select('*')
      .eq('pfmea_id', pfmeaId);
    return data || [];
  },

  getLineById: async (id: string): Promise<PfmeaLine | null> => {
    const { data } = await supabase.from('pfmea_lines').select('*').eq('id', id).single();
    return data ?? null;
  },

  createHeader: async (input: Omit<PfmeaHeader, 'id' | 'created_at' | 'updated_at' | 'revision' | 'status'>): Promise<PfmeaHeader> => {
    const { data, error } = await supabase
      .from('pfmea_headers')
      .insert({ ...input, revision: 1, status: 'draft' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  createLine: async (input: Omit<PfmeaLine, 'id' | 'created_at' | 'rpn' | 'action_priority'>): Promise<PfmeaLine> => {
    const rpn = input.severity * input.occurrence * input.detection;
    const action_priority = rpn >= 200 ? 'H' : rpn >= 100 ? 'M' : 'L';
    const { data, error } = await supabase
      .from('pfmea_lines')
      .insert({ ...input, rpn, action_priority })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  updateLine: async (id: string, input: Partial<PfmeaLine>): Promise<PfmeaLine | null> => {
    // RPN 재계산 필요 시 기존 값 가져오기
    let updateData = { ...input };
    if (input.severity !== undefined || input.occurrence !== undefined || input.detection !== undefined) {
      const { data: existing } = await supabase.from('pfmea_lines').select('severity,occurrence,detection').eq('id', id).single();
      if (existing) {
        const s = input.severity ?? existing.severity;
        const o = input.occurrence ?? existing.occurrence;
        const d = input.detection ?? existing.detection;
        const rpn = s * o * d;
        updateData = { ...updateData, rpn, action_priority: rpn >= 200 ? 'H' : rpn >= 100 ? 'M' : 'L' };
      }
    }
    const { data, error } = await supabase.from('pfmea_lines').update(updateData).eq('id', id).select().single();
    if (error) return null;
    return data;
  },

  updateHeaderStatus: async (id: string, status: 'draft' | 'review' | 'approved'): Promise<PfmeaHeader | null> => {
    const { data, error } = await supabase
      .from('pfmea_headers')
      .update({ status })
      .eq('id', id)
      .select()
      .single();
    if (error) return null;
    return data;
  },

  deleteByProductId: async (productId: string): Promise<void> => {
    // CASCADE 가 처리하므로 헤더만 삭제
    await supabase.from('pfmea_headers').delete().eq('product_id', productId);
  },
};

// ============ Control Plan ============

export const controlPlanStore = {
  getAll: async (): Promise<ControlPlan[]> => {
    const { data } = await supabase.from('control_plans').select('*');
    return data || [];
  },

  getByPfmeaId: async (pfmeaId: string): Promise<ControlPlan | null> => {
    const { data } = await supabase.from('control_plans').select('*').eq('pfmea_id', pfmeaId).limit(1).maybeSingle();
    return data;
  },

  getByProductId: async (productId: string): Promise<ControlPlan | null> => {
    const { data } = await supabase.from('control_plans').select('*').eq('product_id', productId).limit(1).maybeSingle();
    return data;
  },

  getById: async (id: string): Promise<ControlPlan | null> => {
    const { data } = await supabase.from('control_plans').select('*').eq('id', id).single();
    return data ?? null;
  },

  getItems: async (cpId: string): Promise<ControlPlanItem[]> => {
    const { data } = await supabase.from('control_plan_items').select('*').eq('control_plan_id', cpId);
    return data || [];
  },

  getItemById: async (id: string): Promise<ControlPlanItem | null> => {
    const { data } = await supabase.from('control_plan_items').select('*').eq('id', id).single();
    return data ?? null;
  },

  create: async (input: Omit<ControlPlan, 'id' | 'created_at' | 'updated_at' | 'revision' | 'status'>): Promise<ControlPlan> => {
    const { data, error } = await supabase
      .from('control_plans')
      .insert({ ...input, revision: 1, status: 'draft' })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  createItem: async (input: Omit<ControlPlanItem, 'id' | 'created_at'>): Promise<ControlPlanItem> => {
    const { data, error } = await supabase.from('control_plan_items').insert(input).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  updateItem: async (id: string, input: Partial<ControlPlanItem>): Promise<ControlPlanItem | null> => {
    const { data } = await supabase.from('control_plan_items').update(input).eq('id', id).select().single();
    return data ?? null;
  },

  updateStatus: async (id: string, status: 'draft' | 'review' | 'approved'): Promise<ControlPlan | null> => {
    const { data } = await supabase.from('control_plans').update({ status }).eq('id', id).select().single();
    return data ?? null;
  },
};

// ============ SOP ============

export const sopStore = {
  getAll: async (): Promise<Sop[]> => {
    const { data } = await supabase.from('sops').select('*');
    return data || [];
  },

  getByCpId: async (cpId: string): Promise<Sop | null> => {
    const { data } = await supabase.from('sops').select('*').eq('control_plan_id', cpId).limit(1).maybeSingle();
    return data;
  },

  getByProductId: async (productId: string): Promise<Sop | null> => {
    const { data } = await supabase.from('sops').select('*').eq('product_id', productId).limit(1).maybeSingle();
    return data;
  },

  getById: async (id: string): Promise<Sop | null> => {
    const { data } = await supabase.from('sops').select('*').eq('id', id).single();
    return data ?? null;
  },

  getSteps: async (sopId: string): Promise<SopStep[]> => {
    const { data } = await supabase.from('sop_steps').select('*').eq('sop_id', sopId).order('step_no');
    return data || [];
  },

  create: async (input: Omit<Sop, 'id' | 'created_at' | 'updated_at' | 'revision' | 'status'>): Promise<Sop> => {
    const { data, error } = await supabase.from('sops').insert({ ...input, revision: 1, status: 'draft' }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  createStep: async (input: Omit<SopStep, 'id' | 'created_at'>): Promise<SopStep> => {
    const { data, error } = await supabase.from('sop_steps').insert(input).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  updateStep: async (id: string, input: Partial<SopStep>): Promise<SopStep | null> => {
    const { data } = await supabase.from('sop_steps').update(input).eq('id', id).select().single();
    return data ?? null;
  },

  updateStatus: async (id: string, status: 'draft' | 'review' | 'approved'): Promise<Sop | null> => {
    const { data } = await supabase.from('sops').update({ status }).eq('id', id).select().single();
    return data ?? null;
  },
};

// ============ 검사기준서 (Inspection Standard) ============

export const inspectionStore = {
  getAll: async (): Promise<InspectionStandard[]> => {
    const { data } = await supabase.from('inspection_standards').select('*');
    return data || [];
  },

  getByCpId: async (cpId: string): Promise<InspectionStandard | null> => {
    const { data } = await supabase.from('inspection_standards').select('*').eq('control_plan_id', cpId).limit(1).maybeSingle();
    return data;
  },

  getByProductId: async (productId: string): Promise<InspectionStandard | null> => {
    const { data } = await supabase.from('inspection_standards').select('*').eq('product_id', productId).limit(1).maybeSingle();
    return data;
  },

  getById: async (id: string): Promise<InspectionStandard | null> => {
    const { data } = await supabase.from('inspection_standards').select('*').eq('id', id).single();
    return data ?? null;
  },

  getItems: async (isId: string): Promise<InspectionItem[]> => {
    const { data } = await supabase.from('inspection_items').select('*').eq('inspection_standard_id', isId).order('item_no');
    return data || [];
  },

  create: async (input: Omit<InspectionStandard, 'id' | 'created_at' | 'updated_at' | 'revision' | 'status'>): Promise<InspectionStandard> => {
    const { data, error } = await supabase.from('inspection_standards').insert({ ...input, revision: 1, status: 'draft' }).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  createItem: async (input: Omit<InspectionItem, 'id' | 'created_at'>): Promise<InspectionItem> => {
    const { data, error } = await supabase.from('inspection_items').insert(input).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  updateItem: async (id: string, input: Partial<InspectionItem>): Promise<InspectionItem | null> => {
    const { data } = await supabase.from('inspection_items').update(input).eq('id', id).select().single();
    return data ?? null;
  },

  updateStatus: async (id: string, status: 'draft' | 'review' | 'approved'): Promise<InspectionStandard | null> => {
    const { data } = await supabase.from('inspection_standards').update({ status }).eq('id', id).select().single();
    return data ?? null;
  },
};

// ============ 통계 ============

export const statsStore = {
  getStats: async () => {
    const [products, chars, cps, sops, inspections, pfmeas] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('characteristics').select('id', { count: 'exact', head: true }),
      supabase.from('control_plans').select('id', { count: 'exact', head: true }),
      supabase.from('sops').select('id', { count: 'exact', head: true }),
      supabase.from('inspection_standards').select('id', { count: 'exact', head: true }),
      supabase.from('pfmea_headers').select('id', { count: 'exact', head: true }),
    ]);
    return {
      products: products.count ?? 0,
      characteristics: chars.count ?? 0,
      controlPlans: cps.count ?? 0,
      sops: sops.count ?? 0,
      inspections: inspections.count ?? 0,
      pfmeas: pfmeas.count ?? 0,
    };
  },
};

// ============ AI 문서 생성 (규칙 기반) ============

export async function generatePfmeaForProduct(productId: string): Promise<{ header: PfmeaHeader; lines: PfmeaLine[] }> {
  const product = await productStore.getById(productId);
  const chars = await characteristicStore.getByProductId(productId);
  if (!product || chars.length === 0) throw new Error('제품 또는 특성이 없습니다.');

  const existing = await pfmeaStore.getHeaderByProductId(productId);
  if (existing) {
    return { header: existing, lines: await pfmeaStore.getLines(existing.id) };
  }

  const header = await pfmeaStore.createHeader({
    product_id: productId,
    process_name: product.name + ' 제조공정',
  });

  const lines: PfmeaLine[] = [];
  for (const char of chars) {
    const isCritical = char.category === 'critical';
    const isMajor = char.category === 'major';
    const severity = isCritical ? 9 : isMajor ? 7 : 4;
    const occurrence = isCritical ? 5 : isMajor ? 4 : 3;
    const detection = isCritical ? 6 : isMajor ? 5 : 3;

    const line = await pfmeaStore.createLine({
      pfmea_id: header.id,
      characteristic_id: char.id,
      process_step: char.process_name || '가공',
      potential_failure_mode: `${char.name} 규격 이탈`,
      potential_effect: isCritical ? '제품 기능 불량 및 고객 불만' : isMajor ? '조립 불량 가능성' : '외관 불량',
      severity,
      potential_cause: `${char.process_name || '가공'} 조건 변동`,
      occurrence,
      current_control_prevention: `${char.process_name || '가공'} 조건 표준화`,
      current_control_detection: char.measurement_method || '측정기기 검사',
      detection,
      recommended_action: isCritical
        ? 'SPC 관리 도입 및 공정능력 확인'
        : isMajor
        ? '정기 검사 주기 단축'
        : '작업자 자주검사 실시',
    });
    lines.push(line);
  }
  return { header, lines };
}

export async function generateControlPlanForPfmea(pfmeaId: string, productId: string): Promise<{ plan: ControlPlan; items: ControlPlanItem[] }> {
  const existingPlan = await controlPlanStore.getByPfmeaId(pfmeaId);
  if (existingPlan) {
    return { plan: existingPlan, items: await controlPlanStore.getItems(existingPlan.id) };
  }

  const pfmeaLines = await pfmeaStore.getLines(pfmeaId);
  const product = await productStore.getById(productId);

  const plan = await controlPlanStore.create({
    pfmea_id: pfmeaId,
    product_id: productId,
    name: `${product?.name || ''} 관리계획서`,
  });

  const items: ControlPlanItem[] = [];
  for (const line of pfmeaLines) {
    const char = await characteristicStore.getById(line.characteristic_id);
    // 예방 관리
    items.push(await controlPlanStore.createItem({
      control_plan_id: plan.id,
      pfmea_line_id: line.id,
      characteristic_id: line.characteristic_id,
      process_step: line.process_step,
      characteristic_name: char?.name || '',
      control_type: 'prevention',
      control_method: line.current_control_prevention || '공정 조건 관리',
      sample_size: line.action_priority === 'H' ? '5' : '3',
      frequency: line.action_priority === 'H' ? '매 시간' : '매 로트',
      reaction_plan: '공정 중단 후 원인 조사',
      responsible: '작업자',
    }));
    // 검출 관리
    items.push(await controlPlanStore.createItem({
      control_plan_id: plan.id,
      pfmea_line_id: line.id,
      characteristic_id: line.characteristic_id,
      process_step: line.process_step,
      characteristic_name: char?.name || '',
      control_type: 'detection',
      control_method: line.current_control_detection || char?.measurement_method || '측정 검사',
      sample_size: line.action_priority === 'H' ? '전수' : '5',
      frequency: line.action_priority === 'H' ? '전수검사' : '매 로트',
      reaction_plan: '부적합품 격리 및 재검사',
      responsible: '검사원',
    }));
  }
  return { plan, items };
}

export async function generateSopForControlPlan(cpId: string, productId: string): Promise<{ sop: Sop; steps: SopStep[] }> {
  const existingSop = await sopStore.getByCpId(cpId);
  if (existingSop) {
    return { sop: existingSop, steps: await sopStore.getSteps(existingSop.id) };
  }

  const cpItems = await controlPlanStore.getItems(cpId);
  const product = await productStore.getById(productId);

  const sop = await sopStore.create({
    control_plan_id: cpId,
    product_id: productId,
    name: `${product?.name || ''} 작업표준서`,
  });

  const steps: SopStep[] = [];
  const preventionItems = cpItems.filter(i => i.control_type === 'prevention');

  for (let idx = 0; idx < preventionItems.length; idx++) {
    const item = preventionItems[idx];
    const char = await characteristicStore.getById(item.characteristic_id);
    const spec = char ? `${char.specification || ''} ${char.lsl !== null && char.usl !== null ? `(${char.lsl}~${char.usl}${char.unit})` : ''}` : '';

    steps.push(await sopStore.createStep({
      sop_id: sop.id,
      linked_cp_item_id: item.id,
      step_no: idx + 1,
      process_step: item.process_step,
      action: `${item.process_step} - ${item.control_method} 실시`,
      key_point: `【관리 포인트】${spec}\n【확인 방법】${item.control_method}\n【이상 시 조치】${item.reaction_plan}`,
      safety_note: '보호구 착용 필수, 안전 수칙 준수',
      quality_point: `${char?.category === 'critical' ? '★ 중요특성 - ' : ''}${item.control_method}으로 확인`,
      tools_equipment: char?.measurement_method || '측정기기',
      estimated_time_sec: 120,
    }));
  }
  return { sop, steps };
}

export async function generateInspectionForControlPlan(cpId: string, productId: string): Promise<{ standard: InspectionStandard; items: InspectionItem[] }> {
  const existing = await inspectionStore.getByCpId(cpId);
  if (existing) {
    return { standard: existing, items: await inspectionStore.getItems(existing.id) };
  }

  const cpItems = await controlPlanStore.getItems(cpId);
  const product = await productStore.getById(productId);

  const standard = await inspectionStore.create({
    control_plan_id: cpId,
    product_id: productId,
    name: `${product?.name || ''} 검사기준서`,
  });

  const items: InspectionItem[] = [];
  const detectionItems = cpItems.filter(i => i.control_type === 'detection');

  for (let idx = 0; idx < detectionItems.length; idx++) {
    const cpItem = detectionItems[idx];
    const char = await characteristicStore.getById(cpItem.characteristic_id);
    const hasSpec = char && char.lsl !== null && char.usl !== null;

    items.push(await inspectionStore.createItem({
      inspection_standard_id: standard.id,
      linked_cp_item_id: cpItem.id,
      characteristic_id: cpItem.characteristic_id,
      item_no: idx + 1,
      inspection_item_name: char?.name || cpItem.characteristic_name,
      specification: char?.specification || '',
      lsl: char?.lsl ?? null,
      usl: char?.usl ?? null,
      unit: char?.unit || '',
      inspection_method: cpItem.control_method,
      measurement_tool: char?.measurement_method || '측정기기',
      sample_size: cpItem.sample_size,
      frequency: cpItem.frequency,
      acceptance_criteria: hasSpec
        ? `${char.lsl}${char.unit} ~ ${char.usl}${char.unit}`
        : '한도 샘플 기준 일치',
      ng_handling: '부적합품 격리 → 재검사 → 원인분석 및 시정조치',
      inspection_type: 'in-process',
    }));
  }
  return { standard, items };
}
