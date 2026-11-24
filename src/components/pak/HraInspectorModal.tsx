'use client';

// HraInspectorModal.tsx — Pemeriksaan Pajanan HRA Terpadu untuk Kasus PAK
// Standar: INK/017 Lampiran 1 & Dokumen BG/QSHE/FORM/069 Rev.001
// Membaca matriks HRA dinamis dari /api/hra sesuai Jabatan/Departemen karyawan

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/api-client';
import {
  HraHazardEntry,
  HraMappingJabatan,
  getRiskBg,
  getRiskColor,
  getRiskBorder,
} from '@/lib/hra';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  FileSearch,
} from 'lucide-react';

interface PakCaseLike {
  id: string;
  id_register: string;
  nama_enc?: string | null;
  jabatan?: string | null;
  department?: string | null;
  sumber_dugaan?: string | null;
  diagnosis_klinis?: string | null;
  diagnosis_okupasi?: string | null;
  hasil_mcu_pemicu?: string | null;
  hra_verified: boolean | null;
  hra_verified_by: string | null;
  hra_verified_tgl: string | null;
}

interface HraInspectorModalProps {
  kasus: PakCaseLike | null;
  isOpen: boolean;
  onClose: () => void;
  onVerify?: () => Promise<void>;
  canWrite?: boolean;
}

export default function HraInspectorModal({
  kasus,
  isOpen,
  onClose,
  onVerify,
  canWrite = false,
}: HraInspectorModalProps) {
  const [loading, setLoading] = useState(false);
  const [hazards, setHazards] = useState<HraHazardEntry[]>([]);
  const [mapping, setMapping] = useState<HraMappingJabatan | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!isOpen || !kasus) return;

    let isMounted = true;
    setLoading(true);

    const jabatan = (kasus.jabatan || '').trim();
    const dept = (kasus.department || '').trim();

    // Query 1: Ambil entri bahaya dari /api/hra
    const qHazard = new URLSearchParams();
    if (jabatan) qHazard.set('search', jabatan);
    else if (dept) qHazard.set('dept', dept);

    const p1 = authFetch<{ success: boolean; data?: HraHazardEntry[] }>(
      `/api/hra?${qHazard.toString()}`
    );

    // Query 2: Ambil pemetaan risiko jabatan
    const p2 = authFetch<{ success: boolean; data?: HraMappingJabatan[] }>(
      '/api/hra?resource=mapping'
    );

    Promise.all([p1, p2])
      .then(([resHazards, resMapping]) => {
        if (!isMounted) return;

        let hzList = Array.isArray(resHazards?.data) ? resHazards.data : [];

        // Bila pencarian spesifik jabatan kosong, fallback ke departemen
        if (hzList.length === 0 && dept) {
          authFetch<{ success: boolean; data?: HraHazardEntry[] }>(
            `/api/hra?dept=${encodeURIComponent(dept)}`
          ).then((fallback) => {
            if (isMounted && fallback?.data) setHazards(fallback.data);
          }).catch(() => {});
        } else {
          setHazards(hzList);
        }

        if (Array.isArray(resMapping?.data)) {
          const jNorm = jabatan.toLowerCase();
          const match = resMapping.data.find(
            (m) =>
              (m.jabatan && jNorm.includes(m.jabatan.toLowerCase())) ||
              (m.jabatan && m.jabatan.toLowerCase().includes(jNorm)) ||
              (m.kelompok_pekerja && m.kelompok_pekerja.toLowerCase().includes(jNorm))
          );
          setMapping(match || null);
        }
      })
      .catch((err) => {
        console.error('[HraInspectorModal] Error loading HRA data:', err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, kasus]);

  // Cek keselarasan kata kunci efek kesehatan dengan diagnosis klinis/okupasi
  const matchedHazards = useMemo(() => {
    if (!kasus) return hazards;
    const diag = `${kasus.diagnosis_klinis || ''} ${kasus.diagnosis_okupasi || ''} ${kasus.hasil_mcu_pemicu || ''}`.toLowerCase();

    return hazards.map((h) => {
      const efek = (h.efek_kesehatan || '').toLowerCase();
      const sumber = (h.sumber_hazard || '').toLowerCase();
      const jns = (h.jenis_hazard || '').toLowerCase();

      let isMatch = false;
      if (diag.includes('nihl') || diag.includes('dengar') || diag.includes('tinitus') || diag.includes('sts')) {
        isMatch = efek.includes('nihl') || efek.includes('dengar') || sumber.includes('bising');
      } else if (diag.includes('lbp') || diag.includes('pinggang') || diag.includes('ergonomi') || diag.includes('tulang')) {
        isMatch = efek.includes('lbp') || efek.includes('kelelahan otot') || jns.includes('ergonomi');
      } else if (diag.includes('paru') || diag.includes('silikosis') || diag.includes('sesak') || diag.includes('asma') || diag.includes('spirometri')) {
        isMatch = efek.includes('paru') || efek.includes('silikosis') || efek.includes('pernafasan') || sumber.includes('debu');
      } else if (diag.includes('kulit') || diag.includes('dermatitis')) {
        isMatch = efek.includes('dermatitis') || efek.includes('kulit') || jns.includes('kimia');
      } else if (diag.includes('sgot') || diag.includes('sgpt') || diag.includes('hati') || diag.includes('kreatinin') || diag.includes('ginjal')) {
        isMatch = jns.includes('kimia') || sumber.includes('solvent') || sumber.includes('panas');
      }
      return { ...h, isKausalitasMatch: isMatch };
    });
  }, [hazards, kasus]);

  const handleConfirmVerify = async () => {
    if (!onVerify) return;
    setVerifying(true);
    try {
      await onVerify();
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setVerifying(false);
    }
  };

  if (!kasus) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'rgba(255, 94, 0, 0.12)',
                  color: '#FF5E00',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileSearch size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Verifikasi Kausalitas Pajanan HRA
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  BG/QSHE/FORM/069 Rev.001 · Rujukan Klarifikasi Pajanan (INK/017 Lampiran 1)
                </p>
              </div>
            </div>

            {kasus.hra_verified ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#34c759]/15 text-[#28a745] border border-[#34c759]/30">
                <ShieldCheck size={13} /> Dokumen HRA Terverifikasi
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#ff9500]/15 text-[#d97706] border border-[#ff9500]/30">
                <AlertTriangle size={13} /> Belum Diverifikasi
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Ringkasan Profil Kasus */}
        <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 space-y-2 text-xs mt-1">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="text-[10px] text-muted-foreground block font-medium">ID Register</span>
              <span className="font-bold text-foreground">{kasus.id_register}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block font-medium">Karyawan</span>
              <span className="font-bold text-foreground">{kasus.nama_enc ?? '-'}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block font-medium">Jabatan</span>
              <span className="font-semibold text-foreground">{kasus.jabatan ?? '-'}</span>
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block font-medium">Departemen</span>
              <span className="font-semibold text-foreground">{kasus.department ?? '-'}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-muted-foreground block font-medium">Diagnosis Kasus</span>
              <span className="text-foreground font-semibold">
                {kasus.diagnosis_okupasi || kasus.diagnosis_klinis || 'Belum diisi'}
              </span>
            </div>
            {kasus.hasil_mcu_pemicu && (
              <div>
                <span className="text-[10px] text-muted-foreground block font-medium">Pemicu MCU / Keluhan</span>
                <span className="text-foreground">{kasus.hasil_mcu_pemicu}</span>
              </div>
            )}
          </div>

          {mapping && (
            <div className="pt-2 border-t border-border/50 flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] text-muted-foreground">
                Kategori Risiko Jabatan (HRA Mapping):
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 10,
                    fontWeight: 700,
                    background: getRiskBg(mapping.nilai_r_tertinggi),
                    color: getRiskColor(mapping.nilai_r_tertinggi),
                    border: `1px solid ${getRiskBorder(mapping.nilai_r_tertinggi)}`,
                  }}
                >
                  {mapping.kategori_risiko} (R Tertinggi = {mapping.nilai_r_tertinggi})
                </span>
                <span className="text-[10.5px] text-muted-foreground">
                  Area: {mapping.lokasi_kerja || 'All'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Daftar Bahaya HRA */}
        <div className="space-y-2 mt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <span>Potensi Bahaya Kesehatan Sesuai Dokumen HRA</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-muted font-semibold">
                {matchedHazards.length}
              </span>
            </h4>
            <span className="text-[10px] text-muted-foreground">
              Filter: Jabatan &amp; Departemen
            </span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-muted-foreground text-xs">
              <Loader2 className="size-4 animate-spin inline mr-1.5" />
              Memuat data bahaya dari matriks HRA...
            </div>
          ) : matchedHazards.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground space-y-1">
              <AlertTriangle className="size-5 text-amber-500 mx-auto" />
              <p className="font-semibold text-foreground">Tidak Ada Catatan Bahaya HRA Langsung</p>
              <p className="text-[11px]">
                Jabatan <i>{kasus.jabatan}</i> belum terdaftar secara spesifik dalam 140 baris HRA.
                Pemeriksaan dapat merujuk pada standar hazard umum departemen <b>{kasus.department}</b>.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {matchedHazards.map((item) => (
                <div
                  key={item.id}
                  className={`p-3 rounded-xl border text-xs transition-all ${
                    (item as any).isKausalitasMatch
                      ? 'border-[#ff5e00] bg-[#ff5e00]/5 ring-1 ring-[#ff5e00]/30'
                      : 'border-border/70 bg-card hover:bg-muted/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                        {item.jenis_hazard}
                      </span>
                      <span className="font-semibold text-foreground text-xs">
                        {item.jenis_pekerjaan}
                      </span>
                      {(item as any).isKausalitasMatch && (
                        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-bold bg-[#ff5e00] text-white flex items-center gap-1 shadow-sm">
                          <CheckCircle2 size={10} /> Kausalitas Selaras
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span
                        className="px-2 py-0.5 rounded-full font-bold"
                        style={{
                          background: getRiskBg(item.init_r),
                          color: getRiskColor(item.init_r),
                          border: `1px solid ${getRiskBorder(item.init_r)}`,
                        }}
                      >
                        Awal: R={item.init_r}
                      </span>
                      <ArrowRight size={10} className="text-muted-foreground" />
                      <span
                        className="px-2 py-0.5 rounded-full font-bold"
                        style={{
                          background: getRiskBg(item.res_r),
                          color: getRiskColor(item.res_r),
                          border: `1px solid ${getRiskBorder(item.res_r)}`,
                        }}
                      >
                        Sisa: R={item.res_r}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/40 text-[11.5px]">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Sumber Bahaya:</span>
                      <span className="text-foreground">{item.sumber_hazard}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Efek Kesehatan:</span>
                      <span className="text-destructive font-medium">{item.efek_kesehatan}</span>
                    </div>
                  </div>

                  {item.tindakan_pencegahan && (
                    <div className="mt-1.5 pt-1.5 border-t border-border/40 text-[11px] text-muted-foreground">
                      <b className="text-foreground font-medium">Pengendalian: </b>
                      {item.tindakan_pencegahan}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Verifikasi Status Info */}
        {kasus.hra_verified && (
          <div className="p-2.5 rounded-lg bg-[#34c759]/10 border border-[#34c759]/30 text-[11px] text-[#1c7430] flex items-center gap-2">
            <CheckCircle2 size={14} className="shrink-0" />
            <span>
              Pajanan telah diverifikasi oleh <b>{kasus.hra_verified_by ?? '-'}</b> pada{' '}
              {kasus.hra_verified_tgl ? new Date(kasus.hra_verified_tgl).toLocaleString('id-ID') : '-'}.
            </span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-between items-center gap-2 pt-3 border-t mt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Tutup
          </Button>

          {canWrite && !kasus.hra_verified && onVerify && (
            <Button
              size="sm"
              onClick={handleConfirmVerify}
              disabled={verifying}
              className="bg-[#ff5e00] hover:bg-[#e05300] text-white font-semibold"
            >
              {verifying ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <ShieldCheck className="size-3.5 mr-1.5" />}
              Konfirmasi Sesuai Dokumen HRA
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Preview ringkas bahaya HRA saat mengetik / memilih Jabatan di form input PAK.
 */
export function HraLiveJabatanPreview({
  jabatan,
  department,
}: {
  jabatan?: string;
  department?: string;
}) {
  const [hazards, setHazards] = useState<HraHazardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = (jabatan || '').trim();
    if (!q) {
      setHazards([]);
      return;
    }

    let active = true;
    setLoading(true);

    const timer = setTimeout(() => {
      authFetch<{ success: boolean; data?: HraHazardEntry[] }>(
        `/api/hra?search=${encodeURIComponent(q)}`
      )
        .then((res) => {
          if (!active) return;
          if (Array.isArray(res?.data) && res.data.length > 0) {
            setHazards(res.data.slice(0, 5));
          } else if (department) {
            authFetch<{ success: boolean; data?: HraHazardEntry[] }>(
              `/api/hra?dept=${encodeURIComponent(department)}`
            ).then((fallback) => {
              if (active && fallback?.data) setHazards(fallback.data.slice(0, 5));
            }).catch(() => {});
          } else {
            setHazards([]);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [jabatan, department]);

  if (!jabatan || (!loading && hazards.length === 0)) return null;

  return (
    <div className="p-2.5 rounded-lg border border-[#ff5e00]/30 bg-[#ff5e00]/5 text-xs space-y-1.5 my-1">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[#d9480f] flex items-center gap-1.5 text-[11px]">
          <FileSearch size={12} /> Referensi Bahaya HRA Jabatan ({jabatan})
        </span>
        {loading && <Loader2 size={11} className="animate-spin text-[#d9480f]" />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {hazards.map((h) => (
          <span
            key={h.id}
            title={`${h.sumber_hazard} ➔ ${h.efek_kesehatan} (R=${h.res_r})`}
            className="px-2 py-0.5 rounded-md text-[10.5px] border bg-background flex items-center gap-1 shadow-xs"
            style={{ borderColor: getRiskBorder(h.res_r) }}
          >
            <b style={{ color: getRiskColor(h.res_r) }}>{h.jenis_hazard}:</b>
            <span className="text-foreground truncate max-w-[180px]">{h.efek_kesehatan}</span>
            <span
              style={{
                fontSize: '9px',
                padding: '1px 4px',
                borderRadius: '4px',
                background: getRiskBg(h.res_r),
                color: getRiskColor(h.res_r),
                fontWeight: 700,
              }}
            >
              R={h.res_r}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

