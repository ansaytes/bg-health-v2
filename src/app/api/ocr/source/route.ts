import { NextRequest, NextResponse } from 'next/server';
import { getDriveAccessToken } from '@/lib/integration-settings';
import { getServerCaller, requireServerRole, STAFF_ROLES } from '@/lib/server-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const DRIVE_API = 'https://www.googleapis.com/drive/v3/files';

export async function GET(request: NextRequest) {
  const caller = await getServerCaller(request);
  const denied = requireServerRole(caller, STAFF_ROLES);
  if (denied) return denied;

  const fileId = request.nextUrl.searchParams.get('fileId') ?? '';
  if (!/^[A-Za-z0-9_-]{10,256}$/.test(fileId)) {
    return NextResponse.json({ error: 'ID file Google Drive tidak valid.' }, { status: 400 });
  }

  try {
    const accessToken = await getDriveAccessToken();
    const headers = { Authorization: `Bearer ${accessToken}` };
    const metadataResponse = await fetch(
      `${DRIVE_API}/${encodeURIComponent(fileId)}?fields=id%2CmimeType%2Csize`,
      { headers, signal: AbortSignal.timeout(15_000), cache: 'no-store' },
    );
    if (!metadataResponse.ok) {
      return NextResponse.json({ error: 'File tidak dapat diakses melalui akun Google Drive yang terhubung.' }, { status: 400 });
    }

    const metadata: unknown = await metadataResponse.json();
    if (!metadata || typeof metadata !== 'object'
      || !('mimeType' in metadata) || metadata.mimeType !== 'application/pdf') {
      return NextResponse.json({ error: 'File Google Drive harus berupa PDF.' }, { status: 415 });
    }
    if ('size' in metadata && Number(metadata.size) > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Ukuran PDF maksimal 15 MB.' }, { status: 413 });
    }

    const fileResponse = await fetch(`${DRIVE_API}/${encodeURIComponent(fileId)}?alt=media`, {
      headers,
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
    if (!fileResponse.ok) {
      return NextResponse.json({ error: 'PDF tidak dapat diunduh dari Google Drive.' }, { status: 502 });
    }

    const bytes = await fileResponse.arrayBuffer();
    if (bytes.byteLength > MAX_FILE_BYTES) {
      return NextResponse.json({ error: 'Ukuran PDF maksimal 15 MB.' }, { status: 413 });
    }
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') {
      return NextResponse.json({ error: 'File Google Drive bukan PDF yang valid.' }, { status: 415 });
    }

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(bytes.byteLength),
        'Cache-Control': 'private, no-store, max-age=0',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('[OCR source] Google Drive PDF retrieval failed:', error instanceof Error ? error.name : 'unknown error');
    return NextResponse.json({ error: 'Gagal membuka PDF dari Google Drive.' }, { status: 502 });
  }
}
