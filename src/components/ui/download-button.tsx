'use client';

import { useState, useCallback } from 'react';

type DownloadFormat = 'excel' | 'csv' | 'pdf';

interface DownloadButtonProps {
  /** Function that returns the rows to download */
  getData: () => any[];
  /** Filename without extension */
  filename: string;
  /** Sheet/title for Excel & PDF */
  title?: string;
  /** Optional columns filter — if provided, only these keys are exported */
  columns?: string[];
  /** Small variant for compact spaces */
  variant?: 'default' | 'compact';
}

/**
 * DownloadButton — attractive download button with format selector dropdown
 * and animated progress percentage during export.
 *
 * Supports Excel (.xlsx), CSV (.csv), PDF (.html print).
 * Uses SheetJS for Excel, manual serialization for CSV, window.print for PDF.
 */
export default function DownloadButton({
  getData,
  filename,
  title,
  columns,
  variant = 'default',
}: DownloadButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [downloading, setDownloading] = useState(false);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const exportToCSV = (data: any[], fname: string) => {
    if (!data.length) {
      alert('Tidak ada data untuk diexport');
      return;
    }
    const cols = columns || Object.keys(data[0]);
    const header = cols.join(',');
    const rows = data.map(row =>
      cols.map(col => {
        const val = row[col];
        if (val == null) return '';
        const str = String(val).replace(/"/g, '""');
        return /[",\n]/.test(str) ? `"${str}"` : str;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fname}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportToExcel = async (data: any[], fname: string, sheetTitle?: string) => {
    if (!data.length) {
      alert('Tidak ada data untuk diexport');
      return;
    }
    // Dynamically import xlsx library
    const XLSX = await import('xlsx');
    const cols = columns || Object.keys(data[0]);
    const filteredData = data.map(row => {
      const obj: Record<string, any> = {};
      cols.forEach(col => { obj[col] = row[col]; });
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(filteredData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (sheetTitle || fname).substring(0, 30));
    XLSX.writeFile(wb, `${fname}.xlsx`);
  };

  const exportToPDF = (data: any[], fname: string, pdfTitle?: string) => {
    if (!data.length) {
      alert('Tidak ada data untuk diexport');
      return;
    }
    const cols = columns || Object.keys(data[0]);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Pop-up diblokir. Mohon izinkan pop-up untuk download PDF.');
      return;
    }
    const rows = data.map(row =>
      `<tr>${cols.map(col => `<td>${row[col] == null ? '' : String(row[col]).replace(/</g, '&lt;')}</td>`).join('')}</tr>`
    ).join('');
    const html = `<!DOCTYPE html>
<html><head><title>${pdfTitle || fname}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1a1a1a; }
h2 { color: #ff4d00; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { background: #ff4d00; color: #fff; padding: 8px 10px; text-align: left; font-weight: 700; }
td { padding: 6px 10px; border-bottom: 1px solid #e0e0e0; }
tr:nth-child(even) { background: #fafafa; }
.export-info { color: #666; font-size: 11px; margin-bottom: 8px; }
</style></head>
<body>
<div class="export-info">Exported: ${new Date().toLocaleString('id-ID')}</div>
<h2>${pdfTitle || fname}</h2>
<table>
<thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
<tbody>${rows}</tbody>
</table>
<script>window.onload = function() { setTimeout(function() { window.print(); }, 300); }</script>
</body></html>`;
    win.document.write(html);
    win.document.close();
  };

  const handleDownload = useCallback(async (format: DownloadFormat) => {
    if (downloading) return;
    setDownloading(true);
    setProgress(0);
    setIsOpen(false);
    try {
      const steps = [10, 25, 50, 75, 90];
      for (const step of steps) {
        setProgress(step);
        await sleep(120);
      }
      const data = getData();
      if (format === 'csv') exportToCSV(data, filename);
      else if (format === 'excel') await exportToExcel(data, filename, title);
      else if (format === 'pdf') exportToPDF(data, filename, title);
      setProgress(100);
      await sleep(400);
    } catch (err) {
      console.error('Download error:', err);
      alert('Gagal mendownload: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setProgress(null);
      setDownloading(false);
    }
  }, [downloading, getData, filename, title]);

  if (progress !== null) {
    return (
      <div className="download-btn-progress" role="status" aria-live="polite">
        <div className="download-btn-progress-bar">
          <div className="download-btn-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="download-btn-progress-label">{progress}%</span>
      </div>
    );
  }

  return (
    <div className="download-btn-wrapper">
      <button
        type="button"
        className={`download-btn-trigger${downloading ? ' downloading' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        disabled={downloading}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <svg viewBox="0 0 24 24" width={variant === 'compact' ? 14 : 16} height={variant === 'compact' ? 14 : 16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="download-btn-icon">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        <span>Download</span>
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 2, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'none' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && (
        <>
          <div className="download-btn-backdrop" onClick={() => setIsOpen(false)} />
          <div className="download-btn-menu" role="menu">
            <button type="button" onClick={() => handleDownload('excel')} className="download-btn-option">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#1d6f42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></svg>
              <div>
                <strong>Excel</strong>
                <small>.xlsx</small>
              </div>
            </button>
            <button type="button" onClick={() => handleDownload('csv')} className="download-btn-option">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>
              <div>
                <strong>CSV</strong>
                <small>.csv</small>
              </div>
            </button>
            <button type="button" onClick={() => handleDownload('pdf')} className="download-btn-option">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M9 13h6" /><path d="M9 17h6" /></svg>
              <div>
                <strong>PDF</strong>
                <small>Print to PDF</small>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
