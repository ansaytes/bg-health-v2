import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { rowData, config } = body;

    if (!rowData || !Array.isArray(rowData)) {
      return NextResponse.json(
        { success: false, error: 'Data baris tidak valid' },
        { status: 400 }
      );
    }

    // Simulate save delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Mock save - real Google Sheets API integration later
    return NextResponse.json({
      success: true,
      row: 1580,
      message: 'Data berhasil disimpan',
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Gagal menyimpan data' },
      { status: 500 }
    );
  }
}
