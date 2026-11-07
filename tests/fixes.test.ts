// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildSpirometryInterpretation, buildAudiometryInterpretation } from '@/lib/mcu-calculations';
import { sanitizeFilterValue, sanitizeSearchTerm, isSafeHash, safeHash, safeInt } from '@/lib/query-safety';

describe('buildSpirometryInterpretation', () => {
  it('menghasilkan "Normal" saat rasio dan FEV1 sehat', () => {
    const hasil = buildSpirometryInterpretation({
      fev1Pct: '95', fvcPct: '98', fev1FvcAct: '0,82',
    });
    expect(hasil).toContain('Normal');
    expect(hasil).toContain('FEV1/FVC 82%');
  });

  it('menandai pola obstruktif saat FEV1/FVC < 70%', () => {
    const hasil = buildSpirometryInterpretation({
      fev1Pct: '68', fvcPct: '90', fev1FvcAct: '0,55',
    });
    expect(hasil.toLowerCase()).toContain('obstruktif');
  });

  it('menandai restriktif saat FVC < 80% tetapi rasio normal', () => {
    const hasil = buildSpirometryInterpretation({
      fev1Pct: '72', fvcPct: '65', fev1FvcAct: '0,80',
    });
    expect(hasil.toLowerCase()).toContain('restriktif');
  });

  it('kosong bila tidak ada angka spirometri', () => {
    expect(buildSpirometryInterpretation({})).toBe('');
  });
});

describe('buildAudiometryInterpretation', () => {
  it('normal untuk PTA rendah', () => {
    const hasil = buildAudiometryInterpretation({ pta: '20' });
    expect(hasil).toContain('Normal');
  });

  it('ringan untuk PTA 26-40', () => {
    const hasil = buildAudiometryInterpretation({ pta: '30' });
    expect(hasil.toLowerCase()).toContain('mild');
  });

  it('berat untuk PTA 41-60', () => {
    const hasil = buildAudiometryInterpretation({ pta: '45' });
    expect(hasil.toLowerCase()).toContain('moderate');
  });

  it('kosong bila PTA kosong', () => {
    expect(buildAudiometryInterpretation({})).toBe('');
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
