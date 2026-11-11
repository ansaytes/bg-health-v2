import { describe, it, expect } from 'vitest';
import {
  getFollowUp, parseDate, ringkasFollowUp, tindakLanjutDitutup, type FollowUpRingkas,
} from '@/lib/mcu-monitor';

const tglMcu = parseDate('2026-03-10');
const fu = (extra: Partial<FollowUpRingkas> = {}): FollowUpRingkas => ({
  aktual: '2026-05-01', ke: 1, zona: 'Kuning', arah: 'membaik', sisa: 0, paramedis: false, ...extra,
});

describe('aturan penutupan follow up', () => {
  it('otomatis: zona Hijau dan tidak ada parameter abnormal tersisa', () => {
    expect(tindakLanjutDitutup({ paramedis: false, zona: 'Hijau', sisa: 0 })).toBe(true);
    expect(tindakLanjutDitutup({ paramedis: false, zona: 'hijau', sisa: null })).toBe(true);
  });
  it('belum tutup bila zona belum Hijau atau masih ada parameter abnormal', () => {
    expect(tindakLanjutDitutup({ paramedis: false, zona: 'Kuning', sisa: 0 })).toBe(false);
    expect(tindakLanjutDitutup({ paramedis: false, zona: 'Hijau', sisa: 2 })).toBe(false);
    expect(tindakLanjutDitutup({ paramedis: false, zona: null, sisa: 0 })).toBe(false);
  });
  it('Konfirmasi QSHE Medic menutup apa pun kondisinya', () => {
    expect(tindakLanjutDitutup({ paramedis: true, zona: 'Merah', sisa: 3 })).toBe(true);
  });
});

describe('status follow up Monitoring MCU', () => {
  it('tanpa follow up: perlu_fu otomatis dan kesimpulan vendor Unfit', () => {
    expect(getFollowUp({ kes_vendor: 'Fit To Work', perlu_fu: 'Tidak' }, tglMcu, []).status).toBe('Close: FTW');
    expect(getFollowUp({ kes_vendor: 'Fit With Note', perlu_fu: 'Ya', rek_fu: 'Cek TD' }, tglMcu, []).status).toBe('Open: FU - Cek TD');
    expect(getFollowUp({ kes_vendor: 'Fit With Note', perlu_fu: 'Ya' }, tglMcu, []).status).toBe('Open: FU');
    expect(getFollowUp({ kes_vendor: 'Unfit', perlu_fu: 'Ya' }, tglMcu, []).status).toBe('Close: UNFIT');
    expect(getFollowUp({ kes_vendor: 'Fit', perlu_fu: '' }, tglMcu, []).status).toBe('');
    expect(getFollowUp(null, tglMcu, [fu()])).toEqual({ status: '', kesimpulan: '' });
  });

  it('kolom follow up lama (kesimpulan_fu1-3) tidak lagi dibaca', () => {
    const rec = { kes_vendor: 'Fit With Note', perlu_fu: 'Ya', kesimpulan_fu3: 'Fit To Work', kesimpulan_fu1: 'Unfit' };
    expect(getFollowUp(rec, tglMcu, []).status).toBe('Open: FU');
  });

  it('follow up terbaru: tutup otomatis hanya bila Hijau dan tanpa sisa abnormal', () => {
    const rec = { kes_vendor: 'Fit With Note', perlu_fu: 'Ya' };
    const tutup = getFollowUp(rec, tglMcu, [fu(), fu({ aktual: '2026-07-01', ke: 2, zona: 'Hijau', sisa: 0 })]);
    expect(tutup.status).toBe('Close: FTW');
    expect(tutup.kesimpulan).toContain('FU ke-2');
    expect(tutup.kesimpulan).toContain('Zona Hijau');

    const sisa = getFollowUp(rec, tglMcu, [fu({ zona: 'Hijau', sisa: 2 })]);
    expect(sisa.status).toBe('Open: FU ke-1 - Zona Hijau');
    expect(sisa.kesimpulan).toContain('2 parameter masih abnormal');

    const merah = getFollowUp(rec, tglMcu, [fu({ zona: 'Merah', arah: 'memburuk', sisa: 3 })]);
    expect(merah.status).toBe('Open: FU ke-1 - Zona Merah');
    expect(merah.kesimpulan).toContain('memburuk');
  });

  it('Konfirmasi QSHE Medic menutup walau temuan masih ada, dan tercatat di kesimpulan', () => {
    const r = getFollowUp({ perlu_fu: 'Ya' }, tglMcu, [fu({ zona: 'Kuning', sisa: 2, paramedis: true })]);
    expect(r.status).toBe('Close: FTW');
    expect(r.kesimpulan).toContain('dikonfirmasi QSHE Medic');
  });

  it('urutan ditentukan tanggal aktual, bukan urutan baris', () => {
    const daftar = [fu({ aktual: '2026-07-01', ke: 2, zona: 'Hijau' }), fu({ aktual: '2026-05-01', ke: 1, zona: 'Merah', sisa: 2 })];
    expect(ringkasFollowUp(tglMcu, daftar)?.status).toBe('Close: FTW');
  });

  it('follow up yang lebih tua dari MCU terakhir milik baseline sebelumnya', () => {
    const lama = fu({ aktual: '2026-01-15', zona: 'Hijau' });
    expect(ringkasFollowUp(tglMcu, [lama])).toBeNull();
    expect(getFollowUp({ kes_vendor: 'Unfit' }, tglMcu, [lama]).status).toBe('Close: UNFIT');
  });

  it('zona kosong tetap Open dan tidak menulis "Zona" kosong', () => {
    const r = ringkasFollowUp(tglMcu, [fu({ zona: null, arah: null, ke: null })]);
    expect(r?.status).toBe('Open: FU terakhir');
    expect(r?.kesimpulan).toContain('zona belum dihitung');
  });
});
