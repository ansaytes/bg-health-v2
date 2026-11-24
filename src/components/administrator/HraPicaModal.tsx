'use client';

// HraPicaModal.tsx — Ekspor Pengendalian Risiko HRA ke Register PICA
// Standar: BG/QSHE/FORM/069 Rev.001 & FORM-039 (Tindakan Korektif K3)
// Mengonversi rekomendasi mitigasi bahaya residual menjadi tiket PICA

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { authFetch } from '@/lib/api-client';
import { HraHazardEntry, getRiskBg, getRiskColor, getRiskBorder } from '@/lib/hra';
import { useSites } from '@/lib/site-list';
import {
  Send,
  Loader2,
  AlertTriangle,
  ClipboardList,
  CheckCircle2,
  Calendar,
  Building2,
  ShieldAlert,
} from 'lucide-react';

interface HraPicaModalProps {
  entry: HraHazardEntry | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function HraPicaModal({
  entry,
  isOpen,
  onClose,
  onSuccess,
}: HraPicaModalProps) {
  const { sites } = useSites();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [site, setSite] = useState('Head Office');
  const [tingkat, setTingkat] = useState<'major' | 'moderate' | 'minor'>('moderate');
  const [deskripsi, setDeskripsi] = useState('');
  const [tindakan, setTindakan] = useState('');
  const [picNama, setPicNama] = useState('');
  const [picTindakLanjut, setPicTindakLanjut] = useState('');
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (!isOpen || !entry) return;

    setError('');
    const resR = entry.res_r || 0;
    const initialTingkat = resR >= 15 ? 'major' : resR >= 5 ? 'moderate' : 'minor';
    setTingkat(initialTingkat);

    // Default due date berdasarkan tingkat
    const days = initialTingkat === 'major' ? 7 : initialTingkat === 'moderate' ? 14 : 30;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    setDueDate(targetDate.toISOString().slice(0, 10));

    setDeskripsi(
      `[HRA - ${entry.jenis_hazard}] ${entry.jenis_pekerjaan} · Sumber: ${entry.sumber_hazard}. Dampak Kesehatan: ${entry.efek_kesehatan} (Residual Risk: R=${entry.res_r})`
    );
    setTindakan(entry.tindakan_pencegahan || '');
    setPicNama('');
    setPicTindakLanjut('');
  }, [isOpen, entry]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entry) return;

    if (!deskripsi.trim()) {
      setError('Deskripsi temuan wajib diisi');
      return;
    }
    if (!tindakan.trim()) {
      setError('Rencana tindakan perbaikan wajib diisi');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const payload = {
        aksi: 'tambah',
        sumber: 'HRA',
        jenis_pica: 'Pengendalian Bahaya HRA',
        jenis_inspeksi: 'Health Risk Assessment',
        site: site || 'Head Office',
        lokasi: entry.kelompok_beresiko || 'All Area',
        objek_id: entry.id,
        objek_nama: entry.jenis_pekerjaan,
        deskripsi: deskripsi.trim(),
        tingkat,
        departemen: entry.departemen,
        pic_nama: picNama.trim() || null,
        pic_tindak_lanjut: picTindakLanjut.trim() || null,
        tindakan: tindakan.trim(),
        tindakan_pencegahan: entry.tindakan_pencegahan?.trim() || tindakan.trim(),
        due_date: dueDate || null,
      };

      const res = await authFetch<{ success: boolean; error?: string }>('/api/pica', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res && res.success) {
        onSuccess(
          `Tiket PICA berhasil diterbitkan untuk bahaya "${entry.jenis_pekerjaan}" (${entry.jenis_hazard}).`
        );
        onClose();
      } else {
        throw new Error(res?.error || 'Gagal menyimpan tiket PICA');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim tiket PICA');
    } finally {
      setSubmitting(false);
    }
  };

  if (!entry) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: 'rgba(255, 94, 0, 0.12)',
                color: '#FF5E00',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ClipboardList size={20} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Terbitkan Tiket PICA dari Pengendalian HRA
              </DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Meneruskan tindakan mitigasi bahaya residual (FORM/069) ke register Corrective Action K3 (FORM-039)
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Hazard Brief Banner */}
        <div
          className="p-3 rounded-xl border text-xs space-y-1.5"
          style={{
            background: getRiskBg(entry.res_r),
            borderColor: getRiskBorder(entry.res_r),
          }}
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-background text-foreground border border-border">
                {entry.jenis_hazard}
              </span>
              <span className="font-bold text-foreground">{entry.jenis_pekerjaan}</span>
            </div>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{
                background: getRiskColor(entry.res_r),
                color: '#fff',
              }}
            >
              Residual Risk: R={entry.res_r}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
            <div>
              <span className="text-muted-foreground">Departemen: </span>
              <b className="text-foreground">{entry.departemen}</b>
            </div>
            <div>
              <span className="text-muted-foreground">Kelompok Berisiko: </span>
              <b className="text-foreground">{entry.kelompok_beresiko}</b>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-3 text-xs mt-1">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="text-[10.5px] font-semibold text-muted-foreground block mb-1">
                Site / Lokasi Kerja
              </label>
              <select
                value={site}
                onChange={(e) => setSite(e.target.value)}
                className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs"
              >
                <option value="Head Office">Head Office</option>
                {sites.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10.5px] font-semibold text-muted-foreground block mb-1">
                Tingkat Prioritas Temuan
              </label>
              <select
                value={tingkat}
                onChange={(e) => {
                  const val = e.target.value as 'major' | 'moderate' | 'minor';
                  setTingkat(val);
                  const d = val === 'major' ? 7 : val === 'moderate' ? 14 : 30;
                  const dt = new Date();
                  dt.setDate(dt.getDate() + d);
                  setDueDate(dt.toISOString().slice(0, 10));
                }}
                className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-semibold"
              >
                <option value="major">🔴 Major (Tenggat 7 Hari)</option>
                <option value="moderate">🟡 Moderate (Tenggat 14 Hari)</option>
                <option value="minor">🟢 Minor (Tenggat 30 Hari)</option>
              </select>
            </div>

            <div>
              <label className="text-[10.5px] font-semibold text-muted-foreground block mb-1">
                Target Jatuh Tempo (Due Date)
              </label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="h-8 text-xs"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10.5px] font-semibold text-muted-foreground block mb-1">
              Deskripsi Temuan / Deviasi Bahaya HRA
            </label>
            <Textarea
              rows={2}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
              className="text-xs bg-background"
              required
            />
          </div>

          <div>
            <label className="text-[10.5px] font-semibold text-muted-foreground block mb-1">
              Rencana Tindakan Perbaikan (Corrective Action)
            </label>
            <Textarea
              rows={3}
              value={tindakan}
              onChange={(e) => setTindakan(e.target.value)}
              placeholder="Jelaskan langkah pengendalian teknis / administratif / pengadaan sarana..."
              className="text-xs bg-background"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10.5px] font-semibold text-muted-foreground block mb-1">
                PIC Penanggung Jawab
              </label>
              <Input
                value={picNama}
                onChange={(e) => setPicNama(e.target.value)}
                placeholder="mis. Superintendent SHE / Mekanik Lead"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-[10.5px] font-semibold text-muted-foreground block mb-1">
                Catatan Eksekusi Tindak Lanjut
              </label>
              <Input
                value={picTindakLanjut}
                onChange={(e) => setPicTindakLanjut(e.target.value)}
                placeholder="mis. Pengadaan earplug SNR 30 / Modifikasi bantalan getaran"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t mt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-[#ff5e00] hover:bg-[#e05300] text-white font-semibold flex items-center gap-1.5"
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Kirim ke Register PICA
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
