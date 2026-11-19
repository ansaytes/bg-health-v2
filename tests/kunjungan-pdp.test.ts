import { beforeAll, describe, expect, it } from 'vitest';
import {
  isDiagnosaSensitif,
  proteksiDiagnosaUntukRole,
  maskNamaPasien,
  getKunjunganNikHash,
} from '@/lib/kunjungan-pdp';

describe('kunjungan-pdp: Data Protection & Privacy', () => {
  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });
  it('identifies sensitive medical diagnoses', () => {
    expect(isDiagnosaSensitif('Suspek TBC Paru')).toBe(true);
    expect(isDiagnosaSensitif('Skizofrenia paranoid')).toBe(true);
    expect(isDiagnosaSensitif('HIV Stadium II')).toBe(true);
    expect(isDiagnosaSensitif('Hemoroid Eksterna')).toBe(true);
    expect(isDiagnosaSensitif('Common Cold')).toBe(false);
    expect(isDiagnosaSensitif('Faringitis Akut')).toBe(false);
  });

  it('allows full clinical access for medical roles', () => {
    const diag = 'Suspek TBC Paru';
    expect(proteksiDiagnosaUntukRole(diag, 'administrator')).toBe(diag);
    expect(proteksiDiagnosaUntukRole(diag, 'superuser')).toBe(diag);
    expect(proteksiDiagnosaUntukRole(diag, 'pic')).toBe(diag);
  });

  it('masks sensitive diagnoses for managerial/non-medical roles (UU PDP)', () => {
    const sensitiveDiag = 'Kunjungan kontrol HIV';
    expect(proteksiDiagnosaUntukRole(sensitiveDiag, 'manager')).toBe(
      '[Diagnosa Terproteksi Medis — Kerahasiaan UU PDP]'
    );

    // Non-sensitive diagnosis remains visible to manager
    const normalDiag = 'Gastritis Akut';
    expect(proteksiDiagnosaUntukRole(normalDiag, 'manager')).toBe(normalDiag);
  });

  it('masks employee name cleanly for external or aggregate views', () => {
    expect(maskNamaPasien('Budi Santoso')).toBe('B*** S******');
    expect(maskNamaPasien('Ahmad')).toBe('A****');
    expect(maskNamaPasien('')).toBe('—');
  });

  it('generates consistent NIK hashes', () => {
    const h1 = getKunjunganNikHash('230802778');
    const h2 = getKunjunganNikHash('230802778');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(64);
    expect(getKunjunganNikHash('')).toBeNull();
  });
});
