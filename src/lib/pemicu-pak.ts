// ============================================================
// Engine Pemicu Dugaan PAK — INK/017 Lampiran 1
// ============================================================
//
// Membaca SEJARAH MCU multi-baris + HRA, lalu menghasilkan SARAN pemicu
// (nomor kriteria Lampiran 1). Keputusan tetap di QS Medic/dokter: sistem
// hanya menandai kandidat + alasannya.
//
// Kriteria yang membutuhkan SEJARAH (baseline):
//  - (1) STS: butuh audiometri baseline — dari baris MCU paling awal.
//  - (2) Spirometri "penurunan bermakna vs MCU sebelumnya".
//  - (5) SGPT/SGOT tinggi BERULANG (2 MCU).
//  - (6) Kreatinin/eGFR — kontekstual pajanan HRA.
//
// Kriteria yang TIDAK memicu otomatis: parameter PTM (TD, gula, LDL, IMT,
// kuesioner) — itu pemicu zonasi/proKawan, bukan PAK (INK/017 Lampiran 1).

export interface McuLike {
  id?: string | number;
  tglMcu?: string | null;
  // Audiometri (acr = kanan, acl = kiri)
  acr_2k?: number | null; acr_3k?: number | null; acr_4k?: number | null;
  acl_2k?: number | null; acl_3k?: number | null; acl_4k?: number | null;
  acr_500?: number | null; acr_1k?: number | null; acr_6k?: number | null; acr_8k?: number | null;
  acl_500?: number | null; acl_1k?: number | null; acl_6k?: number | null; acl_8k?: number | null;
  pta?: number | null;
  audInterp?: string | null;
  // Spirometri
  fev1FvcAct?: number | null; fev1Pct?: number | null; fvcPct?: number | null;
  spiInterp?: string | null;
  // Kimia darah
  sgot?: number | null; sgpt?: number | null; ggt?: number | null;
  kreatinin?: number | null; egfr?: number | null;
  hb?: number | null; leukosit?: number | null; trombosit?: number | null;
  // Imaging / klinik
  chestXR?: string | null;
  visusJauh?: string | null;
  lbp?: string | null;
  riwayatEpilepsi?: string | null;
  sumber?: string | null;
}

export interface PemicuSaran {
  /** Nomor kriteria Lampiran 1 INK/017. */
  kriteria: number;
  nama: string;
  alasan: string;
  /** Data pendukung yang dipakai sistem untuk menandai. */
  data: string;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Rata-rata ambang 2000/3000/4000 Hz untuk STS per telinga (STD/033 6.4). */
function avg3(m: McuLike, prefix: 'acr' | 'acl'): number | null {
  const vals = [num(m[`${prefix}_2k`]), num(m[`${prefix}_3k`]), num(m[`${prefix}_4k`])];
  // 3 kHz kosong pada baseline historis diestimasi (2k+4k)/2 — STD/033 6.4.
  if (vals[1] === null && vals[0] !== null && vals[2] !== null) vals[1] = (vals[0]! + vals[2]!) / 2;
  if (vals.includes(null)) return null;
  return ((vals[0] as number) + (vals[1] as number) + (vals[2] as number)) / 3;
}

/** Kriteria 1 — STS vs baseline, atau penurunan ambang pada telinga mana pun. */
function cekPendengaran(history: McuLike[], kategori: 'A' | 'B' | 'C' | null): PemicuSaran[] {
  const out: PemicuSaran[] = [];
  if (history.length === 0) return out;

  const sorted = [...history].sort((a, b) => String(a.tglMcu ?? '').localeCompare(String(b.tglMcu ?? '')));
  const baseline = sorted[0];
  const latest = sorted[sorted.length - 1];
  if (baseline === latest) return out;

  for (const ear of ['kanan', 'kiri'] as const) {
    const prefix = ear === 'kanan' ? 'acr' : 'acl';
    const b = avg3(baseline, prefix as 'acr' | 'acl');
    const l = avg3(latest, prefix as 'acr' | 'acl');
    if (b === null || l === null) continue;

    const geser = l - b;
    if (geser >= 10) {
      out.push({
        kriteria: 1, nama: 'Audiometri — STS',
        alasan: `STS pada telinga ${ear}: rata-rata 2000/3000/4000 Hz bergeser ${geser.toFixed(1)} dB dari baseline (STD/033 6.4).`,
        data: `Baseline ${b.toFixed(1)} dB (${baseline.tglMcu ?? '-'}) → Terakhir ${l.toFixed(1)} dB (${latest.tglMcu ?? '-'})`,
      });
      continue;
    }
    // Kriteria 1 bagian kedua: penurunan ambang pada Kategori A/B (juga di luar STS).
    if ((kategori === 'A' || kategori === 'B') && geser >= 5) {
      out.push({
        kriteria: 1, nama: 'Audiometri — Penurunan ambang Kategori A/B',
        alasan: `Penurunan ambang ${geser.toFixed(1)} dB pada telinga ${ear} untuk karyawan Kategori ${kategori} (INK/017 Lampiran 1 kriteria 1).`,
        data: `Baseline ${b.toFixed(1)} dB → Terakhir ${l.toFixed(1)} dB`,
      });
    }
  }
  return out;
}

/** Kriteria 2 — pola spirometri restriktif/obstruktif, atau penurunan bermakna. */
function cekSpirometri(history: McuLike[]): PemicuSaran[] {
  const out: PemicuSaran[] = [];
  const sorted = [...history].sort((a, b) => String(a.tglMcu ?? '').localeCompare(String(b.tglMcu ?? '')));
  const latest = sorted[sorted.length - 1];
  if (!latest) return out;

  const ratio = num(latest.fev1FvcAct);
  const interp = String(latest.spiInterp ?? '').toLowerCase();
  if ((ratio !== null && ratio < 0.7) || /obstruksi|restriksi|obstruktif|restriktif/i.test(interp)) {
    out.push({
      kriteria: 2, nama: 'Spirometri abnormal',
      alasan: `Pola ${/restri/i.test(interp) ? 'restriktif' : 'obstruktif'} (FEV1/FVC ${ratio !== null ? (ratio * 100).toFixed(0) + '%' : 'n/a'}) pada pekerja terpapar debu/asap/uap.`,
      data: `Spirometri ${latest.tglMcu ?? '-'}: ${interp || `FEV1/FVC ${ratio ?? 'n/a'}`}`,
    });
  }

  // Penurunan FEV1 bermakna vs MCU sebelumnya (≥15%).
  if (sorted.length >= 2) {
    const prev = sorted[sorted.length - 2];
    const fev1Now = num(latest.fev1Pct);
    const fev1Prev = num(prev.fev1Pct);
    if (fev1Now !== null && fev1Prev !== null && fev1Prev - fev1Now >= 15) {
      out.push({
        kriteria: 2, nama: 'Spirometri — penurunan bermakna',
        alasan: `FEV1 turun ${(fev1Prev - fev1Now).toFixed(0)}% dibanding MCU sebelumnya.`,
        data: `${fev1Prev}% (${prev.tglMcu ?? '-'}) → ${fev1Now}% (${latest.tglMcu ?? '-'})`,
      });
    }
  }
  return out;
}

/** Kriteria 3 — rontgen thorax pada pajanan debu. */
function cekChestXR(history: McuLike[]): PemicuSaran[] {
  const latest = [...history].sort((a, b) => String(a.tglMcu ?? '').localeCompare(String(b.tglMcu ?? ''))).pop();
  if (!latest?.chestXR) return [];
  const xr = String(latest.chestXR);
  if (/^(normal|n\/a|dbn|-)$/i.test(xr.trim())) return [];
  return [{
    kriteria: 3, nama: 'Rontgen thorax',
    alasan: `Temuan thorax pada pekerja terpapar debu: "${xr}".`,
    data: `CXR ${latest.tglMcu ?? '-'}`,
  }];
}

/** Kriteria 5 — SGPT/SGOT tinggi BERULANG (2 MCU) pada pajanan kimia. */
function cekHati(history: McuLike[]): PemicuSaran[] {
  const out: PemicuSaran[] = [];
  if (history.length < 2) return out;
  const sorted = [...history].sort((a, b) => String(a.tglMcu ?? '').localeCompare(String(b.tglMcu ?? '')));
  // Ambang INK/017 Lampiran 1: SGPT >60 U/L atau SGOT >55 U/L (STD/003).
  const tinggi = sorted.filter((m) => (num(m.sgpt) ?? 0) > 60 || (num(m.sgot) ?? 0) > 55);
  if (tinggi.length >= 2) {
    out.push({
      kriteria: 5, nama: 'Fungsi hati berulang',
      alasan: `SGPT/SGOT melewati 60/55 U/L pada ${tinggi.length} pengukuran berulang. KLARIFIKASI: periksa dokumen HRA untuk memastikan pajanan solvent/hidrokarbon pada unit kerja pekerja.`,
      data: tinggi.map((m) => `${m.tglMcu ?? '-'}: SGPT ${m.sgpt ?? 'n/a'}/SGOT ${m.sgot ?? 'n/a'}`).join(' · '),
    });
  }
  return out;
}

/** Kriteria 6 — kreatinin ≥1.5 atau eGFR <60 (kontekstual pajanan — cek HRA). */
function cekGinjal(history: McuLike[]): PemicuSaran[] {
  const out: PemicuSaran[] = [];
  const sorted = [...history].sort((a, b) => String(a.tglMcu ?? '').localeCompare(String(b.tglMcu ?? '')));
  const latest = sorted[sorted.length - 1];
  if (!latest) return out;
  const kre = num(latest.kreatinin);
  const egfr = num(latest.egfr);
  if ((kre !== null && kre >= 1.5) || (egfr !== null && egfr < 60)) {
    out.push({
      kriteria: 6, nama: 'Fungsi ginjal',
      alasan: `Kreatinin ${kre ?? 'n/a'} mg/dL${egfr !== null ? ` / eGFR ${egfr}` : ''}. KLARIFIKASI: periksa dokumen HRA untuk memastikan pajanan panas ekstrem/dehidrasi berulang/logam berat pada unit kerja pekerja.`,
      data: `Kimia darah ${latest.tglMcu ?? '-'}`,
    });
  }
  return out;
}

/** Kriteria 7 — hematologi pada pajanan benzena/BBM. */
function cekHematologi(history: McuLike[]): PemicuSaran[] {
  const out: PemicuSaran[] = [];
  const sorted = [...history].sort((a, b) => String(a.tglMcu ?? '').localeCompare(String(b.tglMcu ?? '')));
  const latest = sorted[sorted.length - 1];
  if (!latest) return out;
  const hb = num(latest.hb);
  const leuk = num(latest.leukosit);
  const trom = num(latest.trombosit);
  const findings: string[] = [];
  if (hb !== null && hb < 10) findings.push(`Hb ${hb} g/dL`);
  if (leuk !== null && leuk < 4) findings.push(`Leukopenia ${leuk}`);
  if (trom !== null && trom < 150) findings.push(`Trombositopenia ${trom}`);
  if (findings.length) {
    out.push({
      kriteria: 7, nama: 'Hematologi',
      alasan: `${findings.join(', ')} tanpa penjelasan non-okupasi. KLARIFIKASI: periksa dokumen HRA untuk memastikan pajanan benzena/BBM pada unit kerja pekerja.`,
      data: `Hematologi ${latest.tglMcu ?? '-'}`,
    });
  }
  return out;
}

/** Kriteria 9 — LBP/CTS pada getaran/manual handling/repetitif. */
function cekMuskuloskeletal(history: McuLike[]): PemicuSaran[] {
  const latest = [...history].sort((a, b) => String(a.tglMcu ?? '').localeCompare(String(b.tglMcu ?? ''))).pop();
  if (!latest) return [];
  const lbp = String(latest.lbp ?? '');
  const findings: string[] = [];
  if (/HNP|hernia|defisit/i.test(lbp)) findings.push(`LBP: ${lbp}`);
  const cts = latest.sumber ?? null;
  if (cts && /CTS|carpal/i.test(String(cts))) findings.push(`Anamnesis: ${cts}`);
  if (findings.length) {
    return [{
      kriteria: 9, nama: 'Muskuloskeletal / neuro',
      alasan: `${findings.join(' · ')} pada pekerja getaran/manual handling/kerja repetitif. KLARIFIKASI: periksa dokumen HRA untuk memastikan pajanan getaran/manual handling/repetitif pada unit kerja pekerja.`,
      data: `Anamnesis ${latest.tglMcu ?? '-'}`,
    }];
  }
  return [];
}

/**
 * Hitung semua saran pemicu dari sejarah MCU + kategori pajanan.
 * Kategori A/B/C dari STD/033 6.3 (dipakai kriteria 1 bagian kedua).
 */
export function hitungSaranPemicu(
  history: McuLike[],
  kategori: 'A' | 'B' | 'C' | null,
): PemicuSaran[] {
  const out: PemicuSaran[] = [];
  out.push(...cekPendengaran(history, kategori));
  out.push(...cekSpirometri(history));
  out.push(...cekChestXR(history));
  out.push(...cekHati(history));
  out.push(...cekGinjal(history));
  out.push(...cekHematologi(history));
  out.push(...cekMuskuloskeletal(history));
  return out;
}
