import { create } from 'zustand';
import { MCU_FIELDS, TOTAL_COLS, TEXT_NA_INDICES } from './mcu-fields';
import { assessZonasi, calcBMI, calcMCHC, calcPct, calcDiabetes, calcPerluFU, calcFramingham } from './zonasi-engine';

export type PageTab = 'home' | 'dashboard' | 'administrator';
export type DashSidebar = 'statistik' | 'monitoring' | 'tindak-lanjut' | 'kunjungan';
export type AdminSidebar = 'review-mcu' | 'input-lagging' | 'kunjungan-admin' | 'health-campaign';
export type HomeSidebar = 'semua-feed' | 'health-campaign' | 'health-talk' | 'news';
export type ReviewStep = 'search' | 'ocr' | 'form';

export interface EmployeeData {
  nikKaryawan: string;
  nama: string;
  gender: string;
  jabatan: string;
  site: string;
  usia: string;
  department?: string;
  division?: string;
}

export interface SheetConfig {
  id: string;
  name: string;
  spreadsheetId: string;
  sheetName: string;
  dataStartRow: number;
  totalCols: number;
  isDefault: boolean;
}

interface MCUStore {
  // Navigation
  activePage: PageTab;
  setActivePage: (tab: PageTab) => void;
  activeDashSidebar: DashSidebar;
  setActiveDashSidebar: (tab: DashSidebar) => void;
  activeAdminSidebar: AdminSidebar;
  setActiveAdminSidebar: (tab: AdminSidebar) => void;
  activeHomeSidebar: HomeSidebar;
  setActiveHomeSidebar: (tab: HomeSidebar) => void;
  // Keep backward compat alias
  activeTab: PageTab;
  setActiveTab: (tab: PageTab) => void;

  // Review step
  reviewStep: ReviewStep;
  setReviewStep: (step: ReviewStep) => void;

  // Employee data (from NIK search)
  employee: EmployeeData | null;
  setEmployee: (emp: EmployeeData | null) => void;

  // MCU form data
  formData: Record<string, string>;
  setFieldValue: (id: string, value: string) => void;
  setFormBatch: (data: Record<string, string>) => void;
  resetForm: () => void;

  // Loading states
  searchingEmployee: boolean;
  setSearchingEmployee: (v: boolean) => void;
  extractingOCR: boolean;
  setExtractingOCR: (v: boolean) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;

  // Sheet config
  sheetConfigs: SheetConfig[];
  activeSheetId: string | null;
  setSheetConfigs: (configs: SheetConfig[]) => void;
  setActiveSheetId: (id: string | null) => void;

  // Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
  clearToast: () => void;

  // Auto-calc
  runAutoCalcs: () => void;

  // Build row data for sheet
  buildRowData: () => string[];
}

function initialFormData(): Record<string, string> {
  const d: Record<string, string> = {};
  MCU_FIELDS.forEach(f => { d[f.id] = ''; });
  return d;
}

export const useMCUStore = create<MCUStore>((set, get) => ({
  activePage: 'home',
  setActivePage: (tab) => set({ activePage: tab }),
  activeDashSidebar: 'statistik',
  setActiveDashSidebar: (tab) => set({ activeDashSidebar: tab }),
  activeAdminSidebar: 'review-mcu',
  setActiveAdminSidebar: (tab) => set({ activeAdminSidebar: tab }),
  activeHomeSidebar: 'semua-feed',
  setActiveHomeSidebar: (tab) => set({ activeHomeSidebar: tab }),
  // backward compat
  activeTab: 'home',
  setActiveTab: (tab) => set({ activePage: tab, activeTab: tab }),

  reviewStep: 'search',
  setReviewStep: (step) => set({ reviewStep: step }),

  employee: null,
  setEmployee: (emp) => set({ employee: emp }),

  formData: initialFormData(),
  setFieldValue: (id, value) => {
    set(state => ({
      formData: { ...state.formData, [id]: value }
    }));
    // Trigger auto-calcs after a short delay
    setTimeout(() => get().runAutoCalcs(), 0);
  },
  setFormBatch: (data) => {
    set(state => ({
      formData: { ...state.formData, ...data }
    }));
    setTimeout(() => get().runAutoCalcs(), 0);
  },
  resetForm: () => set({ formData: initialFormData(), employee: null, reviewStep: 'search' }),

  searchingEmployee: false,
  setSearchingEmployee: (v) => set({ searchingEmployee: v }),
  extractingOCR: false,
  setExtractingOCR: (v) => set({ extractingOCR: v }),
  saving: false,
  setSaving: (v) => set({ saving: v }),

  sheetConfigs: [],
  activeSheetId: null,
  setSheetConfigs: (configs) => set({ sheetConfigs: configs }),
  setActiveSheetId: (id) => set({ activeSheetId: id }),

  toast: null,
  showToast: (message, type) => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 3000);
  },
  clearToast: () => set({ toast: null }),

  runAutoCalcs: () => {
    const fd = get().formData;
    const updates: Record<string, string> = {};

    // BMI
    const bb = parseFloat(fd.bb);
    const tb = parseFloat(fd.tb);
    const bmiVal = calcBMI(isNaN(bb) ? null : bb, isNaN(tb) ? null : tb);
    if (bmiVal !== null) updates.bmi = String(bmiVal);

    // MCHC
    const hbVal = parseFloat(fd.hb);
    const hctVal = parseFloat(fd.hematokrit);
    const mchcVal = calcMCHC(isNaN(hbVal) ? null : hbVal, isNaN(hctVal) ? null : hctVal);
    if (mchcVal !== null) updates.mchc = String(mchcVal);

    // Spirometry percentages
    const fvcAct = parseFloat(fd.fvcAct);
    const fvcPred = parseFloat(fd.fvcPred);
    const fvcPctVal = calcPct(isNaN(fvcAct) ? null : fvcAct, isNaN(fvcPred) ? null : fvcPred);
    if (fvcPctVal !== null) updates.fvcPct = String(fvcPctVal);

    const fev1Act = parseFloat(fd.fev1Act);
    const fev1Pred = parseFloat(fd.fev1Pred);
    const fev1PctVal = calcPct(isNaN(fev1Act) ? null : fev1Act, isNaN(fev1Pred) ? null : fev1Pred);
    if (fev1PctVal !== null) updates.fev1Pct = String(fev1PctVal);

    // FEV1/FVC
    const fev1FvcPred = parseFloat(fd.fev1FvcPred);
    const fev1FvcActVal = (fvcAct > 0 && fev1Act > 0) ? fev1Act / fvcAct : null;
    if (fev1FvcActVal !== null) updates.fev1FvcAct = String(parseFloat(fev1FvcActVal.toFixed(2)));

    const fev1FvcPctVal = calcPct(
      fev1FvcActVal,
      isNaN(fev1FvcPred) ? null : fev1FvcPred
    );
    if (fev1FvcPctVal !== null) updates.fev1FvcPct = String(fev1FvcPctVal);

    // Diabetes
    updates.diabetes = calcDiabetes(
      isNaN(gdp) ? null : (fd.gdp ? parseFloat(fd.gdp) : null),
      isNaN(parseFloat(fd.gd2pp)) ? null : parseFloat(fd.gd2pp),
      isNaN(parseFloat(fd.hba1c)) ? null : parseFloat(fd.hba1c),
    );

    // Perlu FU
    const kesVendor = fd.kesVendor;
    const hasAbnormal = Object.entries(fd).some(([key, val]) => {
      if (!val || val === 'N/A' || val === 'DBN') return false;
      const field = MCU_FIELDS.find(f => f.id === key);
      if (!field || field.autoCalc || field.id === 'kesVendor' || field.id === 'rekQSHE' || field.id === 'catatan') return false;
      return true;
    });
    updates.perluFU = calcPerluFU(kesVendor, hasAbnormal);

    // Framingham
    const fram = calcFramingham(fd);
    updates.framScore = String(fram.score);
    updates.framProb = fram.prob;
    updates.framKat = fram.kat;

    // Zonasi
    const zResult = assessZonasi(fd, fd.jenisKelamin);
    updates.zonasi = zResult.zona;
    updates.triggerZona = zResult.triggers.join(' | ');
    updates.pengendalian = zResult.pengendalian;

    // Apply only changed values
    const newFd = { ...get().formData };
    let changed = false;
    for (const [k, v] of Object.entries(updates)) {
      if (newFd[k] !== v) {
        newFd[k] = v;
        changed = true;
      }
    }
    if (changed) set({ formData: newFd });
  },

  buildRowData: () => {
    const fd = get().formData;
    const row: string[] = new Array(TOTAL_COLS).fill('');

    MCU_FIELDS.forEach(field => {
      if (field.colIndex >= TOTAL_COLS) return;
      let val = fd[field.id] || '';
      // Text-NA: if empty, set to 'N/A'
      if (field.textNA && (val === '' || val === undefined)) {
        val = 'N/A';
      }
      row[field.colIndex] = val;
    });

    // Column A = auto number (will be set by sheet)
    row[0] = '(auto)';

    return row;
  },
}));
