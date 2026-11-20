'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface DriveFileUploadProps {
  category: 'mcu' | 'ergonomi' | 'kampanye' | 'branding';
  accept: string;
  site?: string;
  label?: string;
  targetWidth?: number;
  targetHeight?: number;
  onUploaded: (url: string) => void;
}

export default function DriveFileUpload({
  category,
  accept,
  site,
  label = 'Unggah ke Google Drive',
  targetWidth,
  targetHeight,
  onUploaded,
}: DriveFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  // Resize otomatis di client canvas sebelum upload bila targetWidth & targetHeight ditentukan
  async function resizeImageIfNeeded(file: File): Promise<File> {
    if (!targetWidth || !targetHeight || !file.type.startsWith('image/')) {
      return file;
    }

    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        // Gambar dengan proporsi pas dan latar transparan
        ctx.clearRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        canvas.toBlob((blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const resized = new File([blob], file.name.replace(/\.[^.]+$/, '.png'), {
            type: 'image/png',
          });
          resolve(resized);
        }, 'image/png');
      };
      img.onerror = () => resolve(file);
      img.src = url;
    });
  }

  async function upload(rawFile: File) {
    setUploading(true);
    setMessage('');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error('Sesi login tidak dapat diverifikasi.');
      if (!session?.access_token) throw new Error('Silakan login kembali sebelum mengunggah.');

      const file = await resizeImageIfNeeded(rawFile);

      const form = new FormData();
      form.append('file', file);
      form.append('category', category);
      if (site) form.append('site', site);
      const response = await fetch('/api/integrations/google-drive/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: form,
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !result || typeof result !== 'object'
        || !('success' in result) || result.success !== true
        || !('data' in result) || !result.data || typeof result.data !== 'object'
        || !('url' in result.data) || typeof result.data.url !== 'string') {
        const errorMessage = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
          ? result.error : `Upload gagal (${response.status}).`;
        throw new Error(errorMessage);
      }
      onUploaded(result.data.url);
      setMessage('File berhasil diunggah.');
      if (inputRef.current) inputRef.current.value = '';
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload gagal.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={uploading}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()} className="h-9 gap-1 text-xs">
        {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
        {uploading ? 'Mengunggah...' : label}
      </Button>
      {message && (
        <span className={`text-[11px] ${message.includes('berhasil') ? 'text-emerald-600' : 'text-destructive'}`}>
          {message}
        </span>
      )}
    </div>
  );
}
