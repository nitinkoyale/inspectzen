
import type { Timestamp } from 'firebase/firestore';

export type PartName = "Lay shaft assy" | "Main reduction gear" | "Input shaft";

// This const will be removed as defect types become dynamic from Firestore.
// export const DEFECT_TYPES_LIST = [...] as const;
// DefectType will now be a string, validated by the dynamic list fetched from Firestore.
export type DefectType = string; 

export const SHIFT_OPTIONS = ["A", "B"] as const;
export type Shift = typeof SHIFT_OPTIONS[number];

export interface RejectionEntry {
  defectType: DefectType; // Changed from const enum to string
  quantity: number;
  remarks?: string;
}

export interface MaterialInspectionData {
  washingPending: number;
  multigaugePending: number;
}

export interface MultigaugeInspectionData {
  total: number;
  ok: number;
  notOk: number;
}

export interface VisualInspectionData {
  pending: number;
  visualDone: number;
  ok: number;
  notOk: number;
}

export interface FinalInspectionData {
  multigauge: MultigaugeInspectionData;
  visual: VisualInspectionData;
}

export interface TpiInspectionData {
  pending: number;
  done: number;
  ok: number;
  notOk: number;
}

export interface RfdData {
  cumulative: number;
  today: number;
}

export interface DispatchItemData {
  cumulative: number;
  today: number;
}

export interface DispatchSectionData {
  rfd: RfdData;
  dispatch: DispatchItemData;
}

export interface InspectionRecord {
  id: string;
  date: string; // YYYY-MM-DD
  partName: PartName;
  shift: Shift;
  materialInspection: MaterialInspectionData;
  finalInspection: FinalInspectionData;
  tpiInspection: TpiInspectionData;
  dispatch: DispatchSectionData;
  rejections: RejectionEntry[]; // For Final Inspection rejections
  tpiRejections: RejectionEntry[]; // For TPI rejections
}

export type SectionName = keyof Omit<InspectionRecord, 'id' | 'date' | 'partName' | 'shift'>;

export type AISectionName = "Material Inspection" | "Final Inspection" | "TPI Inspection" | "Dispatch";
export type AISubsectionName =
  | "Washing pending"
  | "Multigauge pending"
  | "Multigauge inspection"
  | "Visual inspection"
  | "TPI Pending" 
  | "TPI Done"
  | "TPI OK"
  | "TPI Not OK"
  | "RFD"
  | "Dispatch"; 

export const PART_NAMES: PartName[] = ["Lay shaft assy", "Main reduction gear", "Input shaft"];

export const AI_SECTIONS_AND_SUBSECTIONS: Record<AISectionName, AISubsectionName[]> = {
  "Material Inspection": ["Washing pending", "Multigauge pending"],
  "Final Inspection": ["Multigauge inspection", "Visual inspection"],
  "TPI Inspection": ["TPI Pending", "TPI Done", "TPI OK", "TPI Not OK"], 
  "Dispatch": ["RFD", "Dispatch"],
};

export const USER_ROLES_LIST = ["ADMIN", "TPI_INSPECTOR", "FINAL_INSPECTOR", "DATA_VIEWER"] as const;
export type UserRole = typeof USER_ROLES_LIST[number];

export type UserStatus = 'active' | 'pending_approval' | 'suspended';

export interface UserProfile {
  uid: string;
  email: string | null;
  name: string;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}


export interface FormFieldConfig {
  name: string;
  label: string;
  type: 'number' | 'text';
  defaultValue?: number | string;
  disabled?: boolean; 
  disabledForRoles?: UserRole[]; // Roles for which this specific field is disabled (read-only)
}

export interface SubsectionFormConfig {
  title: string;
  fields: FormFieldConfig[];
  dataKey: keyof MaterialInspectionData | keyof MultigaugeInspectionData | keyof VisualInspectionData | keyof TpiInspectionData | keyof RfdData | keyof DispatchItemData;
}
export interface SectionFormConfig {
  title: string;
  icon?: React.ElementType;
  subsections: Record<string, { title: string; fields: FormFieldConfig[] }>;
  dataKey: keyof Omit<InspectionRecord, 'id' | 'date' | 'partName' | 'rejections' | 'tpiRejections' | 'shift'>;
  hiddenForRoles?: UserRole[]; // Roles for which this entire section is hidden
  readOnlyForRoles?: UserRole[]; // Roles for which this entire section is visible but read-only (fields effectively disabled)

}

export type InspectionFormData = Omit<InspectionRecord, 'id'>;

export const DEFAULT_INSPECTION_VALUES: Omit<InspectionRecord, 'id' | 'date' | 'partName' | 'shift'> = {
  materialInspection: { washingPending: 0, multigaugePending: 0 },
  finalInspection: {
    multigauge: { total: 0, ok: 0, notOk: 0 },
    visual: { pending: 0, visualDone: 0, ok: 0, notOk: 0 },
  },
  tpiInspection: { pending: 0, done: 0, ok: 0, notOk: 0 },
  dispatch: {
    rfd: { cumulative: 0, today: 0 },
    dispatch: { cumulative: 0, today: 0 },
  },
  rejections: [],
  tpiRejections: [],
};

export interface MonthlyTarget {
  partName: PartName;
  metric: string; 
  target: number;
}

// Interface for the defect types document in Firestore
export interface DefectTypesDocument {
  defects: string[];
}
