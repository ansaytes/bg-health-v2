'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';

interface VerifiedDoc {
  no_surat: string;
  jenis_label: string;
  is_calon_karyawan: boolean;
  nama_masked: string;
  site: string;
  faskes_tujuan: string;
  tanggal_rencana: string;
  hc_by_name: string | null;
  hc_at: string | null;
  qshe_by_name: string | null;
  qshe_at: string | null;
  sig_digest: string;
}

function fmtTanggal(v: string | null | undefined): string {
  if (!v) return '-';
  const d = new Date(v.length === 10 ? `${v}T00:00:00` : v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
}

function VerifikasiContent() {
  const params = useSearchParams();
  const id = params.get('id') || '';
  const sig = params.get('sig') || '';

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<VerifiedDoc | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!id || !sig) {
        setError('Parameter verifikasi tidak lengkap.');
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/verifikasi-surat?id=${encodeURIComponent(id)}&sig=${encodeURIComponent(sig)}`,
          { cache: 'no-store' },
        );
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok || !json.valid) {
          setError(json.error || 'Dokumen tidak valid.');
        } else {
          setDoc(json.document as VerifiedDoc);
        }
      } catch {
        if (!cancelled) setError('Gagal menghubungi server verifikasi.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [id, sig]);

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--background, #ececec)',
        color: 'var(--foreground, #1a1a1a)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--card, #ffffff)',
          border: '1px solid var(--border, #d8d8d8)',
          borderRadius: 16,
          padding: '22px 20px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
        }}
      >
        <div style={{ borderBottom: '1px solid var(--border, #e5e7eb)', paddingBottom: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: '#FF4D00', textTransform: 'uppercase' }}>
            PT Bagong Dekaka Makmur
          </div>
          <h1 style={{ fontSize: 17, fontWeight: 800, margin: '2px 0 0' }}>
            Verifikasi Tanda Tangan Digital Surat Pengantar
          </h1>
        </div>

        {loading ? (
          <div style={{ padding: '28px 0', textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)' }}>
            <Loader2 className="size-6 animate-spin inline mb-2" style={{ color: '#FF4D00' }} />
            <div>Memverifikasi keaslian dokumen…</div>
          </div>
        ) : error || !doc ? (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: 'rgba(255,45,45,0.08)',
              border: '1px solid rgba(255,45,45,0.35)',
              color: '#b91c1c',
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
            }}
          >
            <ShieldAlert size={24} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>DOKUMEN TIDAK VALID</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{error || 'Dokumen tidak ditemukan.'}</div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(0,184,148,0.1)',
                border: '1px solid rgba(0,184,148,0.35)',
                color: '#007a63',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <ShieldCheck size={24} style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>DOKUMEN SAH &amp; TERVERIFIKASI</div>
                <div style={{ fontSize: 11 }}>Digest Verifikasi: <b>{doc.sig_digest}</b></div>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 8, fontSize: 12.5 }}>
              <Row label="Nomor Surat" value={doc.no_surat} bold />
              <Row label="Jenis Pengantar" value={doc.jenis_label} />
              <Row
                label="Nama Pasien"
                value={`${doc.nama_masked}${doc.is_calon_karyawan ? ' (Calon Karyawan)' : ''}`}
              />
              <Row label="Site / Batch" value={doc.site} />
              <Row label="Faskes Tujuan" value={doc.faskes_tujuan} />
              <Row label="Rencana Periksa" value={fmtTanggal(doc.tanggal_rencana)} />
              <Row
                label="Disetujui HC"
                value={doc.hc_by_name ? `${doc.hc_by_name} (${fmtTanggal(doc.hc_at)})` : '-'}
              />
              <Row
                label="Disetujui QSHE Medic"
                value={doc.qshe_by_name ? `${doc.qshe_by_name} (${fmtTanggal(doc.qshe_at)})` : '-'}
                icon={<CheckCircle2 size={14} style={{ color: '#00806a' }} />}
              />
            </div>

            <p style={{ fontSize: 10.5, color: 'var(--muted-foreground)', margin: '4px 0 0', lineHeight: 1.45 }}>
              Demi privasi medis, nama ditampilkan tersamar dan hasil pemeriksaan tidak ditampilkan di halaman verifikasi publik ini.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function Row({ label, value, bold, icon }: { label: string; value: string; bold?: boolean; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', borderBottom: '1px dashed var(--border, #e5e7eb)' }}>
      <span style={{ color: 'var(--muted-foreground, #666)', fontSize: 11.5 }}>{label}</span>
      <span style={{ fontWeight: bold ? 800 : 600, textAlign: 'right', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {icon}
        {value}
      </span>
    </div>
  );
}

export default function VerifikasiSuratPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>
          Memuat verifikasi…
        </div>
      }
    >
      <VerifikasiContent />
    </Suspense>
  );
}
