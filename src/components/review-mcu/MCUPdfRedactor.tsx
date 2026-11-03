'use client';

import { useMemo, useState } from 'react';
import { Loader2, ScanLine, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_PAGES = 30;
const MAX_IMAGES_CHARS = 3_600_000;

interface Redaction {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PdfPagePreview {
  number: number;
  canvas: HTMLCanvasElement;
  previewUrl: string;
  redactions: Redaction[];
  identityAbsent: boolean;
}

interface Point {
  x: number;
  y: number;
}

function parseDriveFileId(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error('Masukkan tautan Google Drive yang valid.');
  }
  if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname)) {
    throw new Error('Sumber PDF harus berupa tautan Google Drive.');
  }

  const pathId = url.pathname.match(/\/(?:file|document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]+)/)?.[1];
  const fileId = pathId || url.searchParams.get('id') || '';
  if (!/^[A-Za-z0-9_-]{10,256}$/.test(fileId)) {
    throw new Error('ID file pada tautan Google Drive tidak valid.');
  }
  return fileId;
}

function getPoint(event: React.PointerEvent<HTMLDivElement>): Point {
  const bounds = event.currentTarget.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
  };
}

function makeRedaction(start: Point, end: Point): Redaction {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function PagePreview({
  page,
  onChange,
}: {
  page: PdfPagePreview;
  onChange: (update: (current: PdfPagePreview) => PdfPagePreview) => void;
}) {
  const [start, setStart] = useState<Point | null>(null);
  const [draft, setDraft] = useState<Redaction | null>(null);

  const begin = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getPoint(event);
    setStart(point);
    setDraft({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start) return;
    setDraft(makeRedaction(start, getPoint(event)));
  };

  const finish = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start) return;
    const redaction = makeRedaction(start, getPoint(event));
    if (redaction.width >= 0.008 && redaction.height >= 0.006) {
      onChange((current) => ({
        ...current,
        redactions: [...current.redactions, redaction],
        identityAbsent: false,
      }));
    }
    setStart(null);
    setDraft(null);
  };

  return (
    <article className="rounded-xl border border-border bg-background p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <strong className="text-sm">Halaman {page.number}</strong>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!page.redactions.length}
          onClick={() => onChange((current) => ({ ...current, redactions: [] }))}
        >
          <Trash2 className="mr-1 size-3.5" /> Hapus samaran
        </Button>
      </div>

      <div
        className="relative mx-auto w-full max-w-[760px] touch-none select-none overflow-hidden rounded-md border border-border bg-muted"
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        aria-label={`Area pratinjau halaman ${page.number}; tarik untuk menyamarkan identitas`}
      >
        <img
          src={page.previewUrl}
          alt={`Pratinjau halaman ${page.number}`}
          draggable={false}
          className="block h-auto w-full"
        />
        {page.redactions.map((area, index) => (
          <span
            key={`${page.number}-${index}`}
            aria-hidden="true"
            className="pointer-events-none absolute bg-black"
            style={{
              left: `${area.x * 100}%`,
              top: `${area.y * 100}%`,
              width: `${area.width * 100}%`,
              height: `${area.height * 100}%`,
            }}
          />
        ))}
        {draft && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute border-2 border-red-500 bg-black/80"
            style={{
              left: `${draft.x * 100}%`,
              top: `${draft.y * 100}%`,
              width: `${draft.width * 100}%`,
              height: `${draft.height * 100}%`,
            }}
          />
        )}
      </div>

      <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={page.identityAbsent}
          onChange={(event) => onChange((current) => ({
            ...current,
            identityAbsent: event.target.checked,
          }))}
        />
        Halaman ini tidak memuat area identitas
      </label>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Tarik kotak hitam menutupi nama, NIK, alamat, barcode, atau identitas lain yang terlihat.
      </p>
    </article>
  );
}

export default function MCUPdfRedactor({
  busy,
  onExtract,
}: {
  busy: boolean;
  onExtract: (images: string[]) => Promise<boolean>;
}) {
  const [driveUrl, setDriveUrl] = useState('');
  const [pages, setPages] = useState<PdfPagePreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const readyToExtract = useMemo(
    () => pages.length > 0 && pages.every((page) => page.redactions.length > 0 || page.identityAbsent),
    [pages],
  );

  const updatePage = (pageNumber: number, update: (page: PdfPagePreview) => PdfPagePreview) => {
    setPages((current) => current.map((page) => page.number === pageNumber ? update(page) : page));
  };

  async function renderPdf(bytes: ArrayBuffer, name: string) {
    const signature = new TextDecoder().decode(bytes.slice(0, 5));
    if (signature !== '%PDF-') throw new Error('File yang dipilih bukan PDF yang valid.');

    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
    const pdfDocument = await loadingTask.promise;
    try {
      if (pdfDocument.numPages > MAX_PAGES) {
        throw new Error(`PDF dibatasi hingga ${MAX_PAGES} halaman. Pecah dokumen lalu proses bagian per bagian.`);
      }

      const renderedPages: PdfPagePreview[] = [];
      for (let number = 1; number <= pdfDocument.numPages; number += 1) {
        const pdfPage = await pdfDocument.getPage(number);
        const baseViewport = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(2, 1500 / baseViewport.width);
        const viewport = pdfPage.getViewport({ scale });
        const canvas = window.document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Browser tidak dapat menyiapkan pratinjau PDF.');
        await pdfPage.render({ canvasContext: context, viewport }).promise;
        renderedPages.push({
          number,
          canvas,
          previewUrl: canvas.toDataURL('image/jpeg', 0.82),
          redactions: [],
          identityAbsent: false,
        });
      }
      setPages(renderedPages);
      setSourceName(name);
      setPreviewOpen(true);
    } finally {
      await pdfDocument.destroy();
    }
  }

  async function openLocalFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setPages([]);
    setSourceName('');
    if ((file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) || file.size > MAX_FILE_BYTES) {
      setError(file.size > MAX_FILE_BYTES
        ? 'Ukuran PDF maksimal 15 MB.'
        : 'Pilih file PDF.');
      return;
    }
    setLoading(true);
    try {
      await renderPdf(await file.arrayBuffer(), file.name);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PDF tidak dapat dibuka.');
    } finally {
      setLoading(false);
    }
  }

  async function openDriveFile() {
    setError('');
    setPages([]);
    setSourceName('');
    setLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error('Sesi login tidak tersedia. Silakan masuk kembali.');
      const fileId = parseDriveFileId(driveUrl);
      const response = await fetch(`/api/ocr/source?fileId=${encodeURIComponent(fileId)}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(result?.error || 'PDF tidak dapat diambil dari Google Drive.');
      }
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > MAX_FILE_BYTES) throw new Error('Ukuran PDF maksimal 15 MB.');
      await renderPdf(bytes, 'PDF dari Google Drive');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Gagal membuka PDF dari Google Drive.');
    } finally {
      setLoading(false);
    }
  }

  async function extract() {
    if (!readyToExtract || busy) return;
    setError('');
    try {
      const createImages = (quality: number) => pages.map((page) => {
        const canvas = window.document.createElement('canvas');
        canvas.width = page.canvas.width;
        canvas.height = page.canvas.height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Browser tidak dapat menyiapkan hasil yang disamarkan.');
        context.drawImage(page.canvas, 0, 0);
        context.fillStyle = '#000000';
        for (const area of page.redactions) {
          context.fillRect(
            Math.floor(area.x * canvas.width),
            Math.floor(area.y * canvas.height),
            Math.ceil(area.width * canvas.width),
            Math.ceil(area.height * canvas.height),
          );
        }
        return canvas.toDataURL('image/jpeg', quality);
      });
      let images = createImages(0.78);
      if (images.reduce((total, image) => total + image.length, 0) > MAX_IMAGES_CHARS) {
        images = createImages(0.62);
      }
      if (images.reduce((total, image) => total + image.length, 0) > MAX_IMAGES_CHARS) {
        throw new Error('Ukuran gambar hasil penyamaran terlalu besar. Gunakan PDF yang lebih kecil atau kurangi jumlah halaman.');
      }
      const extracted = await onExtract(images);
      if (extracted) setPreviewOpen(false);
      else setError('Ekstraksi belum berhasil. Periksa notifikasi untuk melihat penyebabnya.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Gambar hasil penyamaran tidak dapat diproses.');
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 text-sm">
      <div className="grid gap-3 rounded-xl border border-border bg-muted/40 p-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-sm font-medium">PDF dari perangkat</span>
          <label
            htmlFor="mcu-local-pdf"
            className={`flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border border-primary/40 bg-background px-3 py-2 text-center text-sm font-semibold text-primary transition-colors hover:bg-primary/5 ${loading || busy ? 'pointer-events-none opacity-50' : ''}`}
          >
            <Upload className="size-4 shrink-0" />
            <span>Pilih file PDF</span>
          </label>
          <input
            id="mcu-local-pdf"
            type="file"
            accept="application/pdf,.pdf"
            disabled={loading || busy}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = '';
              void openLocalFile(file);
            }}
            className="sr-only"
          />
          {sourceName && <span role="status" className="truncate text-xs text-muted-foreground">{sourceName} · {pages.length} halaman</span>}
          {pages.length > 0 && (
            <Button type="button" variant="outline" className="h-9 cursor-pointer" onClick={() => setPreviewOpen(true)}>
              Pratinjau / Samarkan
            </Button>
          )}
          <p className="text-xs text-muted-foreground">PDF maksimal 15 MB, hingga {MAX_PAGES} halaman.</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <label htmlFor="mcu-drive-link" className="text-sm font-medium">Atau tautan Google Drive</label>
          <div className="flex min-w-0 gap-2">
            <input
              id="mcu-drive-link"
              type="url"
              value={driveUrl}
              onChange={(event) => setDriveUrl(event.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              disabled={loading || busy}
              className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-xs"
            />
            <Button type="button" variant="outline" onClick={() => void openDriveFile()} disabled={!driveUrl.trim() || loading || busy}>
              <Upload className="mr-1 size-4" /> Buka
            </Button>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        PDF asli tetap di perangkat atau Drive. Hanya gambar hasil penyamaran yang dikirim untuk dibaca.
        Maksimal 15 MB dan {MAX_PAGES} halaman per proses.
      </p>

      {loading && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border p-8 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Menyiapkan pratinjau PDF...
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          showCloseButton
          className="flex h-[92dvh] max-h-[92dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
        >
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
            <DialogTitle>Pratinjau dan Samarkan PDF</DialogTitle>
            <DialogDescription>
              {sourceName} · {pages.length} halaman. Samarkan identitas pada setiap halaman sebelum ekstraksi.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
            {!readyToExtract && (
              <p className="text-xs font-medium text-amber-700">
                Setiap halaman harus memiliki area yang disamarkan atau ditandai tanpa identitas.
              </p>
            )}
            <div className="grid gap-4">
              {pages.map((page) => (
                <PagePreview
                  key={page.number}
                  page={page}
                  onChange={(update) => updatePage(page.number, update)}
                />
              ))}
            </div>
          </div>
          <div className="shrink-0 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              onClick={() => void extract()}
              disabled={!readyToExtract || busy}
              className="h-11 w-full bg-orange-500 text-white hover:bg-orange-600 sm:w-auto sm:min-w-56"
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ScanLine className="mr-2 size-4" />}
              {busy ? 'Mengekstrak...' : 'Kirim hasil tersamar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
