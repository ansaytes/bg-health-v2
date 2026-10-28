// ============================================================
// Penjadwalan kontrol ProKawan — turunan otomatis STD/006 Bab 7
// ============================================================
//
// SIAPA YANG MENETAPKAN JADWAL?
// ----------------------------------------------------------------
// Bukan PIC Site, dan bukan Karyawan. INK/016 poin 4.1.4:
//
//   "QSHE Medic memberitahukan kepesertaan ProKawan kepada karyawan yang
//    bersangkutan, beserta jalur pengendalian dan jadwal kontrol atau
//    pemantauan PERTAMA."
//
// Jadi QSHE Medic yang menetapkan dan MEMBERITAHUKAN jadwal pertama. PIC Site /
// Paramedic Site hanya mencatat kunjungan aktual + evidence dokter (poin 4.4.4:
// "Karyawan wajib menyerahkan bukti kontrol atau surat clearance kepada
// Paramedic Site dan/atau QSHE Medic").
//
// MENGAPA OTOMATIS?
// ----------------------------------------------------------------
// Dokumen SUDAH menetapkan tanggalnya, hanya secara berelatif bukan absolut:
//
//   frekuensi = kolom Pengendalian parameter (Bab 7)
//   jatuh tempo = tanggal pemeriksaan terakhir + frekuensi tersebut
//
// Kombinasi ini yang dipakai engine (`frekuensi_evaluasi`) dan benar-benar
// terisi di 1.000 record. Menyuruh PIC Site mengetik 1.000 tanggal secara
// manual bukan hanya merepotkan — ia juga MENAMBAH RISIKO SALAH HITUNG, padahal
// angkanya sudah bisa dihitung dari data yang ada.
//
// Karena itu: sistem MENGUSULKAN tanggal, QSHE Medic MENGONFIRMASI. Jadwal
// hasil usulan tetap disimpan di `kunjungan_kontrol` agar bisa diubah, dicetak,
// dan dijadikan dasar pengingat WhatsApp — bukan sekadar angka di layar.
//
// TIDAK SEMUA PARAMETER PUNYA TANGGAL
// ----------------------------------------------------------------
// Bab 7 menyatakan tegas untuk IMT 23–30 tanpa komorbid dan hiperurisemia
// ringan: "TIDAK diwajibkan kontrol dokter berkala; pemantauan dilakukan oleh
// Paramedic site/QSHE Medic". Untuk peserta seperti itu TIDAK ADA tanggal
// kontrol dokter — sistem menandainya `pemantauan-paramedis`, bukan mengarang
// tanggal. Tanggal "evaluasi ulang zona" (3 bulan) bukan jadwal kontrol dokter.
//
// SUMBER EVALUASI ULANG ZONA — BUKAN MCU
// ----------------------------------------------------------------
// INK/016 poin 4.4.5: "Hasil pemeriksaan dari Fasilitas Kesehatan Rekanan
// disampaikan kepada QSHE Medic sebagai BAHAN EVALUASI dan pembaruan Zona
// Risiko PTM."
// INK/016 poin 4.6.1: QSHE Medic "mengevaluasi hasil pemeriksaan ProKawan
// sesuai frekuensi pada poin 4.3 dan memperbarui Zona Risiko PTM".
//
// Artinya evaluasi ulang zona memakai NILAI HASIL KONTROL TERBARU per
// parameter yang dibawa peserta dari Fasilitas Kesehatan Rekanan — BUKAN
// menunggu MCU tahunan berikutnya. Karena itu kunjungan kontrol di aplikasi
// wajib menyimpan nilai parameter (evidence), supaya zona bisa dihitung ulang
// dari data kontrol itu. Dokumen juga menegaskan pada poin 4.3.4: HbA1c
// diperiksa setiap 3 bulan selama peserta berada di Zona Kuning/Merah —
// pemeriksaan kontrol, bukan MCU.
// ============================================================

import { hashField } from '@/lib/encryption';
import { adminClient } from '@/lib/questionnaire-store';
import { aturanDariLabel } from '@/lib/ptm-pengendalian';
import type { PesertaLengkap } from '@/lib/prokawan-peserta';

export type ModePenjadwalan = 'usulan' | 'konfirmasi';

export interface UsulanJadwal {
  nik: string;
  nikHash: string;
  nama: string;
  site: string;
  zona: 'Kuning' | 'Merah';
  jalur: string;
  frekuensiBulan: number | null;
  /** Tanggal kontrol yang diusulkan; null bila parameter tanpa kontrol dokter. */
  jadwalUsulan: string | null;
  /** Dasar hitungan yang ditampilkan ke pengguna agar dapat diaudit. */
  dasar: string;
  alasanTanpaJadwal: string | null;
  /** true bila kunjungan_kontrol sudah punya jadwal pada rentang tanggal itu. */
  sudahAda: boolean;
}

export interface HasilPenjadwalan {
  totalPeserta: number;
  diusulkan: number;
  tanpaJadwal: number;
  sudahAda: number;
  ditulis: number;
  daftar: UsulanJadwal[];
}

/**
 * Menentukan jadwal kontrol yang diusulkan untuk satu peserta.
 *
 * Urutan:
 *  1. Jalur pemantauan paramedis / evaluasi alat bantu → TIDAK ada jadwal
 *     kontrol dokter (sistem tetap menandai evaluasi 3 bulan sebagai
 *     informasi, bukan jadwal).
 *  2. Tanpa frekuensi (bulan null) → tidak ada jadwal.
 *  3. Tanpa tanggal acuan → tidak ada jadwal (perlu MCU dulu).
 */
export function usulanJadwalPeserta(p: PesertaLengkap): UsulanJadwal {
  const dasarPeserta = {
    nik: p.nik,
    nikHash: p.nikHash ?? hashField(p.nik) ?? '',
    nama: p.nama,
    site: p.site,
    zona: p.zona,
    jalur: p.jalur,
  };

  // PENTING — jalur dipakai HANYA bila seluruh parameternya memang tanpa
  // kontrol dokter berkala.
  //
  // `rencanaDariTriggers()` mengambil jalur dari parameter yang paling KETAT.
  // Namun urutan pencocokan membuat "Obesity (Class I)" selalu terbaca
  // pemantauan-paramedis lebih dulu, sehingga peserta Merah yang juga obesitas
  // (mis. "IMT ≥25 tanpa komplikasi berat" pada Zona Merah) kehilangan jadwal
  // kontrolnya. Bukti pada data: peserta dengan frekuensi 1 bulan ada yang
  // berjalur pemantauan-paramedis.
  //
  // Aturan yang benar: bila ADA frekuensi kontrol dokter (bulan != null),
  // jadwal tetap dibuat — prinsip risiko tertinggi (STD/006 6.2.2).
  const hanyaPemantauan = p.bulan === null
    && (p.jalur === 'pemantauan-paramedis' || p.jalur === 'evaluasi-alat-bantu');

  if (hanyaPemantauan) {
    return {
      ...dasarPeserta,
      frekuensiBulan: null,
      jadwalUsulan: null,
      dasar: 'Kolom Pengendalian Bab 7 tidak mewajibkan kontrol dokter berkala',
    // Frekuensi evaluasi 3 bulan tetap berlaku, tetapi TANPA jadwal kontrol dokter.
      // KOREKSI: evaluasi ulang zona BUKAN lewat MCU. INK/016 poin 4.4.5 &
      // 4.6.1 — QSHE Medic memperbarui zona berdasarkan hasil pemeriksaan dari
      // Fasilitas Kesehatan Rekanan (nilai kontrol terbaru per parameter).
      alasanTanpaJadwal: p.jalur === 'pemantauan-paramedis'
        ? 'Pemantauan oleh Paramedic Site/QSHE Medic; evaluasi ulang zona setiap 3 bulan dari nilai hasil pemeriksaan parameter terbaru'
        : 'Evaluasi/penyesuaian alat bantu di Faskes Rekanan; evaluasi zona setiap 3 bulan dari nilai hasil pemeriksaan parameter terbaru',
      sudahAda: false,
    };
  }

  if (p.bulan === null) {
    return {
      ...dasarPeserta,
      frekuensiBulan: null,
      jadwalUsulan: null,
      dasar: 'Parameter tidak menetapkan frekuensi kontrol',
      alasanTanpaJadwal: 'Perlu penetapan oleh QSHE Medic berdasarkan rekomendasi dokter',
      sudahAda: false,
    };
  }

  if (!p.jatuhTempo) {
    return {
      ...dasarPeserta,
      frekuensiBulan: p.bulan,
      jadwalUsulan: null,
      dasar: `Frekuensi ${p.bulan} bulan, tetapi tanggal acuan pemeriksaan belum ada`,
      alasanTanpaJadwal: 'Tanggal MCU/pemeriksaan terakhir belum tersedia — jalankan MCU atau isi tanggal manual',
      sudahAda: false,
    };
  }

  // Ambil nama parameter pemicu dari trigger untuk ditampilkan sebagai dasar.
  const pemicu = p.triggers
    .map((t) => aturanDariLabel(t)?.baris)
    .find((b): b is string => Boolean(b));

  return {
    ...dasarPeserta,
    frekuensiBulan: p.bulan,
    jadwalUsulan: p.jatuhTempo,
    dasar: `Tgl pemeriksaan terakhir + ${p.bulan} bulan${pemicu ? ` (${pemicu})` : ''}`,
    alasanTanpaJadwal: null,
    sudahAda: false,
  };
}

/**
 * Menjalankan penjadwalan untuk seluruh peserta.
 *
 * mode 'usulan'   → hitung saja, tidak menulis apa pun (aman, default).
 * mode 'konfirmasi' → tulis ke `kunjungan_kontrol` (nik_hash + jadwal_tanggal),
 *                     melewati baris yang sudah ada agar tidak menduplikasi.
 */
export async function jalankanPenjadwalan(mode: ModePenjadwalan, peserta: PesertaLengkap[]): Promise<HasilPenjadwalan> {
  const client = adminClient();
  const usulan = peserta.map(usulanJadwalPeserta);

  // Tandai yang sudah punya jadwal pada tanggal yang sama.
  const kandidat = usulan.filter((u) => u.jadwalUsulan && u.nikHash);
  const sudahAdaKunci = new Set<string>();
  if (kandidat.length) {
    const hashes = [...new Set(kandidat.map((u) => u.nikHash))];
    for (let i = 0; i < hashes.length; i += 150) {
      const { data } = await client
        .from('kunjungan_kontrol')
        .select('nik_hash,jadwal_tanggal')
        .in('nik_hash', hashes.slice(i, i + 150));
      for (const r of data ?? []) {
        sudahAdaKunci.add(`${r.nik_hash}|${String(r.jadwal_tanggal ?? '').slice(0, 10)}`);
      }
    }
  }

  let ditulis = 0;
  for (const u of usulan) {
    if (u.jadwalUsulan && u.nikHash) {
      u.sudahAda = sudahAdaKunci.has(`${u.nikHash}|${u.jadwalUsulan.slice(0, 10)}`);
    }
  }

  if (mode === 'konfirmasi') {
    const baru = usulan.filter((u) => u.jadwalUsulan && u.nikHash && !u.sudahAda);
    for (const u of baru) {
      const { error } = await client.from('kunjungan_kontrol').insert({
        nik_hash: u.nikHash,
        site: u.site || null,
        zona_risiko: u.zona,
        jadwal_tanggal: u.jadwalUsulan,
        hasil: 'BELUM',
        catatan: `Jadwal otomatis STD/006: ${u.dasar}`,
        created_by: 'system:jadwal-otomatis',
      });
      if (!error) { ditulis += 1; u.sudahAda = true; }
    }
  }

  return {
    totalPeserta: peserta.length,
    diusulkan: usulan.filter((u) => u.jadwalUsulan).length,
    tanpaJadwal: usulan.filter((u) => !u.jadwalUsulan).length,
    sudahAda: usulan.filter((u) => u.sudahAda).length,
    ditulis,
    daftar: usulan,
  };
}
