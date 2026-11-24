'use client';

// HraPrintModal.tsx — Dokumen Cetak Resmi FORM/069 Rev.001
// PT. BAGONG DEKAKA MAKMUR — HEALTH HAZARD RISK ASSESSMENT (HRA)
// Layout A4 Landscape standar audit SMKP, ISO 45001, & Minerba

import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  HraHazardEntry,
  DEPARTEMEN_LIST,
  HRA_RULES,
  PAPARAN_LABELS,
  EFEK_LABELS,
} from '@/lib/hra';
import { Printer, Download, X, Eye, FileSpreadsheet } from 'lucide-react';

interface HraPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  entries: HraHazardEntry[];
  currentDept?: string;
}

export default function HraPrintModal({
  isOpen,
  onClose,
  entries,
  currentDept = 'OPERATION',
}: HraPrintModalProps) {
  const [selectedDept, setSelectedDept] = useState(
    currentDept && currentDept !== 'ALL' ? currentDept : 'OPERATION'
  );
  const [lokasiKerja, setLokasiKerja] = useState('All Area');
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentDept && currentDept !== 'ALL') {
      setSelectedDept(currentDept);
    }
  }, [currentDept]);

  // Filter entri sesuai departemen yang dipilih
  const filteredEntries = entries.filter((e) => {
    if (selectedDept === 'ALL') return true;
    return (e.departemen || '').toUpperCase() === selectedDept.toUpperCase();
  });

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=1200,height=800');
    if (!printWindow) {
      alert('Pop-up terblokir. Izinkan pop-up di browser Anda untuk mencetak dokumen.');
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>FORM-069 Rev.001 - HRA ${selectedDept}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm 6mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body {
            font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
            font-size: 8pt;
            color: #000;
            background: #fff;
            margin: 0;
            padding: 4px;
          }
          .doc-header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 6px;
          }
          .doc-header-table td, .doc-header-table th {
            border: 1px solid #000;
            padding: 3px 6px;
            font-size: 8pt;
          }
          .main-title {
            font-size: 11pt;
            font-weight: bold;
            text-align: center;
            letter-spacing: 0.5px;
            padding: 6px !important;
          }
          .matrix-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 7pt;
            margin-bottom: 8px;
          }
          .matrix-table th {
            border: 1px solid #000;
            background-color: #f2f2f2 !important;
            font-weight: bold;
            text-align: center;
            vertical-align: middle;
            padding: 4px 2px;
          }
          .matrix-table td {
            border: 1px solid #000;
            padding: 3px 4px;
            vertical-align: top;
          }
          .text-center { text-align: center; }
          .font-bold { font-weight: bold; }
          
          /* Risk chips in print */
          .risk-pill {
            display: inline-block;
            font-weight: bold;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 6.5pt;
            text-align: center;
          }
          .risk-low { background: #d4edda !important; color: #155724 !important; border: 1px solid #c3e6cb; }
          .risk-med { background: #fff3cd !important; color: #856404 !important; border: 1px solid #ffeeba; }
          .risk-high { background: #f8d7da !important; color: #721c24 !important; border: 1px solid #f5c6cb; }

          .signature-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
            page-break-inside: avoid;
          }
          .signature-table td {
            border: 1px solid #000;
            padding: 4px 8px;
            font-size: 7.5pt;
            width: 33.33%;
            vertical-align: top;
          }
          .sig-space {
            height: 48px;
          }
          .notes-section {
            margin-top: 8px;
            font-size: 6.5pt;
            page-break-inside: avoid;
            border: 1px solid #999;
            padding: 6px;
            background: #fafafa;
          }
          .notes-title {
            font-weight: bold;
            margin-bottom: 3px;
            text-transform: uppercase;
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
              window.close();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleExportCSV = () => {
    const headers = [
      'No',
      'Departemen',
      'Jenis Pekerjaan',
      'Jenis Health Hazard',
      'Sumber Health Hazard',
      'Kelompok Beresiko',
      'Efek Kesehatan',
      'Initial P',
      'Initial E',
      'Initial R',
      'Tindakan Pencegahan',
      'Residual P',
      'Residual E',
      'Residual R',
      'Regulasi Acuan',
    ];

    const rows = filteredEntries.map((e, idx) => [
      idx + 1,
      `"${e.departemen || ''}"`,
      `"${(e.jenis_pekerjaan || '').replace(/"/g, '""')}"`,
      `"${e.jenis_hazard || ''}"`,
      `"${(e.sumber_hazard || '').replace(/"/g, '""')}"`,
      `"${(e.kelompok_beresiko || '').replace(/"/g, '""')}"`,
      `"${(e.efek_kesehatan || '').replace(/"/g, '""')}"`,
      e.init_p,
      e.init_e,
      e.init_r,
      `"${(e.tindakan_pencegahan || '').replace(/"/g, '""')}"`,
      e.res_p,
      e.res_e,
      e.res_r,
      `"${(e.regulasi || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `HRA_FORM-069_${selectedDept}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[96vw] w-[1300px] max-h-[92vh] overflow-y-auto p-4">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap border-b pb-2">
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
                <Printer size={18} />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">
                  Pratinjau &amp; Cetak Dokumen Resmi FORM/069 Rev.001
                </DialogTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Format Standar PT. Bagong Dekaka Makmur · Siap Cetak A4 Landscape &amp; Tanda Tangan Audit
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-muted-foreground">Departemen:</span>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value)}
                  className="h-8 rounded-lg border border-border bg-background px-2 text-xs font-semibold"
                >
                  <option value="ALL">Semua Departemen ({entries.length} baris)</option>
                  {DEPARTEMEN_LIST.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="font-semibold text-muted-foreground">Lokasi:</span>
                <input
                  type="text"
                  value={lokasiKerja}
                  onChange={(e) => setLokasiKerja(e.target.value)}
                  className="h-8 w-28 rounded-lg border border-border bg-background px-2 text-xs"
                />
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-8 text-xs flex items-center gap-1.5"
              >
                <FileSpreadsheet size={13} /> Ekspor Excel (CSV)
              </Button>

              <Button
                size="sm"
                onClick={handlePrint}
                className="h-8 text-xs bg-[#ff5e00] hover:bg-[#e05300] text-white font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Printer size={13} /> Cetak / Simpan PDF
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Paper Preview Container (A4 Landscape aspect) */}
        <div className="my-2 p-3 bg-muted/40 rounded-xl overflow-x-auto border border-border">
          <div
            ref={printRef}
            className="bg-white text-black p-4 rounded shadow-xs mx-auto"
            style={{
              minWidth: 1050,
              maxWidth: 1200,
              fontFamily: 'Arial, sans-serif',
              fontSize: '8pt',
            }}
          >
            {/* 1. Header Box FORM/069 */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginBottom: 6,
                border: '1.5px solid #000',
              }}
            >
              <tbody>
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      borderBottom: '1.5px solid #000',
                      textAlign: 'center',
                      fontWeight: 800,
                      fontSize: '11pt',
                      padding: '6px 8px',
                      background: '#fff',
                      letterSpacing: '0.4px',
                    }}
                  >
                    PT. BAGONG DEKAKA MAKMUR : HEALTH HAZARD RISK ASSESSMENT (HRA)
                  </td>
                </tr>
                <tr style={{ fontSize: '7.5pt' }}>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', width: '15%', fontWeight: 700 }}>
                    Lokasi Kerja
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', width: '22%' }}>
                    : {lokasiKerja}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', width: '15%', fontWeight: 700 }}>
                    Tanggal
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', width: '18%' }}>
                    : 24 Oktober 2026
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', width: '15%', fontWeight: 700 }}>
                    No. Dokumen
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', width: '15%' }}>
                    : BG/QSHE/FORM/069
                  </td>
                </tr>
                <tr style={{ fontSize: '7.5pt' }}>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700 }}>
                    Divisi / Departemen
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                    : {selectedDept}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700 }}>
                    Status Revisi
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                    : Revisi 001
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700 }}>
                    Tgl Penerbitan
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                    : 24 Oktober 2026
                  </td>
                </tr>
                <tr style={{ fontSize: '7.5pt' }}>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700 }}>
                    Standar Acuan
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                    : Permenaker 5/2018 &amp; SMKP
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700 }}>
                    No. Revisi
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                    : 001
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px', fontWeight: 700 }}>
                    Tgl Persetujuan
                  </td>
                  <td style={{ border: '1px solid #000', padding: '3px 6px' }}>
                    : 24 Oktober 2026
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 2. Matriks Tabel 14 Kolom */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '7pt',
                border: '1px solid #000',
                marginBottom: 8,
              }}
            >
              <thead>
                <tr style={{ background: '#f0f0f0' }}>
                  <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px 2px', width: '2%' }}>No</th>
                  <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px 4px', width: '13%' }}>Jenis Pekerjaan</th>
                  <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px 4px', width: '8%' }}>Jenis Health Hazard</th>
                  <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px 4px', width: '13%' }}>Sumber Health Hazard</th>
                  <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px 4px', width: '10%' }}>Kelompok Beresiko</th>
                  <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px 4px', width: '12%' }}>Efek Kesehatan</th>
                  <th colSpan={3} style={{ border: '1px solid #000', padding: '3px', width: '9%' }}>Initial Risk</th>
                  <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px 4px', width: '13%' }}>Tindakan Pencegahan</th>
                  <th colSpan={3} style={{ border: '1px solid #000', padding: '3px', width: '9%' }}>Residual Risk</th>
                  <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px 4px', width: '11%' }}>Peraturan Perundangan</th>
                </tr>
                <tr style={{ background: '#f0f0f0' }}>
                  <th style={{ border: '1px solid #000', padding: '2px', fontSize: '6.5pt' }}>P</th>
                  <th style={{ border: '1px solid #000', padding: '2px', fontSize: '6.5pt' }}>E</th>
                  <th style={{ border: '1px solid #000', padding: '2px', fontSize: '6.5pt' }}>R</th>
                  <th style={{ border: '1px solid #000', padding: '2px', fontSize: '6.5pt' }}>P</th>
                  <th style={{ border: '1px solid #000', padding: '2px', fontSize: '6.5pt' }}>E</th>
                  <th style={{ border: '1px solid #000', padding: '2px', fontSize: '6.5pt' }}>R</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ textAlign: 'center', padding: '12px', fontStyle: 'italic', border: '1px solid #000' }}>
                      Tidak ada entri bahaya HRA untuk departemen {selectedDept}.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((row, idx) => {
                    const rInitColor = row.init_r >= 15 ? '#f8d7da' : row.init_r >= 5 ? '#fff3cd' : '#d4edda';
                    const rResColor = row.res_r >= 15 ? '#f8d7da' : row.res_r >= 5 ? '#fff3cd' : '#d4edda';

                    return (
                      <tr key={row.id || idx}>
                        <td style={{ border: '1px solid #000', textAlign: 'center', padding: '3px 2px' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '3px 4px', fontWeight: 600 }}>{row.jenis_pekerjaan}</td>
                        <td style={{ border: '1px solid #000', padding: '3px 4px' }}>{row.jenis_hazard}</td>
                        <td style={{ border: '1px solid #000', padding: '3px 4px' }}>{row.sumber_hazard}</td>
                        <td style={{ border: '1px solid #000', padding: '3px 4px' }}>{row.kelompok_beresiko}</td>
                        <td style={{ border: '1px solid #000', padding: '3px 4px' }}>{row.efek_kesehatan}</td>
                        <td style={{ border: '1px solid #000', textAlign: 'center', padding: '3px 2px' }}>{row.init_p}</td>
                        <td style={{ border: '1px solid #000', textAlign: 'center', padding: '3px 2px' }}>{row.init_e}</td>
                        <td style={{ border: '1px solid #000', textAlign: 'center', padding: '3px 2px', background: rInitColor, fontWeight: 700 }}>{row.init_r}</td>
                        <td style={{ border: '1px solid #000', padding: '3px 4px' }}>{row.tindakan_pencegahan}</td>
                        <td style={{ border: '1px solid #000', textAlign: 'center', padding: '3px 2px' }}>{row.res_p}</td>
                        <td style={{ border: '1px solid #000', textAlign: 'center', padding: '3px 2px' }}>{row.res_e}</td>
                        <td style={{ border: '1px solid #000', textAlign: 'center', padding: '3px 2px', background: rResColor, fontWeight: 700 }}>{row.res_r}</td>
                        <td style={{ border: '1px solid #000', padding: '3px 4px', fontSize: '6.5pt' }}>{row.regulasi || '-'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* 3. Lembar Pengesahan Tanda Tangan 3 Kolom */}
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '7.5pt',
                border: '1.5px solid #000',
                marginTop: 8,
              }}
            >
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #000', width: '33.33%', padding: '4px 8px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 700 }}>Dibuat Oleh,</div>
                    <div style={{ marginTop: 2 }}>Nama : <b>Anang Setyawan</b></div>
                    <div>Posisi : Paramedic</div>
                    <div style={{ height: 42, borderBottom: '1px dotted #888', marginTop: 4 }}></div>
                    <div style={{ fontSize: '7pt', marginTop: 2, color: '#444' }}>Tanda Tangan &amp; Tanggal</div>
                  </td>
                  <td style={{ border: '1px solid #000', width: '33.33%', padding: '4px 8px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 700 }}>Diperiksa Oleh,</div>
                    <div style={{ marginTop: 2 }}>Nama : <b>Asrul Maulia Napsih</b></div>
                    <div>Posisi : Safety Support</div>
                    <div style={{ height: 42, borderBottom: '1px dotted #888', marginTop: 4 }}></div>
                    <div style={{ fontSize: '7pt', marginTop: 2, color: '#444' }}>Tanda Tangan &amp; Tanggal</div>
                  </td>
                  <td style={{ border: '1px solid #000', width: '33.33%', padding: '4px 8px', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 700 }}>Disetujui Oleh,</div>
                    <div style={{ marginTop: 2 }}>Nama : <b>Ichtiaraka Amarullah</b></div>
                    <div>Posisi : Pjs. QSHE Manager</div>
                    <div style={{ height: 42, borderBottom: '1px dotted #888', marginTop: 4 }}></div>
                    <div style={{ fontSize: '7pt', marginTop: 2, color: '#444' }}>Tanda Tangan &amp; Tanggal</div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* 4. Catatan Penilaian & Skala FORM/069 */}
            <div
              style={{
                marginTop: 8,
                padding: '6px 8px',
                border: '1px solid #777',
                background: '#fcfcfc',
                fontSize: '6.5pt',
                lineHeight: 1.35,
              }}
            >
              <div style={{ fontWeight: 800, textTransform: 'uppercase', marginBottom: 3 }}>
                Catatan Penilaian Baku (Dokumen BG/QSHE/FORM/069 Rev.001):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <b>Matriks Risiko:</b> R = P × E (Low 1–4, Medium 5–12, High 15–25).<br />
                  <b>(1) Tingkat Paparan (P):</b> Berdasarkan akumulasi jam paparan per minggu sesuai NAB Permenaker 5/2018.<br />
                  <b>(2) Hasil Ukur:</b> Bila pengukuran melebihi NAB, nilai P minimal 4.<br />
                  <b>(3) Karsinogen IARC Grup 1:</b> Asbes, silika kristalin, asap las, emisi diesel, P minimal 2.
                </div>
                <div>
                  <b>(4) Prevalensi Merokok:</b> Ditentukan dari data prevalensi perokok pada jabatan.<br />
                  <b>(5) Penentuan Efek (E):</b> Mengacu pada efek kesehatan paling mungkin (most credible). Kanker mortalitas tinggi = E5.<br />
                  <b>(6) Penurunan P:</b> APD/Administratif menurunkan 1 tingkat; Engineering/Substitusi menurunkan 2 tingkat (wajib dibuktikan).
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
