/**
 * APQP System Database Types (Single Source of Truth)
 *
 * 핵심 원칙:
 * 1. Single Source of Truth = Characteristic(특성)
 * 2. 모든 문서는 FK 기반 추적 가능:
 *    pfmea_line_id → control_plan_item_id → sop_step_id / inspection_item_id
 *
 * ⚠️ 이 파일이 타입의 유일한 정의 위치입니다.
 *    store.ts와 API routes 모두 여기서 import합니다.
 */

// ============================================
// Base Types
// ============================================
export type UUID = string;
export type Timestamp = string;

// ============================================
// Products
// ============================================
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

// ============================================
// Characteristics (Single Source of Truth)
// ============================================
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

// ============================================
// PFMEA (Process Failure Mode Effects Analysis)
// ============================================
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

// ============================================
// Control Plan
// ============================================
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

// ============================================
// SOP (Standard Operating Procedure)
// ============================================
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

// ============================================
// Inspection Standard (검사기준서)
// ============================================
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

// ============================================
// API Request/Response Types
// ============================================
export interface GenerateSopRequest {
  control_plan_id: UUID;
}

export interface GenerateSopResponse {
  success: boolean;
  sop_id?: UUID;
  steps_count?: number;
  error?: string;
  traceability?: {
    control_plan_id: UUID;
    sop_id: UUID;
    linked_cp_items: UUID[];
  };
}

export interface GenerateInspectionRequest {
  control_plan_id: UUID;
}

export interface GenerateInspectionResponse {
  success: boolean;
  inspection_standard_id?: UUID;
  items_count?: number;
  error?: string;
  traceability?: {
    control_plan_id: UUID;
    inspection_standard_id: UUID;
    linked_cp_items: UUID[];
  };
}

// ============================================
// LLM Generation Types
// ============================================
export interface LLMSopStepOutput {
  action: string;
  key_point: string;
  safety_note: string | null;
  estimated_time_sec: number | null;
}

export interface LLMInspectionItemOutput {
  inspection_item_name: string;
  inspection_method: string;
  acceptance_criteria: string;
  ng_handling: string;
}
