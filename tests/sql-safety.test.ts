import { describe, it, expect } from 'vitest';
import {
  assertIdentifier,
  containsSqlInjection,
  escapeLikePattern,
  inHexList,
  looksLikeSqlInjection,
  orContains,
  orEq,
  postgrestQuote,
  sanitizeSearchTerm,
} from '@/lib/sql-safety';

describe('filter PostgREST', () => {
  it('kutip ganda di nilai tidak bisa keluar dari kutipnya', () => {
    const condition = orEq('nik', 'x",role.eq."superuser');
    expect(condition).toBe('nik.eq."x\\",role.eq.\\"superuser"');
  });
  it('postgrestQuote meng-escape backslash', () => {
    expect(postgrestQuote('a\\b')).toBe('"a\\\\b"');
  });
  it('kata pencarian dibersihkan dari koma, kurung, dan wildcard', () => {
    expect(sanitizeSearchTerm('budi),role.eq.admin,(x%_')).toBe('budirole.eq.adminx');
    expect(orContains('nama', '%%%')).toBeNull();
  });
  it('wildcard LIKE di-escape', () => {
    expect(escapeLikePattern('100%_')).toBe('100\\%\\_');
  });
  it('identifier dinamis hanya huruf/angka/underscore', () => {
    expect(assertIdentifier('nik_karyawan')).toBe('nik_karyawan');
    expect(() => assertIdentifier('nik; drop table x')).toThrow();
    expect(() => assertIdentifier('a.b')).toThrow();
  });
  it('daftar IN hanya menerima digest hex', () => {
    expect(inHexList('h', ['abcdef0123456789abcdef0123456789', '1),(x'])).toBe('h.in.(abcdef0123456789abcdef0123456789)');
  });
});

describe('detektor pola serangan', () => {
  it.each([
    "' OR 1=1 --",
    "1' OR '1'='1",
    "x'; DROP TABLE employees;--",
    'a UNION SELECT password FROM auth.users',
    'x%27%20OR%201=1',
    '1; select pg_sleep(5)',
    'budi",role.eq."superuser',
  ])('mendeteksi: %s', (payload) => {
    expect(looksLikeSqlInjection(payload)).toBe(true);
  });

  it.each([
    "O'Brien",
    'PT Bagong Dekaka Makmur',
    'Jl. Raya Malang No. 5, Lowokwaru',
    'Kebiasaan merokok dan alkohol; tidak ada keluhan',
    'Select Dental Clinic',
    'HbA1c 6,2 % (DM terkontrol)',
  ])('tidak menandai teks klinis biasa: %s', (text) => {
    expect(looksLikeSqlInjection(text)).toBe(false);
  });

  it('memeriksa objek bersarang', () => {
    expect(containsSqlInjection({ a: { b: ["x' OR 1=1 --"] } })).toBe(true);
    expect(containsSqlInjection({ nama: 'Budi', catatan: 'sehat' })).toBe(false);
  });
});
