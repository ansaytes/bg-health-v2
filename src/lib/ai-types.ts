// ============================================================
// AI Vision Provider — tipe & konfigurasi akun AI
// ============================================================
//
// MENGAPA MODUL INI ADA
// ----------------------------------------------------------------
// Ekstraksi MCU membutuhkan model yang bisa MEMBACA GAMBAR (vision).
// Kuota sebuah API key bisa habis di tengah pekerjaan (429
// RESOURCE_EXHAUSTED / rate limit / kredit habis). Sebelumnya kondisi
// itu menggagalkan seluruh ekstraksi sehingga operator harus menunggu
// window kuota berikutnya.
//
// Modul ini memungkinkan operator menyimpan BEBERAPA akun AI (boleh
// campur provider) dan mengurutkannya. Saat satu akun gagal karena
// kuota/limit/kunci ditolak, permintaan otomatis dilanjutkan ke akun
// berikutnya. Hanya bila SEMUA akun gagal barulah error dikembalikan.
//
// Bentuk data tersimpan
//   config.aiAccounts  : AiAccount[]                 (tanpa rahasia)
//   secrets.accountKeys: { [accountId]: apiKey }     (terenkripsi AES-GCM)
//
// Kompatibilitas: konfigurasi lama (satu `apiKey` + `provider` + `model`
// di level atas) tetap dibaca sebagai satu akun, jadi pengguna lama
// tidak perlu mengatur ulang apa pun.

export type AiProviderKind = 'gemini' | 'openai-compatible';

export interface AiAccount {
  /** ID stabil, dipakai sebagai kunci penyimpanan API key. */
  id: string;
  /** Nama tampilan, mis. "Gemini Kantor" atau "OpenRouter Cadangan". */
  label: string;
  provider: AiProviderKind;
  /** Hanya untuk openai-compatible; kosong untuk gemini. */
  baseUrl: string;
  /** Model default akun ini. */
  model: string;
  /** Akun nonaktif dilewati tanpa dihapus. */
  enabled: boolean;
}

export interface AiAccountWithKey extends AiAccount {
  apiKey: string;
}

/** Gambar hasil penyamaran yang siap dikirim ke provider. */
export interface VisionImage {
  mimeType: string;
  /** Base64 tanpa prefix data-URL. */
  data: string;
}

export interface VisionRequest {
  images: VisionImage[];
  /** Instruksi sistem (skema ekstraksi). */
  systemInstruction: string;
  /** Prompt pengguna. */
  prompt: string;
  /** Model pilihan operator; kosong = pakai model default akun. */
  model?: string;
  temperature?: number;
  /** true = minta provider mengembalikan JSON valid. */
  jsonMode?: boolean;
  timeoutMs?: number;
}

export type VisionFailureKind = 'quota' | 'auth' | 'network' | 'invalid-response' | 'provider';

export interface VisionAttempt {
  accountId: string;
  label: string;
  provider: AiProviderKind;
  success: boolean;
  failureKind?: VisionFailureKind;
  status?: number;
  /** Pesan aman (tanpa API key). */
  message?: string;
}

export interface VisionResult {
  ok: boolean;
  /** Teks mentah dari model (JSON string bila jsonMode). */
  text: string;
  /** Akun yang berhasil menjawab. */
  accountId: string;
  accountLabel: string;
  /** Jejak percobaan, untuk ditampilkan ke operator. */
  attempts: VisionAttempt[];
  /** Terisi bila SEMUA akun gagal. */
  errorKind?: VisionFailureKind | 'no-account';
  errorMessage?: string;
  /** Saran jeda bila kegagalan terakhir adalah kuota. */
  retryAfterSeconds?: number;
}
