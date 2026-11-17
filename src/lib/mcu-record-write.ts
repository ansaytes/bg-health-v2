// ============================================================
// Penulisan mcu_records yang tahan selisih skema
// ============================================================
//
// MASALAH
// PostgREST menolak SELURUH payload update/insert bila satu kolom saja tidak
// ada di cache skemanya:
//
//   Could not find the 'anti_hav' column of 'mcu_records' in the schema cache
//   (PGRST204)
//
// Artinya satu field yang didaftarkan di MCU_FIELDS tetapi kolomnya belum
// ditambahkan di database membuat SEMUA perubahan MCU gagal tersimpan —
// termasuk field lain yang kolomnya sudah ada. Karena endpoint lain
// (rekalkulasi, simpan kuesioner, ProKawan, evaluasi) menulis payload yang
// sama bentuknya, gangguan yang sama bisa muncul di sana juga.
//
// PENANGANAN
// Payload ditulis apa adanya. Bila server menyebut satu nama kolom yang tidak
// dikenal, kolom itu dibuang dari payload dan penulisan diulang. Hasilnya:
// perubahan pada kolom yang memang ada tetap tersimpan, dan kolom yang belum
// ada dilaporkan (bukan gagal senyap, bukan pula menghentikan seluruh proses).
//
// Pesan PostgREST hanya menyebut SATU kolom per percobaan, sehingga
// pengulangan dilakukan sampai tidak ada lagi nama kolom yang disebut.

/** Nama kolom yang disebut PostgREST saat kolom tidak ada di skema. */
const KOLOM_TIDAK_DITEMUKAN = /Could not find the '([^']+)' column/i;

/** Batas pengulangan — jauh di atas jumlah kolom MCU yang ada. */
const MAX_PERCOBAAN = 40;

/** Hasil penulisan: data yang akhirnya terkirim dan kolom yang dilewati. */
export interface HasilTulisMcU {
  /** Payload yang berhasil tersimpan (setelah kolom bermasalah dibuang). */
  data: Record<string, any>;
  /** Nama kolom yang tidak ada di database sehingga dilewati. */
  dilewati: string[];
}

/**
 * Menjalankan satu operasi tulis ke mcu_records, dan mengulanginya tanpa
 * kolom yang menurut PostgREST tidak ada.
 *
 * `jalankan` harus menjalankan query yang sama dengan payload yang diberikan,
 * mis. `(payload) => supabase.from('mcu_records').update(payload).eq('id', id)`.
 */
export async function tulisMcuRecordTahanSkema(
  data: Record<string, any>,
  // Query builder Supabase adalah thenable, bukan Promise murni.
  jalankan: (payload: Record<string, any>) => PromiseLike<{ error: any }>,
): Promise<HasilTulisMcU> {
  const payload: Record<string, any> = { ...data };
  const dilewati: string[] = [];

  for (let attempt = 0; attempt <= MAX_PERCOBAAN; attempt += 1) {
    const { error } = await jalankan(payload);
    if (!error) return { data: payload, dilewati };

    const kolom = KOLOM_TIDAK_DITEMUKAN.exec(String(error.message || ''))?.[1];
    // Bukan soal kolom hilang (mis. RLS, jaringan) → teruskan apa adanya.
    // Juga berhenti bila nama kolom yang disebut sudah tidak ada di payload,
    // supaya tidak mengulang tanpa perubahan.
    if (!kolom || !(kolom in payload)) throw error;

    console.warn(
      `[mcu_records] Kolom "${kolom}" tidak ada di database; kolom dilewati saat menyimpan.`,
    );
    delete payload[kolom];
    dilewati.push(kolom);
  }

  throw new Error('Terlalu banyak kolom mcu_records yang tidak ada di database');
}
