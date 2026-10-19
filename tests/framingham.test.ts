import { describe, it, expect } from 'vitest';
import { calcFramingham } from '@/lib/zonasi-engine';

/**
 * Golden tests for calcFramingham. Each expectation is the mathematically
 * correct score/probability per the Framingham point tables; prob strings
 * must contain exactly ONE percent sign.
 */
function input(overrides: Record<string, string | number> = {}) {
  return {
    usia: 50, chol: 200, hdl: 45, tdS: 130, jenisKelamin: 'Laki - Laki',
    merokok: 'Tidak', diabetes: 'Tidak', ...overrides,
  };
}

const base = { score: 0, prob: 'Cek Parameter', kat: 'Cek Parameter' };

describe('calcFramingham', () => {
  it('returns Cek Parameter when required inputs are missing', () => {
    expect(calcFramingham({})).toEqual(base);
    expect(calcFramingham(input({ usia: undefined as unknown as number }))).toEqual(base);
    expect(calcFramingham(input({ chol: undefined as unknown as number }))).toEqual(base);
    expect(calcFramingham(input({ hdl: undefined as unknown as number }))).toEqual(base);
    expect(calcFramingham(input({ tdS: undefined as unknown as number }))).toEqual(base);
    expect(calcFramingham(input({ jenisKelamin: '' }))).toEqual(base);
  });

  // ── Age brackets ──────────────────────────────────────────────
  it('male age brackets: 34 low, 50 mid, 74 high', () => {
    expect(calcFramingham(input({ usia: 34 })).score).toBe(0);
    expect(calcFramingham(input()).score).toBe(11);
    expect(calcFramingham(input({ usia: 74 })).score).toBe(14);
  });

  it('female age brackets differ from male (50 → 13, not 11)', () => {
    expect(calcFramingham(input({ jenisKelamin: 'Perempuan' })).score).toBe(13);
  });

  // ── Cholesterol bands ─────────────────────────────────────────
  it('male age 45 cholesterol bands (<160, <200, <240, <280, ≥280)', () => {
    expect(calcFramingham(input({ usia: 45, chol: 159 })).score).toBe(5);
    expect(calcFramingham(input({ usia: 45, chol: 199 })).score).toBe(8);
    expect(calcFramingham(input({ usia: 45, chol: 239 })).score).toBe(10);
    expect(calcFramingham(input({ usia: 45, chol: 279 })).score).toBe(11);
    expect(calcFramingham(input({ usia: 45, chol: 280 })).score).toBe(13);
  });

  it('female age 35 cholesterol bands (<160, <200, <240, <280, ≥280)', () => {
    expect(calcFramingham(input({ jenisKelamin: 'Perempuan', usia: 35, chol: 159 })).score).toBe(0);
    expect(calcFramingham(input({ jenisKelamin: 'Perempuan', usia: 35, chol: 199 })).score).toBe(4);
    expect(calcFramingham(input({ jenisKelamin: 'Perempuan', usia: 35, chol: 239 })).score).toBe(8);
    expect(calcFramingham(input({ jenisKelamin: 'Perempuan', usia: 35, chol: 279 })).score).toBe(11);
    expect(calcFramingham(input({ jenisKelamin: 'Perempuan', usia: 35, chol: 280 })).score).toBe(13);
  });

  // ── HDL bands ─────────────────────────────────────────────────
  it('HDL bands: ≥60→-1, 50–59→0, 40–49→+1, <40→+2', () => {
    expect(calcFramingham(input({ hdl: 60 })).score).toBe(9);
    expect(calcFramingham(input({ hdl: 50 })).score).toBe(10);
    expect(calcFramingham(input({ hdl: 40 })).score).toBe(11);
    expect(calcFramingham(input({ hdl: 39 })).score).toBe(12);
  });

  // ── SBP bands ─────────────────────────────────────────────────
  it('male SBP bands: <140→+1, 140-159→+1, ≥160→+2', () => {
    expect(calcFramingham(input({ tdS: 139 })).score).toBe(11);
    expect(calcFramingham(input({ tdS: 140 })).score).toBe(11);
    expect(calcFramingham(input({ tdS: 160 })).score).toBe(12);
  });

  it('female SBP bands: <130→+1, 130-139→+2, 140-159→+3, ≥160→+4', () => {
    expect(calcFramingham(input({ jenisKelamin: 'Perempuan', tdS: 129 })).score).toBe(12);
    expect(calcFramingham(input({ jenisKelamin: 'Perempuan', tdS: 130 })).score).toBe(13);
    expect(calcFramingham(input({ jenisKelamin: 'Perempuan', tdS: 140 })).score).toBe(14);
    expect(calcFramingham(input({ jenisKelamin: 'Perempuan', tdS: 160 })).score).toBe(15);
  });

  // ── Smoking ───────────────────────────────────────────────────
  it('smoking points differ by gender and age', () => {
    expect(calcFramingham(input({ merokok: 'Ya' })).score).toBe(14);          // male 50 → +3
    expect(calcFramingham(input({ jenisKelamin: 'Perempuan', merokok: 'Ya' })).score).toBe(17); // female → +4
    expect(calcFramingham(input({ usia: 70, merokok: 'Ya' })).score).toBe(15); // male 70 → +1
  });

  // ── Diabetes ──────────────────────────────────────────────────
  it('diabetes adds +3 male, +5 female', () => {
    expect(calcFramingham(input({ diabetes: 'Ya' })).score).toBe(14);
    expect(calcFramingham(input({ jenisKelamin: 'Perempuan', diabetes: 'Ya' })).score).toBe(18);
  });

  // ── Probability mapping ───────────────────────────────────────
  it('maps very high male score to ≥30% High Risk', () => {
    const r = calcFramingham(input({ diabetes: 'Ya', merokok: 'Ya', tdS: 160, hdl: 35, chol: 280, usia: 60 }));
    expect(r.score).toBe(21);
    expect(r.prob).toBe('≥30%');
    expect(r.kat).toBe('High Risk');
  });

  it('maps negative female score to <1% Low Risk', () => {
    const r = calcFramingham(input({ jenisKelamin: 'Perempuan', usia: 30, chol: 150 }));
    expect(r.score).toBe(-4);
    expect(r.prob).toBe('<1%');
    expect(r.kat).toBe('Low Risk');
  });

  it('maps intermediate male score 14 to 16% Intermediate Risk', () => {
    const r = calcFramingham(input({ usia: 55, chol: 260, tdS: 150 }));
    expect(r.score).toBe(14);
    expect(r.prob).toBe('16%');
    expect(r.kat).toBe('Intermediate Risk');
  });

  it('female probability table: score 9 → 1% Low Risk', () => {
    const r = calcFramingham(input({ jenisKelamin: 'Perempuan', usia: 44, chol: 220, tdS: 135, hdl: 45 }));
    expect(r.score).toBe(9);
    expect(r.prob).toBe('1%');
    expect(r.kat).toBe('Low Risk');
  });

  it('male probability table: score 12 → 10% Intermediate Risk', () => {
    const r = calcFramingham(input({ hdl: 39 }));
    expect(r.score).toBe(12);
    expect(r.prob).toBe('10%');
    expect(r.kat).toBe('Intermediate Risk');
  });

  it('prob strings contain exactly one percent sign', () => {
    for (const o of [{}, { jenisKelamin: 'Perempuan' }, { usia: 74 }, { merokok: 'Ya' }] as Record<string, string | number>[]) {
      const prob = calcFramingham(input(o)).prob;
      expect(prob).not.toContain('%%');
      expect((prob.match(/%/g) ?? []).length).toBe(1);
    }
  });
});
