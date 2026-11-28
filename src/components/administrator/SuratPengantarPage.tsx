'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { JOBSITES } from '@/lib/lagging-data';
import { useMCUStore } from '@/lib/store';
import EmployeeLookupInput, { type EmployeeData } from './EmployeeLookupInput';
import {
  DEFAULT_PARAGRAF_FOLLOW_UP,
  DEFAULT_PARAGRAF_MCU,
  JENIS_PENGANTAR_LIST,
  JENIS_PENGANTAR_META,
  STATUS_PENGANTAR_META,
  type JenisPengantar,
  type StatusSuratPengantar,
  type SuratPengantarItem,
} from '@/lib/surat-pengantar';

const SITES = JOBSITES.filter((s) => s !== 'All Site');

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtTanggal(v: string | null | undefined): string {
  if (!v) return '-';
  const d = new Date(`${String(v).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function buildPrintHtml(item: SuratPengantarItem, qrDataUrl: string): string {
  const esc = (s: string | null | undefined) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

  const isFollowUp = item.jenis_pengantar === 'FOLLOW_UP';
  const jenisShort = JENIS_PENGANTAR_META[item.jenis_pengantar]?.short || item.jenis_pengantar;
  const noSurat = item.no_surat || '(DRAFT — BELUM TERBIT)';
  const tglSurat = fmtTanggal(item.qshe_at || item.created_at);
  const qrImgHtml = qrDataUrl
    ? `<img src="${qrDataUrl}" alt="QR Verifikasi" style="width:76px;height:76px;display:block;margin:4px 0;" />`
    : `<div style="width:76px;height:76px;border:1px dashed #999;display:flex;align-items:center;justify-content:center;font-size:8px;margin:4px 0;">QR</div>`;

  if (isFollowUp) {
    return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Tindak Lanjut MCU - ${esc(item.nama)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; font-size: 10.5px; line-height: 1.45; }
    .top-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #111; padding-bottom: 5px; margin-bottom: 0; }
    .top-brand { font-size: 10px; font-weight: 800; letter-spacing: 0.03em; }
    .top-title { font-size: 12px; font-weight: 800; text-transform: uppercase; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; border: 1.5px solid #111; border-top: none; min-height: 172mm; }
    .col-left { padding: 10px 14px; border-right: 1.5px solid #111; display: flex; flex-direction: column; justify-content: space-between; }
    .col-right { padding: 10px 14px; display: flex; flex-direction: column; justify-content: space-between; }
    .col-head { font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: center; margin-bottom: 10px; }
    .meta-table { width: 100%; border-collapse: collapse; margin: 6px 0 8px; font-size: 10px; }
    .meta-table td { padding: 2px 4px; vertical-align: top; }
    .meta-table td.lbl { width: 132px; color: #222; }
    .right-meta { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
    .right-meta td { padding: 2px 4px; vertical-align: top; }
    .lines-section { margin-bottom: 12px; }
    .lines-label { font-weight: 700; font-size: 10.5px; margin-bottom: 6px; }
    .dot-line { border-bottom: 1.2px dotted #333; height: 18px; width: 100%; }
    .chk-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
    .chk-box { border: 1.2px solid #222; padding: 5px 6px; text-align: center; font-style: italic; font-weight: 700; font-size: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; }
    .sq { display: inline-block; width: 11px; height: 11px; border: 1.2px solid #111; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="top-bar">
    <div class="top-brand">PT BAGONG DEKAKA MAKMUR</div>
    <div class="top-title">TINDAK LANJUT HASIL PEMERIKSAAN <i>MEDICAL CHECK UP</i> (MCU)</div>
  </div>

  <div class="two-col">
    <!-- KOLOM KIRI: SURAT RUJUKAN -->
    <div class="col-left">
      <div>
        <div class="col-head">SURAT RUJUKAN</div>
        <div style="margin-bottom:8px;">No. : <b>${esc(noSurat)}</b></div>
        <div style="margin-bottom:10px;">
          Kepada Yth :<br/>
          <b>${esc(item.faskes_tujuan)}</b><br/>
          Di Tempat
        </div>

        <div style="margin-bottom:4px;">Mohon dapat dilakukan pemeriksaan / pengobatan dan tindak lanjut terhadap :</div>
        <table class="meta-table">
          <tr><td class="lbl">No. ID</td><td>: ${esc(item.nik_ktp || item.nik_karyawan)}</td></tr>
          <tr><td class="lbl">Nama</td><td>: <b>${esc(item.nama)}</b>${item.is_calon_karyawan ? ' (Calon Karyawan)' : ''}</td></tr>
          <tr><td class="lbl">Jabatan</td><td>: ${esc(item.jabatan || '-')}</td></tr>
          <tr><td class="lbl">Site</td><td>: ${esc(item.site)}</td></tr>
          <tr><td class="lbl">Temuan MCU</td><td>: <b>${esc(item.parameter_abnormal || '-')}</b></td></tr>
          <tr><td class="lbl">Pemeriksaan Tambahan</td><td>: ${esc(item.catatan_pic || '-')}</td></tr>
          <tr><td class="lbl">Rencana Kunjungan</td><td>: ${esc(fmtTanggal(item.tanggal_rencana))}</td></tr>
        </table>

        <div style="margin-top:8px;">
          Untuk jawaban, mohon dapat melampirkan :
          <ul style="margin:3px 0 6px 16px;padding:0;">
            <li>Terapi dan pemeriksaan ulang/lanjutan hasil temuan MCU</li>
            <li>Bukti Konsultasi/Surat Rekomendasi apabila diijinkan untuk bekerja</li>
          </ul>
        </div>
        <p style="margin:6px 0;">Atas Kerjasamanya kami ucapkan terimakasih</p>
      </div>

      <div style="margin-top:8px;">
        <div>Kepanjen, ${esc(tglSurat)}</div>
        <div>Hormat Kami,</div>
        ${qrImgHtml}
        <div style="font-style:italic;">${esc(item.qshe_by_name ? `QSHE Medic (${item.qshe_by_name})` : 'QSHE Medic Head Office')}</div>
        <div style="font-weight:800;">PT. Bagong Dekaka Makmur</div>
      </div>
    </div>

    <!-- KOLOM KANAN: JAWABAN RUJUKAN -->
    <div class="col-right">
      <div>
        <div class="col-head">JAWABAN RUJUKAN</div>
        <table class="right-meta">
          <tr>
            <td style="width:58px;">No. ID</td><td style="width:42%;">: ${esc(item.nik_ktp || item.nik_karyawan)}</td>
            <td style="width:55px;">Jabatan</td><td>: ${esc(item.jabatan || '-')}</td>
          </tr>
          <tr>
            <td>Nama</td><td>: <b>${esc(item.nama)}</b></td>
            <td>Usia</td><td>: ${item.usia != null ? `${item.usia} Tahun` : '-'}</td>
          </tr>
        </table>

        <div class="lines-section">
          <div class="lines-label">Hasil Pemeriksaan Penunjang :</div>
          <div class="dot-line"></div>
          <div class="dot-line"></div>
          <div class="dot-line"></div>
        </div>

        <div class="lines-section">
          <div class="lines-label">Diagnosa :</div>
          <div class="dot-line"></div>
          <div class="dot-line"></div>
        </div>

        <div class="lines-section">
          <div class="lines-label">Therapy &amp; Rekomendasi Tindak Lanjut :</div>
          <div class="dot-line"></div>
          <div class="dot-line"></div>
          <div class="dot-line"></div>
          <div class="dot-line"></div>
        </div>

        <div>
          <div class="lines-label">Kesimpulan Kelaikan Kerja :</div>
          <div class="chk-row">
            <div class="chk-box"><span class="sq"></span> Fit To Work</div>
            <div class="chk-box"><span class="sq"></span> Fit With Note</div>
            <div class="chk-box"><span class="sq"></span> Unfit</div>
          </div>
        </div>
      </div>

      <div style="margin-top:16px;">
        <div style="margin-bottom:36px;">................................., ................................. 20......</div>
        <div style="border-top:1px dotted #333;width:230px;padding-top:3px;font-style:italic;">
          (Nama dan Stempel Dokter Pemeriksa)
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  const paketText = (item.paket_pemeriksaan || []).length > 0
    ? item.paket_pemeriksaan.join(', ')
    : `Paket ${jenisShort}`;

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>Surat Pengantar MCU - ${esc(item.nama)}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; margin: 0; font-size: 11px; line-height: 1.5; }
    .kop { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #111; padding-bottom: 8px; margin-bottom: 12px; }
    .kop-title { font-size: 15px; font-weight: 800; }
    .kop-sub { font-size: 10px; color: #444; }
    .hdr-table { border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
    .hdr-table td { padding: 1.5px 6px 1.5px 0; vertical-align: top; }
    .hdr-table td.lbl { width: 125px; }
    .mcu-table { width: 100%; border-collapse: collapse; margin: 12px 0 14px; font-size: 10px; }
    .mcu-table th, .mcu-table td { border: 1px solid #222; padding: 6px 5px; text-align: center; vertical-align: middle; }
    .mcu-table th { background: #f3f4f6; font-weight: 700; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="kop">
    <div>
      <div class="kop-title">PT. BAGONG DEKAKA MAKMUR</div>
      <div class="kop-sub">Quality, Safety, Health &amp; Environment (QSHE)</div>
    </div>
    <div style="font-size:10px;color:#444;">www.bagongbis.com</div>
  </div>

  <table class="hdr-table">
    <tr><td class="lbl">Nomor</td><td>: <b>${esc(noSurat)}</b></td></tr>
    <tr><td class="lbl">Tempat / Tanggal</td><td>: Kepanjen, ${esc(tglSurat)}</td></tr>
    <tr><td class="lbl">Perihal</td><td>: Permohonan <i>Medical Check Up</i> Karyawan (${esc(jenisShort)})</td></tr>
  </table>

  <div style="margin-bottom:12px;">
    Kepada Yth,<br/>
    <b>${esc(item.faskes_tujuan)}</b>
  </div>

  <p style="margin:0 0 6px;">Dengan Hormat,</p>
  <p style="margin:0 0 8px;">${esc(item.paragraf_pendukung || DEFAULT_PARAGRAF_MCU)}</p>

  <table class="mcu-table">
    <thead>
      <tr>
        <th style="width:28px;">No</th>
        <th>Tanggal MCU</th>
        <th>NIK</th>
        <th>Nama</th>
        <th>Usia</th>
        <th>Jenis Kelamin</th>
        <th>Posisi</th>
        <th>Jenis Pemeriksaan</th>
        <th>Tambahan Pemeriksaan</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>1</td>
        <td>${esc(fmtTanggal(item.tanggal_rencana))}</td>
        <td>${esc(item.nik_karyawan || item.nik_ktp)}</td>
        <td><b>${esc(item.nama)}</b>${item.is_calon_karyawan ? '<br/>(Calon Karyawan)' : ''}</td>
        <td>${item.usia != null ? esc(String(item.usia)) : '-'}</td>
        <td>${esc(item.jenis_kelamin || '-')}</td>
        <td>${esc(item.jabatan || '-')}</td>
        <td>${esc(paketText)}</td>
        <td>${esc(item.catatan_pic || '-')}</td>
      </tr>
    </tbody>
  </table>

  <p style="margin:0 0 18px;">
    Demikian surat pengantar ini kami sampaikan. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.
  </p>

  <div style="margin-top:16px;">
    <div>Kepanjen, ${esc(tglSurat)}</div>
    <div>Hormat Kami,</div>
    ${qrImgHtml}
    <div style="font-style:italic;">${esc(item.qshe_by_name ? `QSHE Medic (${item.qshe_by_name})` : 'QSHE Medic Head Office')}</div>
    <div style="font-weight:800;">PT. Bagong Dekaka Makmur</div>
  </div>
</body>
</html>`;
}

export default function SuratPengantarPage() {
  const { role, profile, isSuperuser, isHc } = useAuth();
  const isQsheMedic = role === 'administrator' || isSuperuser;
  const canApproveHc = isHc || isSuperuser;
  const canCreate = ['pic', 'hc', 'administrator', 'superuser'].includes(role || '');

  const draftFromReview = useMCUStore((s) => s.suratPengantarDraft);
  const setDraftFromReview = useMCUStore((s) => s.setSuratPengantarDraft);

  const [tab, setTab] = useState<'daftar' | 'ajukan'>('daftar');
  const [items, setItems] = useState<SuratPengantarItem[]>([]);
  const [tabelSiap, setTabelSiap] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [jenisFilter, setJenisFilter] = useState<string>('ALL');

  // Form state
  const [lookupQuery, setLookupQuery] = useState('');
  const [jenis, setJenis] = useState<JenisPengantar>('ANNUAL');
  const [isCalon, setIsCalon] = useState(false);
  const [nikKaryawan, setNikKaryawan] = useState('');
  const [nikKtp, setNikKtp] = useState('');
  const [nama, setNama] = useState('');
  const [jenisKelamin, setJenisKelamin] = useState('');
  const [usia, setUsia] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [departemen, setDepartemen] = useState('');
  const [site, setSite] = useState(role === 'pic' && profile?.site ? profile.site : SITES[0] || 'HEAD OFFICE');
  const [mcuRecordId, setMcuRecordId] = useState<string | null>(null);
  const [tglMcu, setTglMcu] = useState('');
  const [faskes, setFaskes] = useState('');
  const [tanggalRencana, setTanggalRencana] = useState(todayIso());
  const [paketText, setPaketText] = useState(JENIS_PENGANTAR_META.ANNUAL.defaultPaket.join('\n'));
  const [parameterAbnormal, setParameterAbnormal] = useState('');
  const [paragraf, setParagraf] = useState(DEFAULT_PARAGRAF_MCU);
  const [catatanPic, setCatatanPic] = useState('');
  const [saving, setSaving] = useState(false);

  // Approval modal state
  const [approvalTarget, setApprovalTarget] = useState<{
    item: SuratPengantarItem;
    stage: 'hc' | 'qshe';
  } | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [approvalAbnormal, setApprovalAbnormal] = useState('');
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await authFetch('/api/surat-pengantar');
      setItems(Array.isArray(res.data) ? (res.data as SuratPengantarItem[]) : []);
      setTabelSiap(res.tabelSiap !== false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat daftar surat pengantar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Terima draft otomatis dari ReviewMCU saat klik "Ajukan Surat Follow Up"
  useEffect(() => {
    if (!draftFromReview) return;
    setTab('ajukan');
    setJenis(draftFromReview.jenis_pengantar);
    setIsCalon(draftFromReview.is_calon_karyawan);
    setNikKaryawan(draftFromReview.nik_karyawan || '');
    setNikKtp(draftFromReview.nik_ktp || '');
    setNama(draftFromReview.nama || '');
    setJenisKelamin(draftFromReview.jenis_kelamin || '');
    setUsia(draftFromReview.usia || '');
    setJabatan(draftFromReview.jabatan || '');
    setDepartemen(draftFromReview.departemen || '');
    setSite(draftFromReview.site || SITES[0] || 'HEAD OFFICE');
    setMcuRecordId(draftFromReview.mcu_record_id || null);
    setTglMcu(draftFromReview.tgl_mcu || '');
    setFaskes(draftFromReview.faskes_tujuan || '');
    setParameterAbnormal(draftFromReview.parameter_abnormal || '');
    setPaketText(JENIS_PENGANTAR_META[draftFromReview.jenis_pengantar].defaultPaket.join('\n'));
    setParagraf(
      draftFromReview.jenis_pengantar === 'FOLLOW_UP'
        ? DEFAULT_PARAGRAF_FOLLOW_UP
        : DEFAULT_PARAGRAF_MCU,
    );
    setDraftFromReview(null);
  }, [draftFromReview, setDraftFromReview]);

  const handleJenisChange = (next: JenisPengantar) => {
    setJenis(next);
    if (next === 'PRE_EMPLOYMENT') setIsCalon(true);
    setPaketText(JENIS_PENGANTAR_META[next].defaultPaket.join('\n'));
    setParagraf(next === 'FOLLOW_UP' ? DEFAULT_PARAGRAF_FOLLOW_UP : DEFAULT_PARAGRAF_MCU);
  };

  const handleSelectEmployee = (emp: EmployeeData) => {
    setIsCalon(false);
    setNikKaryawan(emp.nik || '');
    setNikKtp(emp.national_id || '');
    setNama(emp.nama || '');
    setJenisKelamin(emp.gender || '');
    setUsia(emp.usia || emp.age || '');
    setJabatan(emp.job_position || '');
    setDepartemen(emp.department || '');
    if (emp.site_name) setSite(emp.site_name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      const paketArr = paketText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await authFetch('/api/surat-pengantar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jenis_pengantar: jenis,
          is_calon_karyawan: isCalon,
          nik_karyawan: nikKaryawan,
          nik_ktp: nikKtp,
          nama,
          jenis_kelamin: jenisKelamin,
          usia: usia ? Number(usia) : null,
          jabatan,
          departemen,
          site,
          mcu_record_id: mcuRecordId,
          tgl_mcu: tglMcu || null,
          faskes_tujuan: faskes,
          tanggal_rencana: tanggalRencana,
          paket_pemeriksaan: paketArr,
          parameter_abnormal: parameterAbnormal,
          paragraf_pendukung: paragraf,
          catatan_pic: catatanPic,
        }),
      });
      setItems((prev) => [res.data as SuratPengantarItem, ...prev]);
      setMsg({ kind: 'ok', text: 'Pengajuan surat pengantar berhasil dikirim ke antrean persetujuan HC.' });
      setTab('daftar');
      setCatatanPic('');
      setParameterAbnormal('');
      setMcuRecordId(null);
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal mengirim pengajuan.' });
    } finally {
      setSaving(false);
    }
  };

  const handleApprovalAction = async (approve: boolean) => {
    if (!approvalTarget) return;
    setApproving(true);
    setMsg(null);
    try {
      const action =
        approvalTarget.stage === 'hc'
          ? approve
            ? 'hc_approve'
            : 'hc_reject'
          : approve
            ? 'qshe_approve'
            : 'qshe_reject';

      const res = await authFetch('/api/surat-pengantar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: approvalTarget.item.id,
          action,
          catatan: approvalNote,
          ...(approvalTarget.stage === 'qshe' && approve
            ? { parameter_abnormal: approvalAbnormal }
            : {}),
        }),
      });
      const updated = res.data as SuratPengantarItem;
      setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      setApprovalTarget(null);
      setApprovalNote('');
      setMsg({
        kind: 'ok',
        text: approve
          ? updated.status === 'DISETUJUI'
            ? `Surat disetujui QSHE Medic & terbit dengan nomor ${updated.no_surat}.`
            : 'Disetujui HC — diteruskan ke QSHE Medic.'
          : 'Pengajuan surat pengantar ditolak.',
      });
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal memproses persetujuan.' });
    } finally {
      setApproving(false);
    }
  };

  const handlePrint = async (item: SuratPengantarItem) => {
    let qrDataUrl = '';
    if (item.verify_sig) {
      const verifyUrl = `${window.location.origin}/verifikasi-surat?id=${encodeURIComponent(item.id)}&sig=${encodeURIComponent(item.verify_sig)}`;
      try {
        qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 160, margin: 1 });
      } catch {
        qrDataUrl = '';
      }
    }
    const win = window.open('', '_blank', 'width=1024,height=760');
    if (!win) {
      setMsg({ kind: 'err', text: 'Popup diblokir browser. Izinkan popup untuk mencetak surat.' });
      return;
    }
    win.document.open();
    win.document.write(buildPrintHtml(item, qrDataUrl));
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 250);
  };

  const counts = useMemo(() => {
    return {
      all: items.length,
      MENUNGGU_HC: items.filter((i) => i.status === 'MENUNGGU_HC').length,
      MENUNGGU_QSHE: items.filter((i) => i.status === 'MENUNGGU_QSHE').length,
      DISETUJUI: items.filter((i) => i.status === 'DISETUJUI').length,
      DITOLAK: items.filter((i) => i.status === 'DITOLAK').length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (statusFilter !== 'ALL' && it.status !== statusFilter) return false;
      if (jenisFilter !== 'ALL' && it.jenis_pengantar !== jenisFilter) return false;
      if (!q) return true;
      return `${it.no_surat || ''} ${it.nama} ${it.nik_karyawan} ${it.nik_ktp} ${it.site} ${it.faskes_tujuan}`
        .toLowerCase()
        .includes(q);
    });
  }, [items, search, statusFilter, jenisFilter]);

  return (
    <div className="admin-form-container">
      <div className="admin-form-inner" style={{ maxWidth: 1120, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
          <div>
            <h1 className="admin-form-title">Surat Pengantar MCU &amp; Follow Up</h1>
            <p className="admin-form-subtitle">
              Pengajuan pengantar Pre-Employment, Annual, Spesifik, Retirement &amp; Follow Up Abnormal MCU — Persetujuan berjenjang PIC → HC → QSHE Medic.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setTab('daftar')}
              className={tab === 'daftar' ? 'admin-form-btn-primary compact-btn' : 'admin-form-btn-secondary compact-btn'}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <ClipboardList size={13} /> Daftar &amp; Approval ({counts.all})
            </button>
            {canCreate && (
              <button
                type="button"
                onClick={() => setTab('ajukan')}
                className={tab === 'ajukan' ? 'admin-form-btn-primary compact-btn' : 'admin-form-btn-secondary compact-btn'}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <Plus size={13} /> Ajukan Surat Pengantar
              </button>
            )}
          </div>
        </div>

        {!tabelSiap && (
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(217,119,6,0.12)', border: '1px solid rgba(217,119,6,0.35)', fontSize: 11.5, color: '#9a6b00' }}>
            Tabel <code>surat_pengantar_mcu</code> belum dibuat di Supabase. Jalankan file SQL migration <code>database/20261128_surat_pengantar_mcu.sql</code> terlebih dahulu.
          </div>
        )}

        {msg && (
          <div
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              fontSize: 11.5,
              fontWeight: 600,
              background: msg.kind === 'ok' ? 'rgba(0,184,148,0.12)' : 'rgba(255,45,45,0.1)',
              border: `1px solid ${msg.kind === 'ok' ? '#00B894' : '#FF2D2D'}`,
              color: msg.kind === 'ok' ? '#00806a' : '#b3261e',
            }}
          >
            {msg.text}
          </div>
        )}

        {error && (
          <div style={{ padding: '9px 12px', borderRadius: 8, background: 'rgba(255,45,45,0.1)', color: '#b3261e', fontSize: 11.5 }}>
            {error}
          </div>
        )}

        {tab === 'ajukan' ? (
          <form onSubmit={handleSubmit} className="admin-form-card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <h2 style={{ fontSize: 13.5, fontWeight: 700, margin: 0 }}>Form Pengajuan Surat Pengantar</h2>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: '4px 10px', borderRadius: 8, background: isCalon ? 'rgba(255,77,0,0.1)' : 'var(--muted)', color: isCalon ? '#FF4D00' : 'var(--foreground)' }}>
                <input
                  type="checkbox"
                  checked={isCalon}
                  onChange={(e) => setIsCalon(e.target.checked)}
                />
                <UserPlus size={13} />
                Calon Karyawan (belum ada di tabel employee)
              </label>
            </div>

            {!isCalon && (
              <div>
                <EmployeeLookupInput
                  value={lookupQuery}
                  onChange={setLookupQuery}
                  onEmployeeFound={handleSelectEmployee}
                  label={<span className="admin-label">Cari Karyawan Tetap (NIK / Nama / KTP)</span>}
                  placeholder="Ketik NIK atau nama karyawan..."
                />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: 10 }}>
              <div>
                <label className="admin-label">Jenis Surat Pengantar *</label>
                <select className="admin-input" value={jenis} onChange={(e) => handleJenisChange(e.target.value as JenisPengantar)}>
                  {JENIS_PENGANTAR_LIST.map((j) => (
                    <option key={j} value={j}>{JENIS_PENGANTAR_META[j].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="admin-label">Site / Batch *</label>
                {isCalon ? (
                  <input
                    type="text"
                    className="admin-input"
                    value={site}
                    onChange={(e) => setSite(e.target.value)}
                    placeholder="mis. HEAD OFFICE atau Batch 35"
                    required
                  />
                ) : (
                  <select className="admin-input" value={site} onChange={(e) => setSite(e.target.value)}>
                    {SITES.map((s) => <option key={s} value={s}>{s}</option>)}
                    {!SITES.includes(site) && site && <option value={site}>{site}</option>}
                  </select>
                )}
              </div>
              <div>
                <label className="admin-label">Tanggal Rencana Pemeriksaan *</label>
                <input type="date" className="admin-input" value={tanggalRencana} onChange={(e) => setTanggalRencana(e.target.value)} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 190px), 1fr))', gap: 10 }}>
              <div>
                <label className="admin-label">Nama Lengkap *</label>
                <input type="text" className="admin-input" value={nama} onChange={(e) => setNama(e.target.value)} required placeholder="Nama sesuai KTP" />
              </div>
              <div>
                <label className="admin-label">NIK KTP (Nasional) {isCalon ? '*' : ''}</label>
                <input type="text" className="admin-input" value={nikKtp} onChange={(e) => setNikKtp(e.target.value)} required={isCalon} placeholder="16 digit NIK KTP" />
              </div>
              {!isCalon && (
                <div>
                  <label className="admin-label">NIK Karyawan</label>
                  <input type="text" className="admin-input" value={nikKaryawan} onChange={(e) => setNikKaryawan(e.target.value)} placeholder="NIK internal" />
                </div>
              )}
              <div>
                <label className="admin-label">Jabatan / Posisi Dilamar</label>
                <input type="text" className="admin-input" value={jabatan} onChange={(e) => setJabatan(e.target.value)} placeholder="mis. Driver / Operator / Mekanik" />
              </div>
              <div>
                <label className="admin-label">Departemen</label>
                <input type="text" className="admin-input" value={departemen} onChange={(e) => setDepartemen(e.target.value)} placeholder="mis. Operasional / Plant" />
              </div>
              <div>
                <label className="admin-label">Jenis Kelamin</label>
                <select className="admin-input" value={jenisKelamin} onChange={(e) => setJenisKelamin(e.target.value)}>
                  <option value="">- Pilih -</option>
                  <option value="Laki - Laki">Laki - Laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>
              <div>
                <label className="admin-label">Usia (Tahun)</label>
                <input type="number" min={17} max={75} className="admin-input" value={usia} onChange={(e) => setUsia(e.target.value)} placeholder="mis. 32" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 10 }}>
              <div>
                <label className="admin-label">Faskes Rekanan Tujuan *</label>
                <input type="text" className="admin-input" value={faskes} onChange={(e) => setFaskes(e.target.value)} required placeholder="mis. RS Hermina / Klinik Mitra Sehat" />
              </div>
              {jenis === 'FOLLOW_UP' && (
                <div>
                  <label className="admin-label">Tanggal MCU Sebelumnya</label>
                  <input type="date" className="admin-input" value={tglMcu} onChange={(e) => setTglMcu(e.target.value)} />
                </div>
              )}
            </div>

            {jenis === 'FOLLOW_UP' ? (
              <div>
                <label className="admin-label">Temuan Nilai Abnormal (Kolom Kiri Surat Follow Up)</label>
                <textarea
                  className="admin-input"
                  style={{ height: 68, padding: '8px 10px' }}
                  value={parameterAbnormal}
                  onChange={(e) => setParameterAbnormal(e.target.value)}
                  placeholder="Contoh: TD : 150/95 mmHg, GDP : 148 mg/dL, Visus Jauh OD : 6/20 OS : 6/15"
                />
              </div>
            ) : (
              <div>
                <label className="admin-label">Paket / Item Pemeriksaan (1 baris per item)</label>
                <textarea
                  className="admin-input"
                  style={{ height: 96, padding: '8px 10px' }}
                  value={paketText}
                  onChange={(e) => setPaketText(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="admin-label">Paragraf Pendukung Surat</label>
              <textarea
                className="admin-input"
                style={{ height: 70, padding: '8px 10px' }}
                value={paragraf}
                onChange={(e) => setParagraf(e.target.value)}
              />
            </div>

            <div>
              <label className="admin-label">Catatan Pengaju (PIC)</label>
              <input type="text" className="admin-input" value={catatanPic} onChange={(e) => setCatatanPic(e.target.value)} placeholder="Catatan tambahan untuk HC / QSHE Medic (opsional)" />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setTab('daftar')} className="admin-form-btn-secondary">
                Batal
              </button>
              <button type="submit" disabled={saving} className="admin-form-btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {saving ? 'Mengirim...' : 'Kirim Pengajuan ke HC'}
              </button>
            </div>
          </form>
        ) : (
          <div className="admin-form-card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Segmented Status Filter */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', maxWidth: '100%', gap: 4, padding: 3, borderRadius: 8, background: 'var(--muted)', border: '1px solid var(--border)' }}>
                {[
                  { key: 'ALL', label: `Semua (${counts.all})` },
                  { key: 'MENUNGGU_HC', label: `Menunggu HC (${counts.MENUNGGU_HC})` },
                  { key: 'MENUNGGU_QSHE', label: `Menunggu QSHE (${counts.MENUNGGU_QSHE})` },
                  { key: 'DISETUJUI', label: `Disetujui (${counts.DISETUJUI})` },
                  { key: 'DITOLAK', label: `Ditolak (${counts.DITOLAK})` },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setStatusFilter(s.key)}
                    style={{
                      border: 'none',
                      borderRadius: 6,
                      padding: '4px 10px',
                      fontSize: 10.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      background: statusFilter === s.key ? 'var(--card)' : 'transparent',
                      color: statusFilter === s.key ? '#FF4D00' : 'var(--muted-foreground)',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => void load()} disabled={loading} className="mcu-dashboard-refresh" style={{ height: 30 }}>
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            {/* Search & Jenis filter */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--background)' }}>
                <Search size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama, no. surat, NIK, site, faskes..."
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 11.5, width: '100%', color: 'var(--foreground)' }}
                />
              </div>
              <select
                value={jenisFilter}
                onChange={(e) => setJenisFilter(e.target.value)}
                className="admin-input"
                style={{ flex: '0 1 210px', minWidth: 140, height: 32 }}
              >
                <option value="ALL">Semua Jenis Pengantar</option>
                {JENIS_PENGANTAR_LIST.map((j) => (
                  <option key={j} value={j}>{JENIS_PENGANTAR_META[j].short}</option>
                ))}
              </select>
            </div>

            {loading ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                <Loader2 className="size-4 animate-spin inline mr-1" /> Memuat daftar pengajuan…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 28, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 12 }}>
                Belum ada pengajuan surat pengantar pada filter ini.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {filtered.map((item) => {
                  const jMeta = JENIS_PENGANTAR_META[item.jenis_pengantar];
                  const sMeta = STATUS_PENGANTAR_META[item.status];
                  const showHcBtn = item.status === 'MENUNGGU_HC' && canApproveHc;
                  const showQsheBtn = item.status === 'MENUNGGU_QSHE' && isQsheMedic;

                  return (
                    <div
                      key={item.id}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        padding: '10px 12px',
                        background: 'var(--background)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: `${jMeta.badgeColor}18`, color: jMeta.badgeColor, border: `1px solid ${jMeta.badgeColor}40` }}>
                            {jMeta.short}
                          </span>
                          {item.is_calon_karyawan && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: '2px 6px', borderRadius: 5, background: 'rgba(255,77,0,0.1)', color: '#FF4D00' }}>
                              Calon Karyawan
                            </span>
                          )}
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: sMeta.bg, color: sMeta.color }}>
                            {sMeta.label}
                          </span>
                          {item.no_surat && (
                            <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--foreground)' }}>
                              {item.no_surat}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
                          Rencana: <b>{fmtTanggal(item.tanggal_rencana)}</b>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ minWidth: 0, flex: '1 1 240px' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--foreground)' }}>
                            {item.nama}
                            <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted-foreground)', marginLeft: 6 }}>
                              ({item.nik_karyawan || item.nik_ktp})
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                            {item.jabatan || '-'} · {item.departemen || '-'} · <b>{item.site}</b> → <b>{item.faskes_tujuan}</b>
                          </div>
                          {item.parameter_abnormal && (
                            <div style={{ fontSize: 10.5, color: '#b91c1c', marginTop: 4, background: 'rgba(239,68,68,0.08)', padding: '4px 8px', borderRadius: 6 }}>
                              <b>Temuan Abnormal:</b> {item.parameter_abnormal}
                            </div>
                          )}
                          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                            <span>Diajukan: <b>{item.created_by_name || '-'}</b></span>
                            {item.hc_status && (
                              <span>HC: <b style={{ color: item.hc_status === 'DISETUJUI' ? '#00806a' : '#FF2D2D' }}>{item.hc_status}</b> ({item.hc_by_name})</span>
                            )}
                            {item.qshe_status && (
                              <span>QSHE: <b style={{ color: item.qshe_status === 'DISETUJUI' ? '#00806a' : '#FF2D2D' }}>{item.qshe_status}</b> ({item.qshe_by_name})</span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {showHcBtn && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setApprovalTarget({ item, stage: 'hc' });
                                setApprovalNote('');
                              }}
                              style={{ height: 30, fontSize: 11, background: '#0284c7', color: '#fff' }}
                            >
                              <FileCheck2 size={13} className="mr-1" /> Proses Persetujuan HC
                            </Button>
                          )}
                          {showQsheBtn && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setApprovalTarget({ item, stage: 'qshe' });
                                setApprovalNote('');
                                setApprovalAbnormal(item.parameter_abnormal || '');
                              }}
                              style={{ height: 30, fontSize: 11, background: '#FF4D00', color: '#fff' }}
                            >
                              <CheckCircle2 size={13} className="mr-1" /> Proses Persetujuan QSHE
                            </Button>
                          )}
                          {item.status === 'DISETUJUI' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handlePrint(item)}
                              style={{ height: 30, fontSize: 11 }}
                            >
                              <Printer size={13} className="mr-1" /> Cetak Surat
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal Approval HC / QSHE Medic */}
        {approvalTarget && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.45)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
            }}
          >
            <div className="admin-form-card" style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>
                  {approvalTarget.stage === 'hc' ? 'Persetujuan HC (Human Capital)' : 'Persetujuan QSHE Medic & Penerbitan Surat'}
                </h3>
                <button type="button" onClick={() => setApprovalTarget(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)' }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--muted-foreground)' }}>
                Subjek: <b style={{ color: 'var(--foreground)' }}>{approvalTarget.item.nama}</b> · {JENIS_PENGANTAR_META[approvalTarget.item.jenis_pengantar].short} · {approvalTarget.item.faskes_tujuan}
              </div>

              {approvalTarget.stage === 'qshe' && approvalTarget.item.jenis_pengantar === 'FOLLOW_UP' && (
                <div>
                  <label className="admin-label">Review / Koreksi Temuan Abnormal (Opsional)</label>
                  <textarea
                    className="admin-input"
                    style={{ height: 68, padding: '8px 10px' }}
                    value={approvalAbnormal}
                    onChange={(e) => setApprovalAbnormal(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="admin-label">Catatan Persetujuan / Alasan Penolakan</label>
                <textarea
                  className="admin-input"
                  style={{ height: 64, padding: '8px 10px' }}
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  placeholder="Wajib diisi jika menolak pengajuan"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={approving}
                  onClick={() => void handleApprovalAction(false)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #FF2D2D', background: 'rgba(255,45,45,0.08)', color: '#FF2D2D', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <XCircle size={13} /> Tolak
                </button>
                <button
                  type="button"
                  disabled={approving}
                  onClick={() => void handleApprovalAction(true)}
                  className="admin-form-btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  {approving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                  {approvalTarget.stage === 'hc' ? 'Setujui & Teruskan ke QSHE' : 'Setujui & Terbitkan Nomor Surat'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
