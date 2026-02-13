/**
 * APQP System Database Types
 *
 * 핵심 원칙:
 * 1. Single Source of Truth = Characteristic(특성)
 * 2. 모든 문서는 FK 기반 추적 가능:
 *    pfmea_line_id → control_plan_item_id → sop_step_id / inspection_item_id
 */

// ============================================
// Base Types
// ============================================
export type UUID = string;
export type Timestamp = string;

// ============================================
// Characteristics (Single Source of Truth)
// ============================================
export interface Characteristic {
  id: UUID;
  name: string;
  type: 'product' | 'process';
  category: 'critical' | 'major' | 'minor';
  specification: string | null;
  lsl: number | null;           // Lower Spec Limit
  usl: number | null;           // Upper Spec Limit
  unit: string | null;
  measurement_method: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

// ============================================
// PFMEA (Process Failure Mode Effects Analysis)
// ============================================
export interface PfmeaHeader {
  id: UUID;
  product_id: UUID;
  process_name: string;
  revision: number;
  status: 'draft' | 'review' | 'approved';
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface PfmeaLine {
  id: UUID;
  pfmea_id: UUID;
  step_no: number;
  process_step: string;
  characteristic_id: UUID | null;  // FK to characteristics
  potential_failure_mode: string;
  potential_effect: string;
  severity: number;                 // 1-10
  potential_cause: string;
  occurrence: number;               // 1-10
  current_control_prevention: string | null;
  current_control_detection: string | null;
  detection: number;                // 1-10
  rpn: number;                      // Severity × Occurrence × Detection
  recommended_action: string | null;
  action_priority: 'H' | 'M' | 'L' | null;  // High, Medium, Low
  created_at: Timestamp;
  updated_at: Timestamp;
  // Joined data
  characteristic?: Characteristic;
}

// ============================================
// Control Plan
// ============================================
export interface ControlPlan {
  id: UUID;
  pfmea_id: UUID;
  name: string;
  revision: number;
  status: 'draft' | 'review' | 'approved';
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface ControlPlanItem {
  id: UUID;
  control_plan_id: UUID;
  pfmea_line_id: UUID;              // FK to pfmea_lines
  characteristic_id: UUID;           // FK to characteristics
  step_no: number;
  process_step: string;
  control_type: 'prevention' | 'detection';
  control_method: string;
  sample_size: string;
  frequency: string;
  reaction_plan: string;
  responsible: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  // Joined data
  characteristic?: Characteristic;
  pfmea_line?: PfmeaLine;
}

// ============================================
// SOP (Standard Operating Procedure)
// ============================================
export interface Sop {
  id: UUID;
  control_plan_id: UUID;
  name: string;
  revision: number;
  status: 'draft' | 'review' | 'approved';
  effective_date: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface SopStep {
  id: UUID;
  sop_id: UUID;
  linked_cp_item_id: UUID;          // FK to control_plan_items (필수!)
  step_no: number;
  action: string;                    // 작업자 기준 문장
  key_point: string;                 // 관리 포인트 + 검사방법 + 이상조치
  safety_note: string | null;
  visual_aid_url: string | null;
  estimated_time_sec: number | null;
  created_at: Timestamp;
  updated_at: Timestamp;
  // Joined data
  control_plan_item?: ControlPlanItem;
}

// ============================================
// Inspection Standard (검사기준서)
// ============================================
export interface InspectionStandard {
  id: UUID;
  control_plan_id: UUID;
  name: string;
  revision: number;
  status: 'draft' | 'review' | 'approved';
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface InspectionItem {
  id: UUID;
  inspection_standard_id: UUID;
  linked_cp_item_id: UUID;          // FK to control_plan_items (필수!)
  characteristic_id: UUID;           // FK to characteristics
  item_no: number;
  inspection_item_name: string;
  inspection_method: string;
  sampling_plan: string;             // CP의 sample_size + frequency
  acceptance_criteria: string;       // 정량화된 합격 기준
  measurement_equipment: string | null;
  ng_handling: string;               // 격리 + 재검 + 원인분석 트리거
  created_at: Timestamp;
  updated_at: Timestamp;
  // Joined data
  characteristic?: Characteristic;
  control_plan_item?: ControlPlanItem;
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
