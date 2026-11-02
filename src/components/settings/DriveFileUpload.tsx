'use client';

import { useRef, useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface DriveFileUploadProps {
  category: 'mcu' | 'ergonomi' | 'kampanye';
  accept: string;
  site?: string;
  onUploaded: (url: string) => void;
}

export default function DriveFileUpload({ category, accept, site, onUploaded }: DriveFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  async function upload(file: File) {
    setUploading(true);
    setMessage('');
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw new Error('Sesi login tidak dapat diverifikasi.');
      if (!session?.access_token) throw new Error('Silakan login kembali sebelum mengunggah.');

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
      <Button type="button" variant="outline" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {uploading ? 'Mengunggah...' : 'Unggah ke Google Drive'}
      </Button>
      {message && <span role="status" className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}
