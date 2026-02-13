// Supabase 기반 APQP 데이터 레이어
// 모든 메서드가 async → Promise 반환

import { supabase } from './supabase';

// ============ AP 계산 (AIAG & VDA FMEA Handbook 2019) ============

/**
 * S-O-D 조합 테이블 기반 Action Priority 계산
 * AIAG & VDA FMEA Handbook (1st Edition, 2019) 기준
 */
export function calcAP(s: number, o: number, d: number): 'H' | 'M' | 'L' {
  if (s >= 9) {
    // S = 9~10 (안전/법규)
    if (o >= 2) return 'H';
    // O = 1
    if (d >= 5) return 'H';
    return 'M';
  }
  if (s >= 7) {
    // S = 7~8 (기능상실/저하)
    if (o >= 7) return 'H';
    if (o >= 4) {
      if (d >= 3) return 'H';
      return 'M';
    }
    if (o >= 2) {
      if (d >= 7) return 'H';
      if (d >= 3) return 'M';
      return 'L';
    }
    // O = 1
    if (d >= 9) return 'H';
    if (d >= 5) return 'M';
    return 'L';
  }
  if (s >= 4) {
    // S = 4~6 (편의/외관)
    if (o >= 7) {
      if (d >= 3) return 'H';
      return 'M';
    }
    if (o >= 4) {
      if (d >= 7) return 'H';
      if (d >= 3) return 'M';
      return 'L';
    }
    if (o >= 2) {
      if (d >= 5) return 'M';
      return 'L';
    }
    // O = 1
    if (d >= 9) return 'M';
    return 'L';
  }
  // S = 1~3
  if (o >= 7) {
    if (d >= 9) return 'H';
    if (d >= 3) return 'M';
    return 'L';
  }
  if (o >= 4) {
    if (d >= 7) return 'M';
    return 'L';
  }
  if (o >= 2) {
    if (d >= 9) return 'M';
    return 'L';
  }
  // O = 1
  return 'L';
}

// ============ 타입 정의 ============

export interface Product {
  id: string;
  name: string;
  code: string;
  customer: string;
  vehicle_model: string;
  part_number: string;
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
  doc_number: string;
  author: string;
  revision: number;
  status: 'draft' | 'review' | 'approved';
  created_at: string;
  updated_at: string;
}

export interface PfmeaLine {
  id: string;
  pfmea_id: string;
  step_no: number;
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
  doc_number: string;
  author: string;
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
  process_number: string;
  process_step: string;
  machine_device: string;
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
  doc_number: string;
  author: string;
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
  doc_number: string;
  author: string;
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

  updateHeader: async (id: string, input: Partial<PfmeaHeader>): Promise<PfmeaHeader | null> => {
    const { data, error } = await supabase
      .from('pfmea_headers')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    if (error) return null;
    return data;
  },

  deleteLine: async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('pfmea_lines').delete().eq('id', id);
    return !error;
  },

  createLine: async (input: Omit<PfmeaLine, 'id' | 'created_at' | 'rpn' | 'action_priority' | 'step_no'> & { step_no?: number }): Promise<PfmeaLine> => {
    // step_no 자동 계산: 기존 라인 수 + 1
    let stepNo = input.step_no;
    if (!stepNo) {
      const { count } = await supabase
        .from('pfmea_lines')
        .select('*', { count: 'exact', head: true })
        .eq('pfmea_id', input.pfmea_id);
      stepNo = (count ?? 0) + 1;
    }

    // rpn은 DB에서 GENERATED ALWAYS AS (severity * occurrence * detection) STORED
    const insertData = { ...input, step_no: stepNo };
    const { data, error } = await supabase
      .from('pfmea_lines')
      .insert(insertData)
      .select()
      .single();
    if (error) throw new Error(error.message);

    // S-O-D 조합 테이블로 action_priority 계산 (AIAG & VDA 2019)
    const rpn = data.rpn ?? (input.severity * input.occurrence * input.detection);
    const action_priority = calcAP(input.severity, input.occurrence, input.detection);
    if (action_priority !== data.action_priority) {
      await supabase.from('pfmea_lines').update({ action_priority }).eq('id', data.id);
    }
    return { ...data, rpn, action_priority };
  },

  updateLine: async (id: string, input: Partial<PfmeaLine>): Promise<PfmeaLine | null> => {
    // rpn은 DB GENERATED 컬럼이므로 제거, action_priority는 별도 처리
    const { rpn: _rpn, ...safeInput } = input as Record<string, unknown>;
    let updateData = { ...safeInput };

    // S/O/D 변경 시 action_priority 재계산 (AIAG & VDA 2019 S-O-D 조합 테이블)
    if (input.severity !== undefined || input.occurrence !== undefined || input.detection !== undefined) {
      const { data: existing } = await supabase.from('pfmea_lines').select('severity,occurrence,detection').eq('id', id).single();
      if (existing) {
        const s = input.severity ?? existing.severity;
        const o = input.occurrence ?? existing.occurrence;
        const d = input.detection ?? existing.detection;
        updateData = { ...updateData, action_priority: calcAP(s, o, d) };
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
    // control_plans has no product_id column; query through pfmea_headers FK chain
    const { data: pfmea } = await supabase
      .from('pfmea_headers')
      .select('id')
      .eq('product_id', productId)
      .limit(1)
      .maybeSingle();
    if (!pfmea) return null;
    const { data } = await supabase
      .from('control_plans')
      .select('*')
      .eq('pfmea_id', pfmea.id)
      .limit(1)
      .maybeSingle();
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

  duplicate: async (sourceCpId: string, targetProductId: string): Promise<ControlPlan> => {
    const sourceItems = await controlPlanStore.getItems(sourceCpId);
    const targetProduct = await productStore.getById(targetProductId);

    const newPlan = await controlPlanStore.create({
      pfmea_id: '',
      product_id: targetProductId,
      name: `${targetProduct?.name || ''} 관리계획서`,
      doc_number: '',
      author: '',
    });

    for (const item of sourceItems) {
      await controlPlanStore.createItem({
        control_plan_id: newPlan.id,
        pfmea_line_id: '',
        characteristic_id: '',
        process_number: item.process_number,
        process_step: item.process_step,
        machine_device: item.machine_device,
        characteristic_name: item.characteristic_name,
        control_type: item.control_type,
        control_method: item.control_method,
        sample_size: item.sample_size,
        frequency: item.frequency,
        reaction_plan: item.reaction_plan,
        responsible: item.responsible,
      });
    }

    return newPlan;
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
    // sops has no product_id column; query through pfmea → control_plan chain
    const cp = await controlPlanStore.getByProductId(productId);
    if (!cp) return null;
    const { data } = await supabase
      .from('sops')
      .select('*')
      .eq('control_plan_id', cp.id)
      .limit(1)
      .maybeSingle();
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
    // inspection_standards has no product_id column; query through pfmea → control_plan chain
    const cp = await controlPlanStore.getByProductId(productId);
    if (!cp) return null;
    const { data } = await supabase
      .from('inspection_standards')
      .select('*')
      .eq('control_plan_id', cp.id)
      .limit(1)
      .maybeSingle();
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

// ============ 문서번호 자동 생성 ============

export function generateDocNumber(prefix: string, partNumber: string, revision: number): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const pn = partNumber || 'NOPN';
  return `${prefix}-${pn}-${yy}${mm}-R${String(revision).padStart(2, '0')}`;
}

// ============ AI 검토 (규칙기반 자동 완성) ============

export function aiReviewPfmeaLine(input: {
  process_step: string;
  potential_failure_mode: string;
  potential_effect: string;
  characteristic_category?: string;
}): {
  severity: number;
  potential_cause: string;
  occurrence: number;
  current_control_prevention: string;
  current_control_detection: string;
  detection: number;
  recommended_action: string;
} {
  const effect = input.potential_effect;
  const mode = input.potential_failure_mode;
  const step = input.process_step;
  const cat = input.characteristic_category;

  // --- Severity 판정 (AIAG 4th Edition 기준) ---
  // S10: 경고없는 안전위험  S9: 경고있는 안전위험  S8: 기능 상실
  // S7: 기능 저하  S6: 기능 저하(부분)  S5: 편의기능 저하
  // S4: 외관/소음(대부분 인지)  S3: 외관/소음(일부 인지)  S2: 경미한 불량  S1: 영향 없음
  let severity = 5;
  if (/안전|법규|화재|인체|사고|사망|상해|위험/i.test(effect)) severity = 10;
  else if (/경고.*안전|경고.*위험/i.test(effect)) severity = 9;
  else if (/작동.*불능|기능.*상실|기능.*불량|라인.*정지|100%.*스크랩/i.test(effect)) severity = 8;
  else if (/성능.*저하|기능.*저하|라인.*외.*수리|스크랩/i.test(effect)) severity = 7;
  else if (/편의.*불가|매우.*불만|재작업.*라인.*외|100%.*재작업/i.test(effect)) severity = 6;
  else if (/편의.*저하|고객.*불만|일부.*재작업/i.test(effect)) severity = 5;
  else if (/외관|소음|진동|대부분.*인지|재작업.*라인.*내/i.test(effect)) severity = 4;
  else if (/일부.*인지|선별/i.test(effect)) severity = 3;
  else if (/경미|미미|식별.*어려/i.test(effect)) severity = 2;
  else if (/영향.*없|인지.*불가/i.test(effect)) severity = 1;
  // 특성등급 보정: 안전 관련 부품은 최소 S=8 이상 (기준서 규칙)
  if (cat === 'critical') severity = Math.max(severity, 9);
  else if (cat === 'major') severity = Math.max(severity, 7);

  // --- Potential Cause 생성 (공정 유형별) ---
  const causes: string[] = [];
  if (/가공|절삭|선반|밀링|드릴|CNC|연삭/i.test(step)) {
    causes.push('공구 마모/파손', '가공 조건(이송/회전수) 변동', '소재 경도 편차', '설비 정밀도 저하');
  } else if (/조립|체결|삽입|압입/i.test(step)) {
    causes.push('체결 토크 변동', '부품 누락/오삽입', '작업자 숙련도 부족', '지그/치구 마모');
  } else if (/용접|웰딩|브레이징/i.test(step)) {
    causes.push('용접 전류/전압 변동', '전극 마모', '모재 표면 오염', '용접 시간 부적절');
  } else if (/도장|코팅|표면|도금/i.test(step)) {
    causes.push('도장/코팅 조건 변동', '환경 온습도 부적절', '전처리 불량', '피도물 표면 오염');
  } else if (/검사|측정/i.test(step)) {
    causes.push('측정기 교정 불량', '검사 기준 모호', '작업자 판정 오류', '측정 환경(온도/진동) 영향');
  } else if (/프레스|성형|단조|스탬핑/i.test(step)) {
    causes.push('금형 마모/파손', '프레스 압력 변동', '소재 두께 편차', '윤활유 부족');
  } else if (/열처리|소둔|담금질|템퍼링/i.test(step)) {
    causes.push('열처리 온도 편차', '유지 시간 부적절', '냉각 속도 불균일', '장입 방법 부적절');
  } else if (/세척|세정/i.test(step)) {
    causes.push('세척액 농도 변동', '세척 시간 부족', '건조 불량', '이물 재부착');
  } else {
    causes.push(`${step} 공정 조건 변동`, '설비 정밀도 저하', '작업자 숙련도 부족');
  }
  const potential_cause = causes.join(', ');

  // --- Occurrence 판정 (AIAG 기준: 고장모드 + 공정 유형 기반) ---
  // O10: ≥100,000ppm  O7: 10,000ppm  O5: 500ppm  O3: 10ppm  O1: 고장 제거
  let occurrence = 4; // 기본: 낮음 (100ppm, Cpk≈1.17)

  // 고장모드 기반 판정
  if (/규격.*이탈|치수.*불량|편차.*초과/i.test(mode)) occurrence = 5;       // 다소 낮음: 가끔 발생
  else if (/누락|빠짐|미삽입|미체결/i.test(mode)) occurrence = 3;          // 매우 낮음: Poka-Yoke로 저감 가능
  else if (/파손|크랙|균열|파단/i.test(mode)) occurrence = 3;              // 매우 낮음: 드물게 발생
  else if (/오염|이물|잔류/i.test(mode)) occurrence = 4;                   // 낮음: 관리 시 드물게 발생
  else if (/변형|뒤틀림|휨/i.test(mode)) occurrence = 4;                   // 낮음
  else if (/마모|침식|부식/i.test(mode)) occurrence = 5;                   // 다소 낮음: 시간 의존적
  else if (/기포|핀홀|기공/i.test(mode)) occurrence = 5;                   // 다소 낮음
  else if (/조도|표면.*거칠/i.test(mode)) occurrence = 4;                  // 낮음
  else if (/용접.*미착|접합.*불량/i.test(mode)) occurrence = 4;            // 낮음

  // 공정 유형에 따른 보정 (신규/특수 공정은 보수적 판정)
  if (/수작업|수동/i.test(step)) occurrence = Math.max(occurrence, 5);     // 수작업은 최소 O=5
  if (/신규|최초|시작품/i.test(step)) occurrence = Math.max(occurrence, 6); // 신규공정 최소 O=6 (기준서 규칙)

  // --- 예방관리 생성 (공정 유형별 구체화) ---
  let current_control_prevention = '작업표준서 준수, 자주검사 실시';
  if (/가공|절삭|CNC|연삭/i.test(step)) {
    current_control_prevention = '공정 조건(이송/회전수) 표준화, 공구 수명 관리(교체 주기 설정), 정기 설비 점검, 초물 검사';
  } else if (/조립|체결|삽입|압입/i.test(step)) {
    current_control_prevention = '토크 렌치 교정 사용, 작업표준서 준수, Poka-Yoke 적용, 부품 Kit화';
  } else if (/용접|웰딩/i.test(step)) {
    current_control_prevention = '용접 파라미터(전류/전압/시간) 관리, 전극 교체 주기 관리, 모재 표면 청소';
  } else if (/도장|코팅|도금/i.test(step)) {
    current_control_prevention = '도장/코팅 조건 관리, 환경(온습도) 관리, 전처리 확인, 정기 도막/두께 확인';
  } else if (/프레스|성형|단조/i.test(step)) {
    current_control_prevention = '금형 점검/관리, 프레스 압력 모니터링, 소재 수입검사, 윤활유 관리';
  } else if (/열처리/i.test(step)) {
    current_control_prevention = '열처리 온도/시간 모니터링, 장입 방법 표준화, 로(furnace) 온도 교정';
  } else if (/세척|세정/i.test(step)) {
    current_control_prevention = '세척액 농도 관리, 세척 시간/온도 표준화, 건조 조건 관리';
  }

  // --- 검출관리 생성 (고장모드별 구체화) ---
  let current_control_detection = '육안 검사, 측정 검사';
  if (/치수|규격|길이|직경|두께|내경|외경/i.test(mode)) {
    current_control_detection = '측정기기(캘리퍼/마이크로미터/CMM) 검사, SPC 모니터링';
  } else if (/외관|스크래치|찍힘|흠|도장.*불량/i.test(mode)) {
    current_control_detection = '육안 검사(조명 조건 하), 한도 샘플 비교';
  } else if (/누락|빠짐|미삽입|미체결/i.test(mode)) {
    current_control_detection = 'Poka-Yoke(센서) 감지, 중량 검사, 카운터 확인';
  } else if (/토크|체결력/i.test(mode)) {
    current_control_detection = '토크 검사기 확인, 마킹 확인, 토크 모니터링 시스템';
  } else if (/용접.*불량|접합.*불량|용접.*미착/i.test(mode)) {
    current_control_detection = '인장/파괴 시험, 초음파 검사(UT), 단면 검사';
  } else if (/경도|강도|물성/i.test(mode)) {
    current_control_detection = '경도 시험기, 인장 시험기, 시편 검사';
  } else if (/기포|핀홀|기공/i.test(mode)) {
    current_control_detection = '기밀 시험, 에어 리크 테스트, 육안 검사';
  } else if (/오염|이물|잔류/i.test(mode)) {
    current_control_detection = '청정도 검사, 현미경 검사, 입자 카운터';
  } else if (/변형|뒤틀림|휨|평탄도/i.test(mode)) {
    current_control_detection = '3차원 측정기(CMM), 다이얼 게이지, 평탄도 검사';
  }

  // --- Detection 판정 (AIAG 기준: 검출관리 방법 기반) ---
  // D10: 검출불가  D8: 육안검사  D6: 수동측정+SPC  D4: 후공정 자동검사
  // D3: 자동검출+분리  D2: 자동검출+정지/Poka-Yoke  D1: Fool Proof
  let detection = 6; // 기본: 다소 낮음
  if (/Poka-Yoke|포카요케|자동.*정지|센서.*감지.*정지/i.test(current_control_detection)) detection = 2;
  else if (/자동.*검출.*분리|자동.*라인아웃|자동.*선별/i.test(current_control_detection)) detection = 3;
  else if (/자동.*검사|후공정.*검사|복수.*항목|통계/i.test(current_control_detection)) detection = 4;
  else if (/CMM|3차원|SPC|모니터링|리크.*테스트|기밀/i.test(current_control_detection)) detection = 4;
  else if (/게이지|토크.*검사기|경도.*시험|인장.*시험/i.test(current_control_detection)) detection = 5;
  else if (/수동.*측정|캘리퍼|마이크로미터/i.test(current_control_detection)) detection = 6;
  else if (/이중.*육안|Go.*No.*Go/i.test(current_control_detection)) detection = 7;
  else if (/육안.*검사|한도.*샘플/i.test(current_control_detection)) detection = 7; // 육안검사만으로는 D=7 이하 불가 (기준서 규칙)
  else if (/샘플링|무작위/i.test(current_control_detection)) detection = 9;

  // 기준서 규칙 적용: 육안검사만으로는 D=7 이하 불가
  const hasOnlyVisual = /육안/i.test(current_control_detection) && !/자동|센서|SPC|CMM|게이지|측정기/i.test(current_control_detection);
  if (hasOnlyVisual) detection = Math.max(detection, 7);

  // --- 권장조치 생성 (AP 기반 + Severity 특수 규칙) ---
  const ap = calcAP(severity, occurrence, detection);
  let recommended_action: string;

  if (ap === 'H') {
    // H(High): 반드시 개선조치 실시 - 발생도(O) 저감 우선, 검출도(D) 저감 병행
    const actions: string[] = [];
    if (severity >= 9) actions.push('설계/공정 변경 검토(심각도 저감)');
    if (occurrence >= 5) actions.push('Poka-Yoke 도입 검토', '공정능력(Cpk≥1.33) 확보');
    if (detection >= 7) actions.push('자동 검사 설비 도입', 'SPC 관리 실시');
    actions.push('전수검사 실시', '개선 후 RPN/AP 재평가');
    recommended_action = actions.join(', ');
  } else if (ap === 'M') {
    // M(Medium): 개선조치 권고 - 미조치 시 사유 문서화
    const actions: string[] = [];
    if (occurrence >= 4) actions.push('예방관리 강화(발생도 저감)');
    if (detection >= 6) actions.push('검사 주기 단축', '검출 방법 개선');
    actions.push('작업자 교육 강화', '샘플링 검사 강화');
    recommended_action = actions.join(', ');
  } else {
    // L(Low): 재량적 조치, 정기 리뷰
    recommended_action = '현 관리수준 유지, 작업자 자주검사 실시, 정기 FMEA 리뷰 시 재평가';
  }

  return {
    severity,
    potential_cause,
    occurrence,
    current_control_prevention,
    current_control_detection,
    detection,
    recommended_action,
  };
}

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
    doc_number: '',
    author: '',
  });

  const lines: PfmeaLine[] = [];
  for (const char of chars) {
    const processStep = char.process_name || '가공';

    // 고장모드: 특성 유형에 따라 구체적으로 생성
    let failureMode = `${char.name} 규격 이탈`;
    if (/치수|길이|직경|두께|내경|외경|높이|폭/i.test(char.name)) failureMode = `${char.name} 치수 규격 이탈`;
    else if (/외관|표면|도장|도금/i.test(char.name)) failureMode = `${char.name} 외관 불량(스크래치/찍힘)`;
    else if (/토크|체결/i.test(char.name)) failureMode = `${char.name} 체결 토크 미달/과다`;
    else if (/경도|강도|물성/i.test(char.name)) failureMode = `${char.name} 물성 미달`;
    else if (/중량|무게/i.test(char.name)) failureMode = `${char.name} 중량 규격 이탈`;

    // 고장영향: 특성등급에 따라 AIAG 기준 반영
    let failureEffect: string;
    if (char.category === 'critical') {
      failureEffect = '제품 기능 상실, 고객 안전 문제 가능성, 라인 정지';
    } else if (char.category === 'major') {
      failureEffect = '제품 성능 저하, 고객 불만, 후공정 조립 불량 가능성';
    } else {
      failureEffect = '외관 품질 저하, 일부 고객 인지 가능';
    }

    // aiReviewPfmeaLine으로 S/O/D 및 관리방법 생성
    const review = aiReviewPfmeaLine({
      process_step: processStep,
      potential_failure_mode: failureMode,
      potential_effect: failureEffect,
      characteristic_category: char.category,
    });

    // 검출관리: 특성의 measurement_method가 있으면 우선 사용
    const detectionControl = char.measurement_method || review.current_control_detection;

    // measurement_method 기반으로 detection 재판정
    let detection = review.detection;
    if (char.measurement_method) {
      if (/Poka-Yoke|포카요케|자동.*정지/i.test(char.measurement_method)) detection = 2;
      else if (/자동.*검출|자동.*검사/i.test(char.measurement_method)) detection = 4;
      else if (/CMM|3차원|SPC/i.test(char.measurement_method)) detection = 4;
      else if (/게이지|토크.*검사|경도.*시험/i.test(char.measurement_method)) detection = 5;
      else if (/캘리퍼|마이크로미터/i.test(char.measurement_method)) detection = 6;
      else if (/육안/i.test(char.measurement_method)) detection = 7;
    }

    // AP 기반 권장조치 재생성
    const ap = calcAP(review.severity, review.occurrence, detection);
    let recommendedAction = review.recommended_action;
    if (ap === 'H' && !/전수검사/i.test(recommendedAction)) {
      recommendedAction = 'SPC 관리 도입, 공정능력(Cpk≥1.33) 확보, 전수검사 실시, 개선 후 AP 재평가';
    }

    const line = await pfmeaStore.createLine({
      pfmea_id: header.id,
      characteristic_id: char.id,
      process_step: processStep,
      potential_failure_mode: failureMode,
      potential_effect: failureEffect,
      severity: review.severity,
      potential_cause: review.potential_cause,
      occurrence: review.occurrence,
      current_control_prevention: review.current_control_prevention,
      current_control_detection: detectionControl,
      detection,
      recommended_action: recommendedAction,
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
    doc_number: '',
    author: '',
  });

  const items: ControlPlanItem[] = [];
  for (const line of pfmeaLines) {
    const char = await characteristicStore.getById(line.characteristic_id);
    const procNum = `I-${(pfmeaLines.indexOf(line) + 1) * 10}`;
    // 예방 관리
    items.push(await controlPlanStore.createItem({
      control_plan_id: plan.id,
      pfmea_line_id: line.id,
      characteristic_id: line.characteristic_id,
      process_number: procNum,
      process_step: line.process_step,
      machine_device: '',
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
      process_number: procNum,
      process_step: line.process_step,
      machine_device: '',
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
    doc_number: '',
    author: '',
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
    doc_number: '',
    author: '',
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
