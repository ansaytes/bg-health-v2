import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Teks OCR wajib diisi' },
        { status: 400 }
      );
    }

    // Simulate AI processing delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock extracted MCU data - real Gemini integration later
    const mockExtracted = {
      tdS: '130',
      tdD: '85',
      nadi: '78',
      bb: '72',
      tb: '170',
      lp: '88',
      hb: '14.5',
      leukosit: '7.2',
      eritrosit: '5.1',
      hematokrit: '42',
      trombosit: '250',
      mcv: '88',
      mch: '28.5',
      led: '5',
      chol: '195',
      tg: '120',
      hdl: '55',
      ldl: '110',
      gdp: '95',
      gd2pp: '110',
      hba1c: '5.4',
      au: '5.8',
      ureum: '28',
      kreatinin: '0.9',
      egfr: '95',
      sgot: '25',
      sgpt: '30',
      ggt: '35',
      alp: '80',
      billirubin: '0.8',
      hbsag: 'Non - Reaktif',
      antiHbs: 'Reaktif',
      vdrl: 'Non - Reaktif',
      tpha: 'Non - Reaktif',
      hiv: 'Non - Reaktif',
      drugAmp: 'Negatif',
      drugMeth: 'Negatif',
      drugMorph: 'Negatif',
      drugCanna: 'Negatif',
      drugCoc: 'Negatif',
      drugBenz: 'Negatif',
      drugCaris: 'Negatif',
      alkohol: 'Negatif',
      merokok: 'Tidak',
      golDarah: 'O+',
      gigiMulut: 'DBN',
      fisikHeadToToe: 'DBN',
      hemoroid: 'Negatif',
      visusJauh: 'VOD 6/6 VOS 6/6',
      visusDekat: 'J1',
      defWarna: 'Normal',
      lapangPandang: 'DBN',
      fisikMata: 'DBN',
      chestXR: 'Cor dan Pulmo DBN',
      lumboXR: 'Lumbosacral DBN',
      ecgHasil: 'Normal Sinus Rhythm',
      tmHasil: 'N/A',
      usg: 'DBN',
      spiInterp: 'Normal Spirometry',
      audInterp: 'Normal Audiometry',
      balance: 'DBN',
      romberg: 'Negatif',
      phalen: 'Negatif',
      thinel: 'Negatif',
      patrick: 'Negatif',
      kontraPatrick: 'Negatif',
      laseque: 'Negatif',
      kernig: 'Negatif',
      kesVendor: 'Fit To Work',
      ul: 'DBN',
    };

    return NextResponse.json({
      success: true,
      data: mockExtracted,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Terjadi kesalahan saat ekstraksi' },
      { status: 500 }
    );
  }
}
