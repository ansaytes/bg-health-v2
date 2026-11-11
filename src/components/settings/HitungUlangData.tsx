'use client';

import { useState } from 'react';
import { Calculator, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/api-client';

interface Hasil {
  diperiksa: number;
  berubah: number;
  dilewati: number;
  perKolom: Record<string, number>;
  ringkasZona: Record<string, number>;
  tertulis: boolean;
}

type Batch = {
  processed: number; changed: number; dilewatiKarenaSudahFollowUp: number; selesai: boolean;
  offsetBerikutnya: number; perubahanPerKolom: Record<string, number>; ringkasZona: Record<string, number>;
};

const BATCH = 500;
const jumlah = (a: Record<string, number>, b: Record<string, number>) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
};

/**
 * Menghitung ulang kolom turunan MCU (zonasi, trigger, pengendalian, frekuensi,
 * catatan SOP, perlu FU) memakai engine yang sama dengan form Review MCU.
 * Dipakai setelah aturan engine berubah, mis. `perlu_fu` yang kini otomatis.
 * Record yang sudah punya follow up selesai dilewati (nilainya berasal dari
 * dataset efektif, bukan baseline).
 */
export default function HitungUlangData({ canEdit }: { canEdit: boolean }) {
  const [berjalan, setBerjalan] = useState<'cek' | 'terapkan' | null>(null);
  const [hasil, setHasil] = useState<Hasil | null>(null);
  const [error, setError] = useState('');

  async function jalankan(terapkan: boolean) {
    setBerjalan(terapkan ? 'terapkan' : 'cek');
    setError('');
    setHasil(null);
    try {
      const total: Hasil = { diperiksa: 0, berubah: 0, dilewati: 0, perKolom: {}, ringkasZona: {}, tertulis: terapkan };
      for (let offset = 0; ; ) {
        const batch = await authFetch<Batch>(
          `/api/admin/recompute-zonasi?dryRun=${terapkan ? 'false' : 'true'}&limit=${BATCH}&offset=${offset}`,
          { method: 'POST' },
        );
        total.diperiksa += batch.processed;
        total.berubah += batch.changed;
        total.dilewati += batch.dilewatiKarenaSudahFollowUp ?? 0;
        total.perKolom = jumlah(total.perKolom, batch.perubahanPerKolom ?? {});
        total.ringkasZona = jumlah(total.ringkasZona, batch.ringkasZona ?? {});
        if (batch.selesai) break;
        offset = batch.offsetBerikutnya;
        setHasil({ ...total });
      }
      setHasil(total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Perhitungan ulang gagal.');
    } finally {
      setBerjalan(null);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <Calculator className="size-4 text-primary" />
        <h3 className="text-sm font-bold">Hitung Ulang Zonasi &amp; Perlu Follow Up</h3>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Menghitung ulang zonasi, trigger, pengendalian, frekuensi evaluasi, catatan SOP, dan <b>Perlu FU</b> seluruh record MCU
        dengan engine terbaru. Jalankan <b>Cek dampak</b> dulu: tidak ada data yang ditulis. Record yang sudah punya follow up
        selesai dilewati.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={!canEdit || berjalan !== null} onClick={() => void jalankan(false)}>
          {berjalan === 'cek' && <Loader2 className="size-4 animate-spin" />}
          Cek dampak
        </Button>
        <Button
          type="button"
          disabled={!canEdit || berjalan !== null}
          onClick={() => { if (confirm('Tulis hasil perhitungan ulang ke seluruh record MCU?')) void jalankan(true); }}
        >
          {berjalan === 'terapkan' && <Loader2 className="size-4 animate-spin" />}
          Terapkan
        </Button>
      </div>
      {error && <div role="alert" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm break-words">{error}</div>}
      {hasil && (
        <div role="status" className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs leading-relaxed">
          <div>
            <b>{hasil.tertulis ? 'Tertulis' : 'Simulasi (belum ditulis)'}:</b> {hasil.diperiksa} record diperiksa,
            {' '}{hasil.berubah} berubah, {hasil.dilewati} dilewati (sudah ada follow up).
          </div>
          {Object.keys(hasil.perKolom).length > 0 && (
            <div>Perubahan per kolom: {Object.entries(hasil.perKolom).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>
          )}
          {Object.keys(hasil.ringkasZona).length > 0 && (
            <div>Sebaran zona: {Object.entries(hasil.ringkasZona).map(([k, v]) => `${k} ${v}`).join(' · ')}</div>
          )}
        </div>
      )}
    </section>
  );
}
