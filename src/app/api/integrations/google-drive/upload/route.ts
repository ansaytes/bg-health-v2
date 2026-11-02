import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken, readIntegration } from '@/lib/integration-settings';
import { getServerCaller, requireServerRole, STAFF_ROLES } from '@/lib/server-auth';

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, Set<string>> = {
  mcu: new Set(['application/pdf', 'image/jpeg', 'image/png']),
  ergonomi: new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']),
  kampanye: new Set(['image/jpeg', 'image/png', 'image/webp']),
};

function safeFilename(value: string): string {
  const name = value.replace(/[\\/\u0000-\u001f]/g, '_').trim().slice(0, 180);
  return name || 'upload';
}

export async function POST(request: NextRequest) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, STAFF_ROLES);
  if (denied) return denied;

  try {
    const form = await request.formData();
    const file = form.get('file');
    const category = form.get('category');
    const requestedSite = typeof form.get('site') === 'string' ? String(form.get('site')).trim() : '';
    if (!(file instanceof File) || typeof category !== 'string' || !(category in ALLOWED_TYPES)) {
      return NextResponse.json({ success: false, error: 'File atau kategori upload tidak valid.' }, { status: 400 });
    }
    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'Ukuran file harus antara 1 byte dan 25 MB.' }, { status: 413 });
    }
    if (!ALLOWED_TYPES[category].has(file.type)) {
      return NextResponse.json({ success: false, error: 'Jenis file tidak diizinkan untuk kategori ini.' }, { status: 415 });
    }
    if (caller!.role === 'pic' && (!caller!.site || (requestedSite && requestedSite.toLowerCase() !== caller!.site.toLowerCase()))) {
      return NextResponse.json({ success: false, error: 'PIC hanya dapat mengunggah untuk site sendiri.' }, { status: 403 });
    }

    const drive = await readIntegration('google_drive');
    const folderId = typeof drive?.config.folderId === 'string' ? drive.config.folderId : '';
    if (!folderId) return NextResponse.json({ success: false, error: 'Folder Google Drive belum diatur.' }, { status: 503 });

    const accessToken = await getDriveAccessToken();
    const site = (caller!.role === 'pic' ? caller!.site : requestedSite) || '';
    const metadata = {
      name: safeFilename(file.name),
      mimeType: file.type,
      parents: [folderId],
      appProperties: { application: 'bg-health', category, site: site.slice(0, 100) },
    };
    const uploadBody = new FormData();
    uploadBody.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    uploadBody.append('file', file, metadata.name);
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: uploadBody,
        signal: AbortSignal.timeout(45_000),
        cache: 'no-store',
      },
    );
    if (!response.ok) {
      console.error('[Drive upload] Google Drive rejected an upload:', response.status);
      return NextResponse.json({ success: false, error: 'Google Drive gagal menerima file.' }, { status: 502 });
    }
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string') {
      return NextResponse.json({ success: false, error: 'Google Drive memberikan respons yang tidak valid.' }, { status: 502 });
    }
    if (category === 'kampanye') {
      const permissionResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(result.id)}/permissions?supportsAllDrives=true`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'anyone', role: 'reader' }),
          signal: AbortSignal.timeout(10_000),
          cache: 'no-store',
        },
      );
      if (!permissionResponse.ok) {
        console.error('[Drive upload] Could not make campaign image publicly readable:', permissionResponse.status);
        return NextResponse.json({ success: false, error: 'Folder Drive menolak izin baca publik untuk gambar kampanye.' }, { status: 502 });
      }
    }
    return NextResponse.json({
      success: true,
      data: {
        id: result.id,
        name: 'name' in result && typeof result.name === 'string' ? result.name : metadata.name,
        url: category === 'kampanye'
          ? `https://drive.google.com/file/d/${encodeURIComponent(result.id)}/view`
          : 'webViewLink' in result && typeof result.webViewLink === 'string'
            ? result.webViewLink
            : `https://drive.google.com/file/d/${encodeURIComponent(result.id)}/view`,
      },
    });
  } catch (error) {
    console.error('[Drive upload] Upload failed:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ success: false, error: 'Upload Google Drive gagal.' }, { status: 502 });
  }
}
