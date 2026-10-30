// ============================================================
// Format teks hasil follow up untuk surat kontrol
// ============================================================
//
// TUJUAN
// Menghasilkan satu baris ringkas yang bisa langsung dicetak pada surat
// pengantar/rujukan ke Fasilitas Kesehatan Rekanan, contoh:
//
//   "TD : 131/79 mmHg, HDL : 35 mg/dL, SGOT : 66 U/L, Visus Jauh OD : 6/20 OS : 6/15"
//
// KENAPA DIBUAT SENDIRI, BUKAN MENYIMPAN TEKS SAJA
// Nilai hasil follow up disimpan sebagai `string | number` di kolom `nilai`
// (JSONB) agar bisa dipakai menghitung zona. Teks surat dibentuk dari nilai
// itu saat diperlukan — sehingga angka dan teks tidak bisa menyimpang.
//
// ATURAN PENULISAN (mengikuti kebiasaan laboratorium/klinik Indonesia)
//   • Sistol/diastol digabung     : "TD : 131/79 mmHg"
//   • Desimal pakai koma          : "HbA1c : 7,2 %"
//   • Satuan dari definisi field  : mmHg, mg/dL, U/L, g/dL, %
//   • Visus dua mata dipisah      : "Visus Jauh OD : 6/20 OS : 6/15"
//   • Urut sesuai kekritisan      : trigger zona lebih dulu, lalu temuan lain

import { MCU_FIELDS, type MCUFieldDef } from '@/lib/mcu-fields';
import { parseVisusPerMata } from '@/lib/visus-parser';
import { angkaDari, fmtAngka } from '@/lib/mcu-normal-range';

const FIELD_BY_ID = new Map<string, MCUFieldDef>(MCU_FIELDS.map((f) => [f.id, f]));

/** Nilai hasil follow up: angka, teks, atau kosong. */
export type NilaiFollowUp = string | number | null | undefined;

/**
 * Field yang digabung penulisannya menjadi satu entri.
 * `tdS` dan `tdD` selalu dicetak bersama sebagai "TD : sistol/diastol".
 */
const GABUNGAN: Record<string, string[]> = {
  tdS: ['tdS', 'tdD'],
};

/** Label ringkas untuk surat — dipendekkan agar muat satu baris. */
const LABEL_RINGKAS: Record<string, string> = {
  tdS: 'TD',
  tdD: 'TD',
  gdp: 'GDP',
  gd2pp: 'GD2PP',
  hba1c: 'HbA1c',
  ldl: 'LDL',
  tg: 'TG',
  hdl: 'HDL',
  chol: 'Kolesterol',
  au: 'Asam Urat',
  hb: 'Hb',
  leukosit: 'Leukosit',
  trombosit: 'Trombosit',
  kreatinin: 'Kreatinin',
  egfr: 'eGFR',
  sgot: 'SGOT',
  sgpt: 'SGPT',
  visusJauh: 'Visus Jauh',
  pta: 'PTA',
  bmi: 'IMT',
  bb: 'BB',
  tb: 'TB',
  lp: 'Lingkar Perut',
  essScore: 'Skor ESS',
  srq20Score: 'Skor SRQ-20',
};

function labelField(id: string): string {
  return LABEL_RINGKAS[id] ?? FIELD_BY_ID.get(id)?.label ?? id;
}

function satuanField(id: string): string {
  return FIELD_BY_ID.get(id)?.unit ?? '';
}

/** nilainya kosong? (null, undefined, '', 'N/A') */
function kosong(v: NilaiFollowUp): boolean {
  if (v === null || v === undefined) return true;
  const s = String(v).trim();
  return !s || /^(n\/a|na|-|--)$/i.test(s);
}

/**
 * Memformat satu nilai untuk dicetak.
 * Angka → desimal koma Indonesia. Teks (visus) → apa adanya.
 */
function formatNilai(id: string, nilai: NilaiFollowUp): string {
  if (kosong(nilai)) return '';

  // Visus ditangani khusus: pisahkan OD & OS, tulis keduanya.
  // Hasilnya tanpa awalan titik dua agar tidak menjadi
  // "Visus Jauh : OD : 6/20" saat dirangkai dengan label.
  if (id === 'visusJauh') {
    const v = parseVisusPerMata(nilai as string);
    return v.label; // sudah berbentuk "OD : 6/20 OS : 6/15"
  }

  const n = angkaDari(String(nilai));
  if (n !== null) return fmtAngka(n);
  return String(nilai).trim();
}

export interface HasilFormat {
  /** Satu baris siap cetak. */
  teks: string;
  /** Rincian per parameter, untuk tampilan tabel. */
  rincian: { id: string; label: string; nilai: string; satuan: string }[];
}

/**
 * Membentuk teks surat kontrol dari nilai hasil follow up.
 *
 * @param nilai        objek { fieldId: nilai }
 * @param urutanPrioritas  fieldId yang didahulukan (mis. trigger zona)
 */
export function formatSuratKontrol(
  nilai: Record<string, NilaiFollowUp>,
  urutanPrioritas: string[] = [],
): HasilFormat {
  const sudahDitulis = new Set<string>();
  const rincian: HasilFormat['rincian'] = [];

  // Urutan: prioritas dulu, lalu sisanya sesuai urutan definisi field.
  const urutan: string[] = [];
  for (const id of urutanPrioritas) if (!sudahDitulis.has(id)) urutan.push(id);
  for (const f of MCU_FIELDS) {
    if (!sudahDitulis.has(f.id) && !urutan.includes(f.id)) urutan.push(f.id);
  }
  for (const id of Object.keys(nilai)) {
    if (!urutan.includes(id)) urutan.push(id);
  }

  for (const id of urutan) {
    if (sudahDitulis.has(id)) continue;

    // ── Kasus khusus: tekanan darah digabung ─────────────────────
    if (id === 'tdS') {
      const s = formatNilai('tdS', nilai.tdS);
      const d = formatNilai('tdD', nilai.tdD);
      sudahDitulis.add('tdS');
      sudahDitulis.add('tdD');
      if (!s && !d) continue;
      const teks = s && d ? `${s}/${d}` : (s || d);
      rincian.push({ id: 'tdS', label: 'TD', nilai: teks, satuan: 'mmHg' });
      continue;
    }
    if (id === 'tdD') continue; // sudah ditangani bersama tdS

    const n = formatNilai(id, nilai[id]);
    if (!n) continue;
    sudahDitulis.add(id);
    rincian.push({
      id,
      label: labelField(id),
      nilai: n,
      satuan: id === 'visusJauh' ? '' : satuanField(id),
    });
  }

  // ── Rangkai menjadi satu baris ─────────────────────────────────
  // Format acuan (sesuai surat pengantar Faskes):
  //   "TD : 131/79 mmHg, HDL : 35 mg/dL, Visus Jauh OD : 6/20 OS : 6/15"
  // Untuk visus, label sudah memuat "OD"/"OS" sehingga titik dua setelah
  // label tidak ditambahkan.
  const teks = rincian
    .map((r) => {
      if (r.id === 'visusJauh') return `${r.label} ${r.nilai}`;
      return r.satuan ? `${r.label} : ${r.nilai} ${r.satuan}` : `${r.label} : ${r.nilai}`;
    })
    .join(', ');

  return { teks, rincian };
}

/**
 * Teks ringkas hanya untuk parameter yang ABNORMAL — dipakai pada surat
 * pengantar ke Faskes agar yang dicetak hanya yang perlu ditindaklanjuti.
 */
export function formatSuratKontrolAbnormal(
  nilai: Record<string, NilaiFollowUp>,
  fieldAbnormal: string[],
): HasilFormat {
  const terfilter: Record<string, NilaiFollowUp> = {};
  for (const id of fieldAbnormal) {
    if (id === 'tdS' || id === 'tdD') {
      terfilter.tdS = nilai.tdS;
      terfilter.tdD = nilai.tdD;
    } else if (id in nilai) {
      terfilter[id] = nilai[id];
    }
  }
  // Sertakan semua TD bila salah satu abnormal.
  if (terfilter.tdS !== undefined || terfilter.tdD !== undefined) {
    terfilter.tdS = nilai.tdS;
    terfilter.tdD = nilai.tdD;
  }
  return formatSuratKontrol(terfilter, fieldAbnormal);
}

/** Daftar field yang digabung, untuk dipakai pemanggil saat menyaring. */
export const FIELD_GABUNGAN = GABUNGAN;
