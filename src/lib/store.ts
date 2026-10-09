import { create } from 'zustand';
import { toast } from 'sonner';
import { MCU_FIELDS, TOTAL_COLS, TEXT_NA_INDICES } from './mcu-fields';
import { getMissingZonasiInputs } from './zonasi-engine';
import { applyMCUCalculations, buildAutomaticFollowUpRecommendations } from './mcu-calculations';

export type PageTab = 'home' | 'dashboard' | 'data-entry' | 'administrator';
export type DashSidebar = 'statistik' | 'monitoring' | 'tindak-lanjut' | 'kunjungan' | 'inventory-dashboard' | 'hearing-dashboard' | 'ergonomi-dashboard';
export type AdminSidebar = 'lagging-indicator' | 'review-mcu' | 'input-jadwal-mcu' | 'kunjungan-admin' | 'health-campaign' | 'kelola-pengguna' | 'hearing-conservation' | 'ergonomi';
export type DataEntrySidebar = 'gangguan-tidur' | 'kesehatan-mental' | 'input-jadwal-mcu';
export type HomeSidebar = 'semua-feed' | 'health-campaign' | 'health-talk' | 'podcast' | 'news';
export type ReviewStep = 'search' | 'ocr' | 'form';

export interface EmployeeData {
  nikKaryawan: string;
  nationalId?: string;
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
  activeDataEntrySidebar: DataEntrySidebar;
  setActiveDataEntrySidebar: (tab: DataEntrySidebar) => void;
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
  autoRekFU: string;
  /** Zona hasil kalkulasi terakhir, untuk tampilan ringkasan. */
  zonasi: string;
  /**
   * Parameter objektif zonasi yang belum terisi. Kolom kuesioner dan
   * riwayat TIDAK ada di sini karena kosong diartikan normal.
   */
  parameterBelumDinilai: string[];
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
  activeAdminSidebar: 'lagging-indicator',
  setActiveAdminSidebar: (tab) => set({ activeAdminSidebar: tab }),
  activeDataEntrySidebar: 'input-jadwal-mcu',
  setActiveDataEntrySidebar: (tab) => set({ activeDataEntrySidebar: tab }),
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
  autoRekFU: '',
  zonasi: '',
  parameterBelumDinilai: [],
  setFieldValue: (id, value) => {
    set(state => ({
      formData: { ...state.formData, [id]: value },
      ...(id === 'rekFU' ? { autoRekFU: '' } : {}),
    }));
    // Trigger auto-calcs after a short delay
    setTimeout(() => get().runAutoCalcs(), 0);
  },
  setFormBatch: (data) => {
    set(state => ({
      formData: { ...state.formData, ...data },
      ...('rekFU' in data ? { autoRekFU: '' } : {}),
    }));
    setTimeout(() => get().runAutoCalcs(), 0);
  },
  resetForm: () => set({ formData: initialFormData(), autoRekFU: '', zonasi: '', parameterBelumDinilai: [], employee: null, reviewStep: 'search' }),

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
    if (type === 'success') toast.success(message);
    else if (type === 'error') toast.error(message);
    else toast.info(message);
    setTimeout(() => set({ toast: null }), 3000);
  },
  clearToast: () => set({ toast: null }),

  runAutoCalcs: () => {
    const currentState = get();
    const fd = currentState.formData;

    // Seluruh kolom kalkulasi dihitung oleh engine yang SAMA dengan yang
    // dipakai server saat menyimpan (applyMCUCalculations). Menyalin
    // rumusnya di sini pernah menyebabkan hasil form berbeda dengan
    // hasil tersimpan, jadi salinan itu dihapus.
    const calculated = applyMCUCalculations({ ...fd }) as Record<string, unknown>;

    // Kolom yang boleh ditulis balik ke formstate.
    const CALCULATED_KEYS = [
      'bmi', 'mchc', 'pta',
      'fvcPct', 'fev1Pct', 'fev1FvcAct', 'fev1FvcPct',
      'diabetes', 'egfr', 'tglExpired',
      'diagnosaMedis', 'ringkasanKuesioner', 'hasilKebugaran',
      'itemFU', 'perluFU',
      'framScore', 'framProb', 'framKat',
      'zonasi', 'triggerZona', 'pengendalian',
    ] as const;

    const updates: Record<string, string> = {};
    for (const key of CALCULATED_KEYS) {
      const value = calculated[key];
      if (value === null || value === undefined) continue;
      updates[key] = String(value);
    }

    // Rekomendasi follow up: pertahankan pilihan manual QSHE Medic.
    const automaticRecommendations = buildAutomaticFollowUpRecommendations(calculated as Record<string, string>).join(' | ');
    const currentRecommendations = fd.rekFU || '';
    if (!currentRecommendations || (currentState.autoRekFU && currentRecommendations === currentState.autoRekFU)) {
      updates.rekFU = automaticRecommendations;
    }
    const nextAutoRekFU = updates.rekFU !== undefined ? automaticRecommendations : currentState.autoRekFU;

    // Apply only changed values
    const newFd = { ...get().formData };
    let changed = false;
    for (const [k, v] of Object.entries(updates)) {
      if (newFd[k] !== v) {
        newFd[k] = v;
        changed = true;
      }
    }
    const zonasi = String(calculated.zonasi ?? '');
    const missing = getMissingZonasiInputs(fd as Record<string, string | number | undefined>);
    const missingKey = missing.join('|');
    if (changed
      || nextAutoRekFU !== currentState.autoRekFU
      || zonasi !== currentState.zonasi
      || missingKey !== currentState.parameterBelumDinilai.join('|')) {
      set({
        formData: newFd,
        autoRekFU: nextAutoRekFU,
        zonasi,
        parameterBelumDinilai: missing,
      });
    }
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
