// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { interpretSpirometry, interpretAudiometry } from '@/lib/clinical-classification';
import { sanitizeFilterValue, sanitizeSearchTerm, isSafeHash, safeHash, safeInt } from '@/lib/query-safety';

describe('interpretSpirometry', () => {
  it('menghasilkan "Normal" saat rasio dan FEV1 sehat', () => {
    const hasil = interpretSpirometry({
      fev1Pct: '95', fvcPct: '98', fev1FvcAct: '0,82',
    });
    expect(hasil).toContain('Normal');
    expect(hasil).toContain('FEV1/FVC 82%');
  });

  it('menandai obstruksi saat FEV1/FVC < 70%', () => {
    const hasil = interpretSpirometry({
      fev1Pct: '68', fvcPct: '90', fev1FvcAct: '0,55',
    });
    expect(hasil.toLowerCase()).toContain('obstruksi');
  });

  it('menandai suspek restriksi saat FVC < 80% tetapi rasio normal', () => {
    const hasil = interpretSpirometry({
      fev1Pct: '72', fvcPct: '65', fev1FvcAct: '0,80',
    });
    expect(hasil.toLowerCase()).toContain('restriksi');
  });

  it('kosong bila tidak ada angka spirometri', () => {
    expect(interpretSpirometry({})).toBe('');
  });
});

describe('interpretAudiometry', () => {
  const audiogramNormal = { acr_500: 10, acr_1k: 10, acr_2k: 10, acr_4k: 10, acl_500: 10, acl_1k: 10, acl_2k: 10, acl_4k: 10 };
  const audiogramRingan = { acr_500: 30, acr_1k: 30, acr_2k: 30, acr_4k: 30, acl_500: 30, acl_1k: 30, acl_2k: 30, acl_4k: 30 };
  const audiogramSedang = { acr_500: 45, acr_1k: 45, acr_2k: 45, acr_4k: 45, acl_500: 45, acl_1k: 45, acl_2k: 45, acl_4k: 45 };

  it('normal untuk ambang rendah', () => {
    const hasil = interpretAudiometry(audiogramNormal);
    expect(hasil).toContain('Normal');
  });

  it('ringan untuk PTA 26-40', () => {
    const hasil = interpretAudiometry(audiogramRingan);
    expect(hasil.toLowerCase()).toContain('ringan');
  });

  it('sedang untuk PTA 41-60', () => {
    const hasil = interpretAudiometry(audiogramSedang);
    expect(hasil.toLowerCase()).toContain('sedang');
  });

  it('kosong bila tidak ada audiogram', () => {
    expect(interpretAudiometry({})).toBe('');
  });
});

describe('query-safety', () => {
  it('membuang karakter sintaks PostgREST dari nilai filter', () => {
    const hasil = sanitizeFilterValue('x,role.eq.admin');
    expect(hasil).not.toContain(',');
    expect(hasil).not.toContain('.');
  });

  it('membuang wildcard LIKE', () => {
    const hasil = sanitizeSearchTerm('Budi%_\\');
    expect(hasil).not.toContain('%');
    expect(hasil).not.toContain('_');
  });

  it('sah untuk hash hex 64', () => {
    const hash = 'a'.repeat(64);
    expect(isSafeHash(hash)).toBe(true);
    expect(safeHash(hash)).toBe(hash);
    expect(safeHash('abc')).toBeNull();
    expect(safeHash(null)).toBeNull();
  });

  it('menyandikan nilai numerik tak valid', () => {
    expect(safeInt('abc', 10)).toBe(10);
    expect(safeInt('', 10)).toBe(10);
    expect(safeInt('5', 0, 0, 100)).toBe(5);
    expect(safeInt('999999', 0, 0, 100)).toBe(100);
  });
});
