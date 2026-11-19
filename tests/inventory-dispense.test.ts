import { describe, expect, it, vi } from 'vitest';
import { parseJenisObat, potongStokResepKunjungan, kembalikanStokKunjungan } from '@/lib/inventory-dispense';

describe('inventory-dispense: parseJenisObat', () => {
  it('parses valid JSON string array of medications', () => {
    const raw = JSON.stringify([
      { nama: 'Paracetamol 500mg', aturan: '3DD1', jumlah: '10', satuan: 'Tablet' },
      { nama: 'Antasida Doen', aturan: '3DD1', jumlah: '6', satuan: 'Tablet' },
    ]);
    const parsed = parseJenisObat(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].nama).toBe('Paracetamol 500mg');
    expect(parsed[0].jumlah).toBe('10');
  });

  it('handles array input directly', () => {
    const input = [{ nama: 'Amoxicillin 500mg', jumlah: 15 }];
    const parsed = parseJenisObat(input);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].nama).toBe('Amoxicillin 500mg');
  });

  it('returns empty array on invalid or empty input', () => {
    expect(parseJenisObat(null)).toEqual([]);
    expect(parseJenisObat('')).toEqual([]);
    expect(parseJenisObat('not a json')).toEqual([]);
    expect(parseJenisObat({})).toEqual([]);
  });
});

describe('inventory-dispense: potongStokResepKunjungan (FEFO logic)', () => {
  it('deducts stock from batches with earliest expiry date first (FEFO)', async () => {
    // Mock Supabase client
    const batches = [
      { id: 'b1', sisa_stok: 5, tanggal_expired: '2026-12-01' }, // expired sooner
      { id: 'b2', sisa_stok: 10, tanggal_expired: '2027-06-01' }, // expired later
    ];

    const mockItem = { id: 'item-1', name: 'Paracetamol 500mg', stock: 15 };

    const updateCalls: Array<{ table: string; payload: Record<string, unknown>; id?: string }> = [];
    const insertCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'inventory_items') {
          return {
            select: vi.fn(() => ({
              ilike: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockItem, error: null }),
              })),
            })),
            update: vi.fn((payload) => ({
              eq: vi.fn((_, id) => {
                updateCalls.push({ table, payload, id });
                return Promise.resolve({ error: null });
              }),
            })),
          };
        }
        if (table === 'inventory_batches') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gt: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({ data: batches, error: null }),
                })),
              })),
            })),
            update: vi.fn((payload) => ({
              eq: vi.fn((_, id) => {
                updateCalls.push({ table, payload, id });
                return Promise.resolve({ error: null });
              }),
            })),
          };
        }
        if (table === 'inventory_transactions') {
          return {
            insert: vi.fn((payload) => {
              insertCalls.push({ table, payload });
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {};
      }),
    } as unknown as Parameters<typeof potongStokResepKunjungan>[0];

    const res = await potongStokResepKunjungan(
      mockClient,
      'kunjungan-123',
      'Budi Santoso',
      JSON.stringify([{ nama: 'Paracetamol 500mg', jumlah: 8, satuan: 'Tablet' }])
    );

    expect(res.berhasil).toBe(true);
    expect(res.itemDipotong).toHaveLength(1);
    expect(res.itemDipotong[0].jumlahDiminta).toBe(8);
    expect(res.itemDipotong[0].jumlahDipotong).toBe(8);
    expect(res.itemDipotong[0].stokCukup).toBe(true);

    // Batch 1 (stok 5) must be emptied (0), Batch 2 (stok 10) must be deducted by 3 (sisa 7)
    const batchUpdates = updateCalls.filter((u) => u.table === 'inventory_batches');
    expect(batchUpdates).toHaveLength(2);
    expect(batchUpdates[0]).toEqual({ table: 'inventory_batches', payload: { sisa_stok: 0 }, id: 'b1' });
    expect(batchUpdates[1]).toEqual({ table: 'inventory_batches', payload: { sisa_stok: 7 }, id: 'b2' });

    // Master stock updated to 15 - 8 = 7
    const itemUpdates = updateCalls.filter((u) => u.table === 'inventory_items');
    expect(itemUpdates).toHaveLength(1);
    expect(itemUpdates[0]).toEqual({ table: 'inventory_items', payload: { stock: 7 }, id: 'item-1' });

    // Transaction OUT recorded
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].table).toBe('inventory_transactions');
    expect(insertCalls[0].payload).toMatchObject({
      item_id: 'item-1',
      transaction_type: 'OUT',
      quantity: 8,
      reference_id: 'kunjungan-123',
    });
  });

  it('records notes when item is not found in inventory master', async () => {
    const mockClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          ilike: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    } as unknown as Parameters<typeof potongStokResepKunjungan>[0];

    const res = await potongStokResepKunjungan(
      mockClient,
      'kunjungan-456',
      'Ahmad',
      JSON.stringify([{ nama: 'Obat Tidak Ada', jumlah: 5 }])
    );

    expect(res.catatan).toContain('Obat "Obat Tidak Ada" tidak ditemukan di master inventory.');
    expect(res.itemDipotong).toHaveLength(0);
  });
});

describe('inventory-dispense: kembalikanStokKunjungan', () => {
  it('restores stock when a visit is deleted', async () => {
    const mockTxs = [
      { id: 'tx-1', item_id: 'item-1', quantity: 8 },
    ];
    const updateCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const insertCalls: Array<{ table: string; payload: Record<string, unknown> }> = [];

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'inventory_transactions') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ data: mockTxs, error: null }),
              })),
            })),
            insert: vi.fn((payload) => {
              insertCalls.push({ table, payload });
              return Promise.resolve({ error: null });
            }),
          };
        }
        if (table === 'inventory_batches') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'batch-9', sisa_stok: 12 } }),
                  })),
                })),
              })),
            })),
            update: vi.fn((payload) => ({
              eq: vi.fn(() => {
                updateCalls.push({ table, payload });
                return Promise.resolve({ error: null });
              }),
            })),
          };
        }
        if (table === 'inventory_items') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { stock: 12 } }),
              })),
            })),
            update: vi.fn((payload) => ({
              eq: vi.fn(() => {
                updateCalls.push({ table, payload });
                return Promise.resolve({ error: null });
              }),
            })),
          };
        }
        return {};
      }),
    } as unknown as Parameters<typeof kembalikanStokKunjungan>[0];

    const res = await kembalikanStokKunjungan(mockClient, 'kunjungan-123');
    expect(res.dikembalikan).toBe(8);

    // Check transaction IN was logged
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0].payload).toMatchObject({
      transaction_type: 'IN',
      quantity: 8,
      reference_id: 'kunjungan-123',
    });
  });
});
