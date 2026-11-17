import { describe, expect, it } from 'vitest';

import {
  FREKUENSI_HARI_BAWAAN,
  TENGGAT_PICA_HARI,
  deskripsiTemuan,
  durasiHari,
  frekuensiUntukJenis,
  hitungCakupan,
  kunciPicaOtomatis,
  layakJadiPica,
  tanggalRencanaPeriode,
  tingkatDariStatus,
  periodeBulan,
  picaOverdue,
  ringkasPica,
  ringkasProgram,
  selisihHari,
  statusEfektif,
  tanggalISO,
  tepatWaktu,
  tenggatDariTingkat,
  warnaPersen,
  type BarisJadwal,
  type BarisPica,
  type TemuanMasuk,
} from '@/lib/inspeksi-program';

/** Tanggal acuan tetap supaya uji tidak bergantung pada hari ini. */
const SEKARANG = new Date(2026, 10, 15); // 15 November 2026

const jadwal = (patch: Partial<BarisJadwal>): BarisJadwal => ({
  jenis: 'p3k',
  site: 'Site A',
  objek_id: '1',
  objek_nama: 'Kotak P3K',
  periode: '2026-11',
  tanggal_rencana: '2026-11-10',
  tanggal_selesai: null,
  status: 'rencana',
  petugas: null,
  ...patch,
});

describe('statusEfektif', () => {
  it('terlewat mulai H+1, bukan pada hari-H', () => {
    expect(statusEfektif(jadwal({ tanggal_rencana: '2026-11-16' }), SEKARANG)).toBe('rencana');
    expect(statusEfektif(jadwal({ tanggal_rencana: '2026-11-15' }), SEKARANG)).toBe('rencana');
    expect(statusEfektif(jadwal({ tanggal_rencana: '2026-11-14' }), SEKARANG)).toBe('terlewat');
  });

  it('selesai mengalahkan tenggat yang lewat', () => {
    expect(statusEfektif(
      jadwal({ tanggal_rencana: '2026-11-01', tanggal_selesai: '2026-11-12' }),
      SEKARANG,
    )).toBe('selesai');
  });

  it('dibatalkan tidak pernah dianggap terlewat', () => {
    expect(statusEfektif(
      jadwal({ tanggal_rencana: '2026-10-01', status: 'dibatalkan' }),
      SEKARANG,
    )).toBe('dibatalkan');
  });
});

describe('tepatWaktu', () => {
  it('selesai pada tanggal rencana = tepat', () => {
    expect(tepatWaktu({ tanggal_rencana: '2026-11-10', tanggal_selesai: '2026-11-10' })).toBe(true);
  });
  it('selesai setelah tanggal rencana = terlambat', () => {
    expect(tepatWaktu({ tanggal_rencana: '2026-11-10', tanggal_selesai: '2026-11-11' })).toBe(false);
  });
  it('belum selesai = bukan tepat waktu', () => {
    expect(tepatWaktu({ tanggal_rencana: '2026-11-10', tanggal_selesai: null })).toBe(false);
  });
});

describe('warnaPersen', () => {
  it('mengikuti ambang 95 dan 85', () => {
    expect(warnaPersen(95)).toBe('hijau');
    expect(warnaPersen(94.9)).toBe('kuning');
    expect(warnaPersen(85)).toBe('kuning');
    expect(warnaPersen(84.9)).toBe('merah');
  });
});

describe('ringkasProgram', () => {
  it('membatalkan tidak menurunkan target', () => {
    const r = ringkasProgram([
      jadwal({ tanggal_selesai: '2026-11-10' }),
      jadwal({ status: 'dibatalkan' }),
    ], SEKARANG);
    expect(r.target).toBe(1);
    expect(r.selesai).toBe(1);
    expect(r.persenSelesai).toBe(100);
  });

  it('menghitung tepat waktu vs terlambat terpisah', () => {
    const r = ringkasProgram([
      jadwal({ tanggal_selesai: '2026-11-10' }), // tepat
      jadwal({ tanggal_selesai: '2026-11-14' }), // terlambat 4 hari
      jadwal({ tanggal_rencana: '2026-11-01' }), // terlewat
      jadwal({ tanggal_rencana: '2026-11-30' }), // belum
    ], SEKARANG);
    expect(r.target).toBe(4);
    expect(r.selesai).toBe(2);
    expect(r.tepatWaktu).toBe(1);
    expect(r.terlambat).toBe(1);
    expect(r.terlewat).toBe(1);
    expect(r.belum).toBe(1);
    expect(r.persenSelesai).toBe(50);
    expect(r.persenTepatWaktu).toBe(50);
  });

  it('target kosong tidak menghasilkan NaN', () => {
    const r = ringkasProgram([], SEKARANG);
    expect(r.persenSelesai).toBe(0);
    expect(r.persenTepatWaktu).toBe(0);
  });

  it('daftar terlewat diurutkan dari yang paling lama', () => {
    const r = ringkasProgram([
      jadwal({ objek_id: 'baru', tanggal_rencana: '2026-11-14' }),
      jadwal({ objek_id: 'lama', tanggal_rencana: '2026-09-01' }),
    ], SEKARANG);
    expect(r.daftarTerlewat.map(b => b.objek_id)).toEqual(['lama', 'baru']);
  });
});

describe('PICA', () => {
  const pica = (patch: Partial<BarisPica>): BarisPica => ({
    id: 1,
    kode: null, sumber: 'inspeksi', jenis_inspeksi: 'p3k', site: 'Site A',
    objek_nama: 'Kotak P3K', deskripsi: 'Isi habis', tingkat: 'mayor',
    departemen: 'GA', tanggal_dibuat: '2026-11-01', due_date: '2026-11-15',
    tanggal_closed: null, status: 'open', kunci_berulang: 'p3k:kotak p3k',
    ...patch,
  });

  it('overdue hanya bila belum closed dan tenggat lewat', () => {
    expect(picaOverdue(pica({ due_date: '2026-11-14' }), SEKARANG)).toBe(true);
    expect(picaOverdue(pica({ due_date: '2026-11-15' }), SEKARANG)).toBe(false);
    expect(picaOverdue(pica({ due_date: '2026-11-14', status: 'closed' }), SEKARANG)).toBe(false);
    expect(picaOverdue(pica({ due_date: '2026-11-14', status: 'dismissed' }), SEKARANG)).toBe(false);
  });

  it('MTTR hanya dari PICA closed', () => {
    const r = ringkasPica([
      pica({ id: 1, status: 'closed', tanggal_closed: '2026-11-05' }), // 4 hari
      pica({ id: 2, status: 'closed', tanggal_closed: '2026-11-11' }), // 10 hari
      pica({ id: 3, status: 'open' }), // 14 hari berjalan — tidak boleh masuk MTTR
    ], SEKARANG);
    expect(r.mttr).toBe(7);
    expect(r.closed).toBe(2);
    expect(r.aktif).toBe(2 - 1);
  });

  it('distribusi departemen memisahkan aktif, overdue, closed', () => {
    const r = ringkasPica([
      pica({ id: 1, departemen: 'GA', due_date: '2026-11-01' }),
      pica({ id: 2, departemen: 'GA', status: 'closed', tanggal_closed: '2026-11-03' }),
      pica({ id: 3, departemen: 'Logistik', due_date: '2026-11-30' }),
    ], SEKARANG);
    const ga = r.perDepartemen.find(d => d.departemen === 'GA');
    expect(ga).toEqual({ departemen: 'GA', aktif: 1, overdue: 1, closed: 1 });
  });

  it('departemen kosong diberi label, bukan hilang', () => {
    const r = ringkasPica([pica({ departemen: null })], SEKARANG);
    expect(r.perDepartemen[0].departemen).toBe('Belum ditentukan');
  });

  it('temuan berulang hanya objek dengan lebih dari satu PICA', () => {
    const r = ringkasPica([
      pica({ id: 1, kunci_berulang: 'p3k:kotak p3k' }),
      pica({ id: 2, kunci_berulang: 'p3k:kotak p3k' }),
      pica({ id: 3, kunci_berulang: 'p3k:kotak p3k' }),
      pica({ id: 4, kunci_berulang: 'ambulans:aed' }),
    ], SEKARANG);
    expect(r.terulang).toHaveLength(1);
    expect(r.terulang[0].jumlah).toBe(3);
  });

  it('durasi memakai hari ini bila belum closed', () => {
    expect(durasiHari(pica({ tanggal_dibuat: '2026-11-10' }), SEKARANG)).toBe(5);
    expect(durasiHari(pica({ tanggal_dibuat: '2026-11-10', tanggal_closed: '2026-11-12' }), SEKARANG)).toBe(2);
  });

  it('tenggat bawaan mengikuti tingkat', () => {
    expect(tenggatDariTingkat('kritis', SEKARANG)).toBe(tanggalISO(new Date(2026, 10, 18)));
    expect(tenggatDariTingkat('mayor', SEKARANG)).toBe(tanggalISO(new Date(2026, 10, 29)));
    expect(TENGGAT_PICA_HARI.minor).toBe(30);
  });
});

describe('cakupan', () => {
  it('menghitung persen tersampling', () => {
    expect(hitungCakupan(100, 90)).toEqual({ terdaftar: 100, tersampling: 90, persen: 90 });
  });
  it('tanpa aset terdaftar tidak membagi nol', () => {
    expect(hitungCakupan(0, 0).persen).toBe(0);
  });
});

describe('tanggal', () => {
  it('periodeBulan memakai waktu lokal', () => {
    expect(periodeBulan(new Date(2026, 0, 5))).toBe('2026-01');
  });
  it('selisihHari negatif untuk tanggal lewat', () => {
    expect(selisihHari('2026-11-10', SEKARANG)).toBe(-5);
    expect(selisihHari('2026-11-20', SEKARANG)).toBe(5);
    expect(selisihHari(null, SEKARANG)).toBeNull();
  });
});

describe('frekuensi jadwal', () => {
  it('bulanan = satu jadwal di akhir bulan', () => {
    expect(tanggalRencanaPeriode('2026-11', 30)).toEqual(['2026-11-30']);
    expect(tanggalRencanaPeriode('2026-02', 30)).toEqual(['2026-02-28']);
  });

  it('dua mingguan = dua jadwal', () => {
    const t = tanggalRencanaPeriode('2026-11', 14);
    expect(t).toHaveLength(2);
    expect(t[t.length - 1]).toBe('2026-11-30');
  });

  it('mingguan = empat jadwal, semua di bulan yang sama', () => {
    const t = tanggalRencanaPeriode('2026-11', 7);
    expect(t).toHaveLength(4);
    expect(t.every(x => x.startsWith('2026-11'))).toBe(true);
  });

  it('triwulanan hanya jatuh tempo tiap 3 bulan', () => {
    expect(tanggalRencanaPeriode('2026-01', 90)).toEqual(['2026-01-31']);
    expect(tanggalRencanaPeriode('2026-02', 90)).toEqual([]);
    expect(tanggalRencanaPeriode('2026-04', 90)).toEqual(['2026-04-30']);
  });

  it('tahunan hanya bulan Januari', () => {
    expect(tanggalRencanaPeriode('2026-01', 365)).toHaveLength(1);
    expect(tanggalRencanaPeriode('2026-07', 365)).toEqual([]);
  });

  it('frekuensiUntukJenis memakai bawaan bila override tidak valid', () => {
    expect(frekuensiUntukJenis('p3k', undefined)).toBe(FREKUENSI_HARI_BAWAAN.p3k);
    expect(frekuensiUntukJenis('p3k', 7)).toBe(7);
    expect(frekuensiUntukJenis('p3k', 'abc')).toBe(FREKUENSI_HARI_BAWAAN.p3k);
    expect(frekuensiUntukJenis('p3k', -5)).toBe(FREKUENSI_HARI_BAWAAN.p3k);
  });
});

describe('PICA otomatis dari temuan', () => {
  const temuan = (patch: Partial<TemuanMasuk>): TemuanMasuk => ({
    jenis: 'p3k',
    site: 'Site A',
    objek_id: '5',
    objek_nama: 'Kasa steril',
    lokasi: 'Mess Blok 1',
    status: 'rusak',
    catatan: null,
    ...patch,
  });

  it('hanya rusak dan tidak_ada yang jadi PICA', () => {
    expect(layakJadiPica(temuan({ status: 'rusak' }))).toBe(true);
    expect(layakJadiPica(temuan({ status: 'tidak_ada' }))).toBe(true);
    expect(layakJadiPica(temuan({ status: 'ada' }))).toBe(false);
    expect(layakJadiPica(temuan({ status: 'tidak_diperlukan' }))).toBe(false);
  });

  it('barang tidak ada = kritis, rusak = mayor', () => {
    expect(tingkatDariStatus('tidak_ada')).toBe('kritis');
    expect(tingkatDariStatus('rusak')).toBe('mayor');
  });

  it('deskripsi memuat objek, kondisi, dan lokasi', () => {
    expect(deskripsiTemuan(temuan({ status: 'tidak_ada' })))
      .toBe('Kasa steril tidak tersedia di Mess Blok 1');
    expect(deskripsiTemuan(temuan({ status: 'rusak', catatan: 'sobek' })))
      .toBe('Kasa steril dalam kondisi rusak di Mess Blok 1 — sobek');
  });

  it('kunci otomatis stabil dan memuat lokasi', () => {
    expect(kunciPicaOtomatis(temuan({}))).toBe('p3k:5@mess blok 1');
    // Objek sama di lokasi berbeda = temuan berbeda.
    expect(kunciPicaOtomatis(temuan({ lokasi: 'Mess Blok 2' }))).toBe('p3k:5@mess blok 2');
  });
});
