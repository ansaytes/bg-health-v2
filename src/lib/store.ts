import { create } from 'zustand';
import { toast } from 'sonner';
import { MCU_FIELDS, parseUlToParams } from './mcu-fields';
import { getMissingZonasiInputs } from './zonasi-engine';
import { applyMCUCalculations, buildAutomaticFollowUpRecommendations, suggestRekQSHE } from './mcu-calculations';
import { AUTO_INTERPRETATION_FIELDS } from './clinical-classification';

export type PageTab = 'home' | 'dashboard' | 'data-entry' | 'administrator';
export type DashSidebar = 'statistik' | 'monitoring' | 'tindak-lanjut' | 'kunjungan' | 'layanan-kuratif' | 'inventory-dashboard' | 'hearing-dashboard' | 'ergonomi-dashboard' | 'mental-health-dashboard' | 'pemetaan-psikologis' | 'higiene-industri' | 'persetujuan-ergonomi' | 'prokawan-dashboard' | 'spip';
export type AdminSidebar = 'lagging-indicator' | 'review-mcu' | 'input-jadwal-mcu' | 'kunjungan-admin' | 'health-campaign' | 'kelola-pengguna' | 'hearing-conservation' | 'ergonomi' | 'layanan-kuratif-admin' | 'higiene-industri-admin' | 'pak-register' | 'prokawan-admin' | 'karyawan-sakit' | 'sarana-klinik' | 'inspeksi-sanitasi' | 'pengaturan';
export type DataEntrySidebar = 'gangguan-tidur' | 'kesehatan-mental' | 'psikologi-lingkungan' | 'input-jadwal-mcu' | 'persetujuan-ergonomi';
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
  /**
   * Review MCU — saklar lampu: ON = scan OCR dokumen MCU aktif, OFF = langsung
   * input manual. Default OFF dan tidak dipersist (selalu padam saat dibuka).
   */
  ocrEnabled: boolean;
  setOcrEnabled: (value: boolean) => void;

  // Employee data (from NIK search)
  employee: EmployeeData | null;
  setEmployee: (emp: EmployeeData | null) => void;

  // MCU form data
  formData: Record<string, string>;
  autoRekFU: string;
  autoRekQSHE: string;
  /**
   * Teks interpretasi (spirometri/audiometri) yang terakhir ditulis OTOMATIS,
   * per id field. Field hanya ditimpa ulang bila isinya masih sama dengan teks
   * ini; begitu operator mengetik sendiri, pelacak dikosongkan dan tulisannya
   * dipertahankan.
   */
  autoInterp: Record<string, string>;
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

  // Toast
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;

  // Auto-calc
  runAutoCalcs: () => void;

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
  activeAdminSidebar: 'layanan-kuratif-admin',
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
  ocrEnabled: false,
  setOcrEnabled: (value) => set({ ocrEnabled: value }),

  employee: null,
  setEmployee: (emp) => set({ employee: emp }),

  formData: initialFormData(),
  autoRekFU: '',
  autoRekQSHE: '',
  autoInterp: {},
  zonasi: '',
  parameterBelumDinilai: [],
  setFieldValue: (id, value) => {
    set(state => ({
      formData: { ...state.formData, [id]: value },
      ...(id === 'rekFU' ? { autoRekFU: '' } : {}),
      ...(id === 'rekQSHE' ? { autoRekQSHE: '' } : {}),
      // Ketikan operator pada kolom interpretasi = tulisan manual.
      ...(id in AUTO_INTERPRETATION_FIELDS ? { autoInterp: { ...state.autoInterp, [id]: '' } } : {}),
    }));
    // Trigger auto-calcs after a short delay
    setTimeout(() => get().runAutoCalcs(), 0);
  },
  setFormBatch: (data) => {
    // Data lama yang masih menyimpan `ul` komposit dipecah menjadi 19 field
    // per-parameter agar dropdown urinalisis terisi. Nilai per-param yang
    // sudah ada di `data` tidak ditimpa.
    const normalized = { ...data };
    if (normalized.ul && !normalized.ulWarna) {
      const parsed = parseUlToParams(normalized.ul);
      for (const [fieldId, value] of Object.entries(parsed)) {
        if (normalized[fieldId] == null || normalized[fieldId] === '') {
          normalized[fieldId] = value;
        }
      }
    }
    set(state => {
      // Interpretasi yang datang dari OCR / record tersimpan dianggap tulisan
      // pemeriksa, bukan teks otomatis, jadi tidak ditimpa saat angka berubah.
      const autoInterp = { ...state.autoInterp };
      for (const key of Object.keys(AUTO_INTERPRETATION_FIELDS)) {
        if (key in data && String(data[key] ?? '').trim() !== '') autoInterp[key] = '';
      }
      return {
        formData: { ...state.formData, ...normalized },
        autoInterp,
        ...('rekFU' in data ? { autoRekFU: '' } : {}),
        ...('rekQSHE' in data ? { autoRekQSHE: '' } : {}),
      };
    });
    setTimeout(() => get().runAutoCalcs(), 0);
  },
  resetForm: () => set({ formData: initialFormData(), autoRekFU: '', autoRekQSHE: '', autoInterp: {}, zonasi: '', parameterBelumDinilai: [], employee: null, reviewStep: 'search', ocrEnabled: false }),

  searchingEmployee: false,
  setSearchingEmployee: (v) => set({ searchingEmployee: v }),
  extractingOCR: false,
  setExtractingOCR: (v) => set({ extractingOCR: v }),
  saving: false,
  setSaving: (v) => set({ saving: v }),

  showToast: (message, type) => {
    if (type === 'success') toast.success(message);
    else if (type === 'error') toast.error(message);
    else toast.info(message);
  },

  runAutoCalcs: () => {
    const currentState = get();
    const fd = currentState.formData;

    // Seluruh kolom kalkulasi dihitung oleh engine yang SAMA dengan yang
    // dipakai server saat menyimpan (applyMCUCalculations). Menyalin
    // rumusnya di sini pernah menyebabkan hasil form berbeda dengan
    // hasil tersimpan, jadi salinan itu dihapus.
    //
    // Interpretasi spirometri/audiometri ikut dihitung di sini karena diagnosis
    // dan zonasi membaca teksnya. Teks hanya ditimpa bila kolom masih kosong
    // atau masih berisi teks otomatis sebelumnya (lihat autoInterp); tulisan
    // manual selalu dipertahankan.
    //
    // Kolom yang masih kosong / berisi teks otomatis dikosongkan dulu agar
    // applyMCUCalculations membangunnya ulang dari angka TERBARU (FVC%/FEV1%
    // yang dihitung di dalam engine yang sama), lalu hasilnya dilacak.
    const input: Record<string, string> = { ...fd };
    const autoKeys: string[] = [];
    for (const key of Object.keys(AUTO_INTERPRETATION_FIELDS)) {
      const current = (input[key] || '').trim();
      const tracked = currentState.autoInterp[key] || '';
      if (!current || /^n\/a$/i.test(current) || (tracked !== '' && current === tracked)) {
        input[key] = '';
        autoKeys.push(key);
      }
    }
    const calculated = applyMCUCalculations(input) as Record<string, unknown>;
    const nextAutoInterp: Record<string, string> = { ...currentState.autoInterp };
    for (const key of autoKeys) {
      nextAutoInterp[key] = String(calculated[key] ?? '');
    }

    // Kolom yang boleh ditulis balik ke formstate.
    const CALCULATED_KEYS = [
      'bmi', 'mchc', 'pta',
      'fvcPct', 'fev1Pct', 'fev1FvcAct', 'fev1FvcPct',
      'diabetes', 'egfr', 'tglExpired',
      'diagnosaMedis', 'ringkasanKuesioner', 'hasilKebugaran',
      'itemFU', 'perluFU',
      'framScore', 'framProb', 'framKat',
      'zonasi', 'triggerZona', 'pengendalian',
      // Ringkasan komposit urinalisis (dibangun dari 19 parameter ul*).
      'ul',
    ] as const;

    const updates: Record<string, string> = {};
    for (const key of CALCULATED_KEYS) {
      const value = calculated[key];
      if (value === null || value === undefined) continue;
      updates[key] = String(value);
    }
    // Interpretasi otomatis (kosong bila data belum cukup).
    for (const key of autoKeys) updates[key] = nextAutoInterp[key];

    // Rekomendasi follow up: pertahankan pilihan manual QSHE Medic.
    const automaticRecommendations = buildAutomaticFollowUpRecommendations(calculated as Record<string, string>).join(' | ');
    const currentRecommendations = fd.rekFU || '';
    if (!currentRecommendations || (currentState.autoRekFU && currentRecommendations === currentState.autoRekFU)) {
      updates.rekFU = automaticRecommendations;
    }
    const nextAutoRekFU = updates.rekFU !== undefined ? automaticRecommendations : currentState.autoRekFU;

    // Rekomendasi QSHE Medic otomatis dari zonasi: pertahankan pilihan manual.
    const qsheSuggestion = suggestRekQSHE(calculated as Record<string, string>);
    const currentQshe = fd.rekQSHE || '';
    if (!currentQshe || (currentState.autoRekQSHE && currentQshe === currentState.autoRekQSHE)) {
      updates.rekQSHE = qsheSuggestion;
    }
    const nextAutoRekQSHE = updates.rekQSHE !== undefined ? qsheSuggestion : currentState.autoRekQSHE;

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
      || nextAutoRekQSHE !== currentState.autoRekQSHE
      || autoKeys.some((key) => nextAutoInterp[key] !== (currentState.autoInterp[key] || ''))
      || zonasi !== currentState.zonasi
      || missingKey !== currentState.parameterBelumDinilai.join('|')) {
      set({
        formData: newFd,
        autoRekFU: nextAutoRekFU,
        autoRekQSHE: nextAutoRekQSHE,
        autoInterp: nextAutoInterp,
        zonasi,
        parameterBelumDinilai: missing,
      });
    }
  }
}));
