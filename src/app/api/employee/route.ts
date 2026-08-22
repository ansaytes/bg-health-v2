import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nikKtp } = body;

    if (!nikKtp || typeof nikKtp !== 'string') {
      return NextResponse.json(
        { success: false, error: 'NIK KTP wajib diisi' },
        { status: 400 }
      );
    }

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Mock employee data - real integration with Google Sheets later
    const mockEmployee = {
      nikKaryawan: 'EMP001',
      nama: 'Ahmad Fauzi',
      gender: 'Laki - Laki',
      jabatan: 'Operator',
      site: 'Site A',
      usia: '35',
    };

    return NextResponse.json({
      success: true,
      data: mockEmployee,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
