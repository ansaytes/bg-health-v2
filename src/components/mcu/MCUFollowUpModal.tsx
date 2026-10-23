'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Plus,
  Calendar,
  MapPin,
  UserCheck,
  FileText,
  Activity,
  CheckCircle2,
  AlertTriangle,
  History,
  TrendingDown,
  TrendingUp,
  Trash2,
} from 'lucide-react';
import { MCU_FIELDS, type MCUFieldDef } from '@/lib/mcu-fields';
import { buildDatasetEfektif, type MCUFollowUp, type DatasetEfektifResult } from '@/lib/mcu-followup';

interface MCUFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  mcuRecord: Record<string, any> | null;
  onSuccess?: () => void;
}

export default function MCUFollowUpModal({
  isOpen,
  onClose,
  mcuRecord,
  onSuccess,
}: MCUFollowUpModalProps) {
  const [followups, setFollowups] = useState<MCUFollowUp[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'history' | 'new'>('history');

  // Form State Kunjungan Baru
  const [kunjunganKe, setKunjunganKe] = useState<number>(1);
  const [tglFu, setTglFu] = useState<string>(new Date().toISOString().split('T')[0]);
  const [lokasiFu, setLokasiFu] = useState<string>('Klinik Site');
  const [dokterPemeriksa, setDokterPemeriksa] = useState<string>('');
  const [selectedParamKeys, setSelectedParamKeys] = useState<string[]>([]);
  const [paramValues, setParamValues] = useState<Record<string, any>>({});
  const [catatan, setCatatan] = useState<string>('');
  const [kesimpulan, setKesimpulan] = useState<string>('Membaik');
  const [rekomendasiBerikutnya, setRekomendasiBerikutnya] = useState<string>('');
  const [linkDokumen, setLinkDokumen] = useState<string>('');

  // Fetch riwayat follow-up
  const fetchFollowups = useCallback(async () => {
    if (!mcuRecord?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/mcu-followup?mcu_record_id=${mcuRecord.id}&with_effective=true`);
      if (res.ok) {
        const data = await res.json();
        const list: MCUFollowUp[] = data.followups || [];
        setFollowups(list);
        setKunjunganKe(list.length + 1);
        if (list.length === 0) {
          setActiveTab('new');
        }
      }
    } catch (err) {
      console.error('Failed to fetch follow-ups:', err);
    } finally {
      setLoading(false);
    }
  }, [mcuRecord?.id]);

  useEffect(() => {
    if (isOpen && mcuRecord) {
      fetchFollowups();
      // Auto-rekomendasi parameter dari baseline yang abnormal
      const recommendedKeys: string[] = [];
      if (mcuRecord.tdS && Number(mcuRecord.tdS) >= 140) recommendedKeys.push('tdS', 'tdD');
      if (mcuRecord.gdp && Number(mcuRecord.gdp) >= 100) recommendedKeys.push('gdp');
      if (mcuRecord.au && Number(mcuRecord.au) >= 7) recommendedKeys.push('au');
      if (mcuRecord.ldl && Number(mcuRecord.ldl) >= 160) recommendedKeys.push('ldl');
      if (mcuRecord.tg && Number(mcuRecord.tg) >= 200) recommendedKeys.push('tg');
      if (mcuRecord.sgpt && Number(mcuRecord.sgpt) > 41) recommendedKeys.push('sgpt');
      setSelectedParamKeys(Array.from(new Set(recommendedKeys)));
      setParamValues({});
    }
  }, [isOpen, mcuRecord, fetchFollowups]);

  // Dataset efektif komputasi live
  const datasetEfektif: DatasetEfektifResult | null = useMemo(() => {
    if (!mcuRecord) return null;
    return buildDatasetEfektif(mcuRecord, followups);
  }, [mcuRecord, followups]);

  const handleAddParamKey = (key: string) => {
    if (!key || selectedParamKeys.includes(key)) return;
    setSelectedParamKeys([...selectedParamKeys, key]);
  };

  const handleRemoveParamKey = (key: string) => {
    setSelectedParamKeys(selectedParamKeys.filter((k) => k !== key));
    const nextVals = { ...paramValues };
    delete nextVals[key];
    setParamValues(nextVals);
  };

  const handleParamValChange = (key: string, val: any) => {
    setParamValues({ ...paramValues, [key]: val });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mcuRecord?.id) return;
    setSaving(true);
    try {
      const payload = {
        mcu_record_id: mcuRecord.id,
        nik_karyawan: mcuRecord.nik_karyawan || mcuRecord.nikKaryawan || 'UNKNOWN',
        kunjungan_ke: kunjunganKe,
        tgl_fu: tglFu,
        lokasi_fu: lokasiFu,
        dokter_pemeriksa: dokterPemeriksa,
        hasil_parameters: paramValues,
        catatan,
        kesimpulan,
        link_dokumen: linkDokumen,
        rekomendasi_berikutnya: rekomendasiBerikutnya,
      };

      const res = await fetch('/api/mcu-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        await fetchFollowups();
        setActiveTab('history');
        if (onSuccess) onSuccess();
      } else {
        const err = await res.json();
        alert(`Gagal menyimpan follow-up: ${err.error || 'Terjadi kesalahan'}`);
      }
    } catch (err: any) {
      alert(`Gagal: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id?: string) => {
    if (!id || !confirm('Yakin ingin menghapus catatan kunjungan follow-up ini?')) return;
    try {
      const res = await fetch(`/api/mcu-followup?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchFollowups();
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (!isOpen || !mcuRecord) return null;

  const baselineZonasi = datasetEfektif?.baselineZonasi?.zona || 'Belum Lengkap';
  const effectiveZonasi = datasetEfektif?.effectiveZonasi?.zona || baselineZonasi;

  const getZonaBadge = (zona: string) => {
    if (zona === 'Merah') return 'bg-rose-500/10 text-rose-500 border-rose-500/30';
    if (zona === 'Kuning') return 'bg-amber-500/10 text-amber-500 border-amber-500/30';
    if (zona === 'Hijau') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30';
    return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900">
          <div>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Activity className="w-5 h-5" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">
                  Tindak Lanjut & Evaluasi MCU (Follow-Up)
                </h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  {mcuRecord.nama || mcuRecord.nama_karyawan || 'Karyawan'} • NIK:{' '}
                  {mcuRecord.nik_karyawan || mcuRecord.nikKaryawan || '-'}
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Zonasi Comparison Bar */}
        <div className="px-6 py-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-xs text-slate-400 block font-medium">Zonasi Baseline</span>
              <span
                className={`inline-flex items-center px-2.5 py-1 mt-1 rounded-full text-xs font-semibold border ${getZonaBadge(
                  baselineZonasi
                )}`}
              >
                Zona {baselineZonasi}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-600">→</span>
              <div>
                <span className="text-xs text-slate-400 block font-medium">
                  Zonasi Efektif (Live)
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-1 mt-1 rounded-full text-xs font-semibold border ${getZonaBadge(
                    effectiveZonasi
                  )}`}
                >
                  Zona {effectiveZonasi}
                </span>
              </div>
            </div>

            {datasetEfektif?.perbaikanZonasi && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
                <TrendingDown className="w-4 h-4" /> Ada Perbaikan Risiko
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Status Kepatuhan:</span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-800 text-cyan-400 border border-cyan-500/20">
              {datasetEfektif?.statusKepatuhan || 'Belum Follow-Up'}
            </span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-900/50">
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'history'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-4" /> Riwayat Kunjungan ({followups.length})
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-medium border-b-2 transition ${
              activeTab === 'new'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-4 h-4" /> Catat Kunjungan Baru
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {activeTab === 'history' ? (
            <div>
              {loading ? (
                <div className="text-center py-12 text-slate-400">Memuat riwayat follow-up...</div>
              ) : followups.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500 mb-3">
                    <History className="w-6 h-6" />
                  </div>
                  <h3 className="text-slate-300 font-semibold">Belum Ada Riwayat Kunjungan</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Karyawan ini belum memiliki catatan follow-up hasil evaluasi medis lanjutan.
                  </p>
                  <button
                    onClick={() => setActiveTab('new')}
                    className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold transition"
                  >
                    Tambah Kunjungan I
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {followups.map((fu) => (
                    <div
                      key={fu.id || fu.kunjungan_ke}
                      className="p-5 rounded-xl bg-slate-850 border border-slate-800 hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="px-2.5 py-1 rounded-md bg-cyan-500/10 text-cyan-400 font-bold text-xs border border-cyan-500/20">
                            Kunjungan ke-{fu.kunjungan_ke}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {fu.tgl_fu || '-'}
                          </span>
                          <span className="flex items-center gap-1.5 text-xs text-slate-400">
                            <MapPin className="w-3.5 h-3.5" />
                            {fu.lokasi_fu || '-'}
                          </span>
                          {fu.dokter_pemeriksa && (
                            <span className="flex items-center gap-1.5 text-xs text-slate-400">
                              <UserCheck className="w-3.5 h-3.5" />
                              {fu.dokter_pemeriksa}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {fu.kesimpulan || 'Selesai'}
                          </span>
                          <button
                            onClick={() => handleDelete(fu.id)}
                            className="p-1.5 rounded text-rose-400 hover:bg-rose-500/10 transition"
                            title="Hapus Kunjungan"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Parameter Nilai Baru */}
                      {fu.hasil_parameters && Object.keys(fu.hasil_parameters).length > 0 && (
                        <div className="mb-3">
                          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
                            Parameter Diperiksa Ulang:
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {Object.entries(fu.hasil_parameters).map(([key, val]) => {
                              const fDef = MCU_FIELDS.find((f) => f.id === key);
                              return (
                                <div
                                  key={key}
                                  className="p-2.5 rounded-lg bg-slate-900 border border-slate-800"
                                >
                                  <span className="text-[11px] text-slate-400 block truncate">
                                    {fDef?.label || key}
                                  </span>
                                  <span className="text-sm font-bold text-white">
                                    {String(val)}{' '}
                                    <span className="text-[10px] text-slate-400 font-normal">
                                      {fDef?.unit || ''}
                                    </span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Catatan & Rekomendasi */}
                      {(fu.catatan || fu.rekomendasi_berikutnya) && (
                        <div className="text-xs text-slate-400 space-y-1 bg-slate-900/50 p-3 rounded-lg border border-slate-800/80">
                          {fu.catatan && (
                            <p>
                              <strong className="text-slate-300">Catatan:</strong> {fu.catatan}
                            </p>
                          )}
                          {fu.rekomendasi_berikutnya && (
                            <p>
                              <strong className="text-slate-300">Rekomendasi Lanjutan:</strong>{' '}
                              {fu.rekomendasi_berikutnya}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Info Kunjungan */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Kunjungan Ke-
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={kunjunganKe}
                    onChange={(e) => setKunjunganKe(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Tanggal Follow-Up
                  </label>
                  <input
                    type="date"
                    value={tglFu}
                    onChange={(e) => setTglFu(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Lokasi Pemeriksaan
                  </label>
                  <input
                    type="text"
                    value={lokasiFu}
                    onChange={(e) => setLokasiFu(e.target.value)}
                    placeholder="misal: Klinik Site, RS Rujukan"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Dokter / Tim Medis Pemeriksa
                </label>
                <input
                  type="text"
                  value={dokterPemeriksa}
                  onChange={(e) => setDokterPemeriksa(e.target.value)}
                  placeholder="Nama dokter pemeriksa atau spesialis"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Pemilihan Parameter Dinamis */}
              <div className="p-4 rounded-xl bg-slate-850 border border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Parameter yang Dinilai Ulang
                    </h4>
                    <p className="text-xs text-slate-400">
                      Nilai parameter ini akan membentuk "Dataset Efektif" dan mengkalkulasi zonasi
                      secara live.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      onChange={(e) => {
                        handleAddParamKey(e.target.value);
                        e.target.value = '';
                      }}
                      className="px-3 py-1.5 bg-slate-900 border border-slate-750 rounded-lg text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">+ Tambah Parameter...</option>
                      {MCU_FIELDS.filter((f) => !f.autoCalc && f.section !== 'identity').map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label} ({f.section})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedParamKeys.length === 0 ? (
                  <div className="p-4 rounded-lg bg-slate-900 text-center text-xs text-slate-500">
                    Belum ada parameter dipilih. Pilih dari menu di atas atau biarkan kosong jika
                    hanya mencatat konsultasi.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {selectedParamKeys.map((key) => {
                      const fDef = MCU_FIELDS.find((f) => f.id === key);
                      if (!fDef) return null;
                      return (
                        <div
                          key={key}
                          className="p-3 rounded-lg bg-slate-900 border border-slate-800 relative group"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-medium text-slate-300 truncate pr-4">
                              {fDef.label}
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveParamKey(key)}
                              className="text-slate-500 hover:text-rose-400 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {fDef.type === 'select' && fDef.options ? (
                            <select
                              value={paramValues[key] || ''}
                              onChange={(e) => handleParamValChange(key, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:border-cyan-500 focus:outline-none"
                            >
                              <option value="">Pilih status...</option>
                              {fDef.options.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="relative">
                              <input
                                type={fDef.type === 'number' ? 'number' : 'text'}
                                step="any"
                                value={paramValues[key] || ''}
                                onChange={(e) => handleParamValChange(key, e.target.value)}
                                placeholder={`Nilai baru (${fDef.unit || '-'})`}
                                className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-white text-xs focus:border-cyan-500 focus:outline-none"
                              />
                              {fDef.unit && (
                                <span className="absolute right-2.5 top-1.5 text-[11px] text-slate-500">
                                  {fDef.unit}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Kesimpulan & Catatan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Kesimpulan Hasil Follow-Up
                  </label>
                  <select
                    value={kesimpulan}
                    onChange={(e) => setKesimpulan(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Normal">Normal / Teratasi</option>
                    <option value="Membaik">Membaik / Terkontrol</option>
                    <option value="Belum Membaik">Belum Terkontrol / Stabil</option>
                    <option value="Perlu Rujukan Lanjutan">Perlu Rujukan Lanjutan (Spesialis)</option>
                    <option value="Fit With Restriction">Fit With Restriction</option>
                    <option value="Currently Unfit">Currently Unfit</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                    Link Bukti Dokumen / Surat Kontrol
                  </label>
                  <input
                    type="url"
                    value={linkDokumen}
                    onChange={(e) => setLinkDokumen(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Catatan Klinis Dokter / Hasil Evaluasi
                </label>
                <textarea
                  rows={2}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Catatan perkembangan medis, keluhan subyektif, respons obat..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Rekomendasi Tindak Lanjut Berikutnya
                </label>
                <textarea
                  rows={2}
                  value={rekomendasiBerikutnya}
                  onChange={(e) => setRekomendasiBerikutnya(e.target.value)}
                  placeholder="Instruksi kepatuhan obat, jadwal kontrol ulang berikutnya, modifikasi kerja..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Hasil Follow-Up'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
