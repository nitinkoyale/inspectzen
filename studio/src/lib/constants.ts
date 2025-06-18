
import type { PartName, SectionFormConfig, UserRole } from './types';
import { SearchCheck, ClipboardCheck, ShieldCheck, Truck, Ban } from 'lucide-react';
import { USER_ROLES_LIST, SHIFT_OPTIONS } from './types'; // Import SHIFT_OPTIONS

export const APP_NAME = "InspectZen";
export const MONTHLY_TARGET_KEY = "inspectZenMonthlyTarget"; // For appConfig doc
export const USERS_COLLECTION = "users";
export const INSPECTION_RECORDS_COLLECTION = "inspectionRecords";
export const APP_CONFIG_COLLECTION = "appConfig";
export const MONTHLY_TARGETS_DOC_ID = "monthlyTargets"; // Document ID for monthly targets
export const DEFECT_TYPES_DOC_ID = "defectTypesList"; // Document ID for defect types list
export const DEFECT_LIST_FIELD = "defects"; // Field name in the document holding the array of defects


export const PART_NAMES_LIST: PartName[] = ["Lay shaft assy", "Main reduction gear", "Input shaft"];

export const PART_SLUGS_MAP: Record<PartName, string> = {
  "Lay shaft assy": "lay-shaft-assy",
  "Main reduction gear": "main-reduction-gear",
  "Input shaft": "input-shaft",
};

export const SLUG_TO_PART_NAME_MAP: Record<string, PartName | undefined> = {
  "lay-shaft-assy": "Lay shaft assy",
  "main-reduction-gear": "Main reduction gear",
  "input-shaft": "Input shaft",
};

export const INITIAL_DEFECT_TYPES: string[] = [ // Renamed and will be used as string[]
  "Teeth dent",
  "Chamfer dent",
  "Rusty/pit mark",
  "Profile unclean",
  "Spline dent",
  "ID spline unclean",
  "Profile scratch mark",
  "Root burr",
  "Teeth hunting",
];

export const USER_ROLES: Readonly<Record<UserRole, string>> = {
  ADMIN: "Admin",
  TPI_INSPECTOR: "TPI Inspector",
  FINAL_INSPECTOR: "Final Inspector",
  DATA_VIEWER: "Data Viewer",
};

// Define roles for easier reference
const ADMIN_ROLE = USER_ROLES_LIST[0];
const TPI_INSPECTOR_ROLE = USER_ROLES_LIST[1];
const FINAL_INSPECTOR_ROLE = USER_ROLES_LIST[2];
const DATA_VIEWER_ROLE = USER_ROLES_LIST[3];


export const BASE_FORM_CONFIG: Record<string, SectionFormConfig> = {
  materialInspection: {
    title: "Material Inspection",
    icon: SearchCheck,
    dataKey: "materialInspection",
    hiddenForRoles: [TPI_INSPECTOR_ROLE],
    readOnlyForRoles: [DATA_VIEWER_ROLE],
    subsections: {
      washing: { title: "Washing", fields: [{ name: "materialInspection.washingPending", label: "Pending", type: "number", defaultValue: 0 }] },
      multigauge: { title: "Multigauge", fields: [{ name: "materialInspection.multigaugePending", label: "Pending", type: "number", defaultValue: 0 }] },
    }
  },
  finalInspection: {
    title: "Final Inspection",
    icon: ClipboardCheck,
    dataKey: "finalInspection",
    hiddenForRoles: [TPI_INSPECTOR_ROLE],
    readOnlyForRoles: [DATA_VIEWER_ROLE],
    subsections: {
      multigauge: { title: "Multigauge Inspection", fields: [
        { name: "finalInspection.multigauge.total", label: "Total Inspected", type: "number", defaultValue: 0, disabled: true }, // Always auto-calculated
        { name: "finalInspection.multigauge.ok", label: "OK", type: "number", defaultValue: 0 },
        { name: "finalInspection.multigauge.notOk", label: "Not OK", type: "number", defaultValue: 0 },
      ]},
      visual: { title: "Visual Inspection", fields: [
        { name: "finalInspection.visual.pending", label: "Pending for Inspection", type: "number", defaultValue: 0 },
        { name: "finalInspection.visual.visualDone", label: "Visual Done", type: "number", defaultValue: 0 }, // Disabled for FINAL_INSPECTOR via component logic
        { name: "finalInspection.visual.ok", label: "OK", type: "number", defaultValue: 0 },
        { name: "finalInspection.visual.notOk", label: "Not OK", type: "number", defaultValue: 0 },
      ]},
    }
  },
  tpiInspection: {
    title: "TPI Inspection",
    icon: ShieldCheck,
    dataKey: "tpiInspection",
    hiddenForRoles: [FINAL_INSPECTOR_ROLE],
    readOnlyForRoles: [DATA_VIEWER_ROLE],
    subsections: {
      tpi: { title: "TPI Status", fields: [
        { name: "tpiInspection.pending", label: "Pending", type: "number", defaultValue: 0 },
        { name: "tpiInspection.done", label: "Done", type: "number", defaultValue: 0 }, // Disabled for TPI_INSPECTOR via component logic
        { name: "tpiInspection.ok", label: "OK", type: "number", defaultValue: 0 },
        { name: "tpiInspection.notOk", label: "Not OK", type: "number", defaultValue: 0 },
      ]},
    }
  },
  dispatch: {
    title: "Dispatch",
    icon: Truck,
    dataKey: "dispatch",
    readOnlyForRoles: [DATA_VIEWER_ROLE], 
    subsections: {
      rfd: { title: "RFD (Ready for Dispatch)", fields: [
        { name: "dispatch.rfd.cumulative", label: "Cumulative RFD", type: "number", defaultValue: 0 }, // Disabled for non-ADMIN via component logic
        { name: "dispatch.rfd.today", label: "Today's RFD", type: "number", defaultValue: 0, disabledForRoles: [DATA_VIEWER_ROLE] } 
      ]},
      actualDispatch: { 
        title: "Actual Dispatch Status", fields: [
        { name: "dispatch.dispatch.cumulative", label: "Cumulative Dispatch", type: "number", defaultValue: 0 }, // Disabled for non-ADMIN via component logic
        { name: "dispatch.dispatch.today", label: "Today's Actual Dispatch", type: "number", defaultValue: 0, disabledForRoles: [TPI_INSPECTOR_ROLE, DATA_VIEWER_ROLE] }
      ]},
    }
  },
};

export const FORM_CONFIG: Record<PartName, Record<string, SectionFormConfig>> = {
  "Lay shaft assy": BASE_FORM_CONFIG,
  "Main reduction gear": BASE_FORM_CONFIG,
  "Input shaft": BASE_FORM_CONFIG,
};

export const FINAL_INSPECTION_REJECTION_SECTION_CONFIG: Pick<SectionFormConfig, 'hiddenForRoles' | 'readOnlyForRoles'> = {
    hiddenForRoles: [TPI_INSPECTOR_ROLE],
    readOnlyForRoles: [DATA_VIEWER_ROLE]
};

export const TPI_REJECTION_SECTION_CONFIG: Pick<SectionFormConfig, 'hiddenForRoles' | 'readOnlyForRoles'> = {
    hiddenForRoles: [FINAL_INSPECTOR_ROLE],
    readOnlyForRoles: [DATA_VIEWER_ROLE]
};

export { USER_ROLES_LIST, SHIFT_OPTIONS };

