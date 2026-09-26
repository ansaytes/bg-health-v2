import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { MCU_FIELDS } from '@/lib/mcu-fields';
import {
  DEFAULT_GEMINI_OCR_MODEL,
  GEMINI_OCR_MODELS,
  isGeminiOcrModel,
} from '@/lib/gemini-ocr-models';

// Create a schema mapping dynamically from MCU_FIELDS
function generatePromptSchema() {
  const fieldsInfo = MCU_FIELDS.map(f => {
    return `- ${f.id} (${f.label}): Type ${f.type}, Section ${f.section}`;
  }).join('\n');

  return `
Kamu adalah spesialis ekstraksi dan formatter hasil Medical Check Up (MCU).
Ekstrak dokumen MCU secara teliti ke format JSON dengan key yang persis sama seperti daftar ID field berikut:
${fieldsInfo}

ATURAN DATA:
1. Hanya kembalikan data yang benar-benar terbaca dari dokumen.
2. Makna "N/A" adalah pemeriksaan tidak dilakukan/tidak ada hasil (NULL): kembalikan string kosong untuk field tersebut. Jangan gunakan N/A hanya karena pembacaan AI gagal.
3. "DBN" berarti Dalam Batas Normal. Pertahankan "DBN" untuk hasil pemeriksaan yang dilakukan dan normal; jangan mengubahnya menjadi kosong atau N/A.
4. Jangan menambahkan satuan pada nilai laboratorium atau angka spirometri. Simpan angka saja.
5. Gunakan koma untuk desimal. Untuk hasil laboratorium dengan satuan ribuan, normalkan ke satuan ribuan tanpa nol yang tidak perlu: "8.900" menjadi "8,9", "9.030" menjadi "9,03". Jangan menambahkan "000".
6. Jangan mengubah nilai medis, membulatkan secara bebas, atau membuat diagnosis yang tidak tertulis.
7. Output HARUS valid JSON tanpa awalan markdown seperti \`\`\`json.
8. Key JSON harus menggunakan ID field yang persis sama.
9. Jangan mengisi field "catatan". Field tersebut khusus input manual.
10. "Pemeriksaan Lain" hanya berisi pemeriksaan yang tidak termasuk daftar field pemeriksaan lain pada form.
11. "rekFU" harus berupa array nilai dropdown kolom DJ yang sesuai. Jangan menyalin kalimat rekomendasi bebas ke opsi; petakan hanya tujuan konsultasi dan saran gaya hidup yang memang tertulis.
12. "itemFU" adalah hasil formula kolom DK spreadsheet; jangan membuat ringkasan baru karena aplikasi akan menghitungnya dari temuan dan kesimpulan vendor.
13. "kesVendor" harus mengambil kesimpulan vendor dari kolom DF/dokumen, dengan pilihan yang sesuai:
    Fit To Work, Fit With Note, Fit With Restriction, Currently Unfit, Temporary Unfit, atau Unfit.
14. "rekQSHE" harus mengambil nilai dropdown kolom DG secara persis:
    Fit To Work, Fit With Note, Fit With Restriction, Currently Unfit, Unfit, atau Temporary Unfit.
15. "perluFU" harus mengambil nilai Ya/Tidak dari dokumen. Jangan menyimpulkan hanya dari adanya abnormalitas.
15. Tanggal harus dikembalikan dalam format YYYY-MM-DD jika tanggal lengkap terbaca.
16. Jika field tanggal expired tidak tertulis, jangan mengarangnya; aplikasi akan menghitungnya dari tanggal MCU.

DETAIL WAJIB:
17. Wajib membaca dan memetakan seluruh nilai detail spirometri:
   - Spirometri: fvcPred, fvcAct, fvcPct, fev1Pred, fev1Act, fev1Pct, fev1FvcPred, fev1FvcAct, fev1FvcPct, spiInterp.
   Jangan menambahkan "L" pada angka.
   Format gabungan interpretasi boleh disimpan di spiInterp, tetapi angka detail tetap harus diisi ke field masing-masing.
18. Wajib membaca seluruh nilai audiometri:
   acr_500, acr_1k, acr_2k, acr_3k, acr_4k, acr_6k, acr_8k,
   acl_500, acl_1k, acl_2k, acl_3k, acl_4k, acl_6k, acl_8k, audInterp.
   ACR adalah telinga kanan dan ACL telinga kiri. Frekuensi yang tidak diperiksa harus dikosongkan, bukan diisi N/A.
19. Normalisasi identitas: Laki-laki/Pria menjadi "Laki - Laki"; Perempuan/Wanita menjadi "Perempuan".
20. Status MCU wajib mengikuti dropdown kolom H spreadsheet secara persis: Pre Employee, Annual, Specific, Retirement, Follow Up - Pre Employee, Follow Up - Annual.
21. Format dokumen dapat berupa pasangan Item/Hasil atau teks berurutan. Gunakan label item sebagai batas nilai, termasuk bila seluruh data menempel tanpa pemisah baris.
22. Isi NIK KTP, Nama, Usia, Jenis Kelamin, Jabatan, dan Site hanya dari identitas yang terbaca. Jangan mengisi NIK KTP dari NIK Karyawan atau dari nama.
23. Normalisasi kesimpulan vendor berbahasa Indonesia ke opsi terdekat: "Fit dengan Catatan" menjadi "Fit With Note", "Fit dengan Pembatasan" menjadi "Fit With Restriction", "Tidak Layak Sementara" menjadi "Temporary Unfit", dan "Tidak Layak" menjadi "Unfit".
24. Status MCU berbeda dari Kesimpulan Vendor. Jangan mengisi statusMCU dengan "Fit With Note" atau kesimpulan kelayakan kerja.
25. Rekomendasi Follow Up yang menyebut dokter spesialis penyakit dalam dipetakan ke "Dokter Sp. PD"; saran diet/olahraga dipetakan ke opsi gaya hidup yang tersedia. Gunakan beberapa opsi bila beberapa tindakan jelas tertulis.
26. Catatan Tambahan hanya boleh merangkum abnormalitas dan saran yang tercetak dalam dokumen. Jangan menyimpulkan diagnosis atau rekomendasi baru.
27. Bila eGFR tidak tercantum, biarkan field egfr kosong. Aplikasi boleh menghitung estimasi CKD-EPI 2021 dari kreatinin serum, usia, dan jenis kelamin; jangan memperkirakan eGFR dari ureum.
`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text, modelId } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Teks OCR kosong' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'Konfigurasi layanan ekstraksi belum tersedia di server.' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // Cek apakah input adalah link Google Drive
    const gDriveMatch = text.match(/(?:drive\.google\.com\/.*[?&]id=|drive\.google\.com\/file\/d\/)([-\w]{25,})/);
    let parts: any[] = [];

    if (gDriveMatch && gDriveMatch[1]) {
      const fileId = gDriveMatch[1];
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
      
      try {
        const fileRes = await fetch(downloadUrl);
        if (!fileRes.ok) {
            throw new Error(`HTTP ${fileRes.status}`);
        }
        
        // Cek contentType jika memungkinkan, tapi default ke pdf
        const contentType = fileRes.headers.get('content-type') || 'application/pdf';
        const arrayBuffer = await fileRes.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString('base64');
        
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: contentType.includes('text/html') ? 'application/pdf' : contentType
          }
        });
        parts.push({ text: "Tolong ekstrak data MCU dari dokumen ini." });
      } catch (err) {
        return NextResponse.json({ 
            success: false, 
            error: 'Gagal mengunduh dokumen dari Google Drive. Pastikan akses link diset ke "Anyone with the link".' 
        }, { status: 400 });
      }
    } else {
      parts.push({ text: text });
    }

    const configuredDefault = process.env.GEMINI_OCR_MODEL || DEFAULT_GEMINI_OCR_MODEL;
    if (modelId !== undefined && !isGeminiOcrModel(modelId)) {
      return NextResponse.json(
        { success: false, error: 'Model ekstraksi yang dipilih tidak tersedia. Pilih model dari daftar Mode Ekstraksi Data.' },
        { status: 400 },
      );
    }
    const selectedModel = isGeminiOcrModel(modelId)
      ? modelId
      : isGeminiOcrModel(configuredDefault)
        ? configuredDefault
        : DEFAULT_GEMINI_OCR_MODEL;
    const requestConfig = {
      contents: [{ role: 'user' as const, parts }],
      config: {
        systemInstruction: generatePromptSchema(),
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    };

    async function generate(model: string) {
      return ai.models.generateContent({ model, ...requestConfig });
    }

    let response;
    try {
      response = await generate(selectedModel);
    } catch (err: unknown) {
      const apiError = err as { code?: number; status?: string; message?: string };
      const message = apiError.message || '';
      const isQuotaError = apiError.code === 429
        || apiError.status === 'RESOURCE_EXHAUSTED'
        || /quota exceeded|rate limit|resource_exhausted/i.test(message);

      if (isQuotaError) {
        const retryMatch = message.match(/retry(?:Delay| after)[^0-9]*(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)?/i)
          || message.match(/(\d+(?:\.\d+)?)\s*(?:s|sec|seconds)\b/i);
        // The provider's retry value can land exactly on the rolling-window
        // boundary. Add a small buffer so the next request is not sent too early.
        const providerRetrySeconds = retryMatch ? Math.max(1, Math.ceil(Number(retryMatch[1]))) : 60;
        const retrySeconds = providerRetrySeconds + 15;
        return NextResponse.json(
          {
            success: false,
            error: `Batas penggunaan sementara tercapai pada pemeriksaan terakhir. Tunggu sekitar ${retrySeconds} detik, lalu coba lagi. Jika penolakan berlanjut, quota proyek masih penuh karena perhitungannya menggunakan window berjalan.`,
            retryAfterSeconds: retrySeconds,
          },
          {
            status: 429,
            headers: { 'Retry-After': String(retrySeconds) },
          },
        );
      }

      console.error('[OCR] Gemini request failed:', message || err);
      return NextResponse.json(
        {
          success: false,
          errorCode: apiError.code === 401 || apiError.code === 403
            ? 'API_KEY'
            : apiError.code === 400 || apiError.code === 404 ? 'MODEL_UNAVAILABLE' : 'PROVIDER',
          error: apiError.code === 401 || apiError.code === 403
            ? 'Konfigurasi akses layanan ekstraksi ditolak atau tidak memiliki izin. Periksa pengaturan server.'
            : apiError.code === 400 || apiError.code === 404
              ? `Model ${GEMINI_OCR_MODELS.find((model) => model.id === selectedModel)?.label || selectedModel} tidak tersedia untuk API key ini. Pilih model lain pada Mode Ekstraksi Data.`
              : `Layanan ekstraksi gagal memproses dokumen${message ? `: ${message.slice(0, 240)}` : '. Silakan coba lagi.'}`,
        },
        { status: 502 },
      );
    }

    const outputText = response.text || "{}";
    
    let parsedData = {};
    try {
        parsedData = JSON.parse(outputText);
    } catch (e) {
        console.error("Failed to parse Gemini output:", outputText);
        return NextResponse.json({ success: false, error: 'Hasil ekstraksi tidak dapat dibaca. Coba ulangi dokumen tersebut.' }, { status: 500 });
    }

    // Hanya ambil field yang valid sesuai mcu-fields.ts
    const validData: Record<string, string> = {};
    const normalizeKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const fieldAliases = new Map<string, string>();
    for (const field of MCU_FIELDS) {
      fieldAliases.set(normalizeKey(field.id), field.id);
      fieldAliases.set(normalizeKey(field.label), field.id);
    }
    fieldAliases.set('hbsag', 'hbsag');
    fieldAliases.set('hbsagresult', 'hbsag');
    fieldAliases.set('hemoglobin', 'hb');
    fieldAliases.set('hemoglobinhb', 'hb');
    fieldAliases.set('whitebloodcell', 'leukosit');
    fieldAliases.set('whitebloodcells', 'leukosit');
    fieldAliases.set('wbc', 'leukosit');
    fieldAliases.set('redbloodcell', 'eritrosit');
    fieldAliases.set('redbloodcells', 'eritrosit');
    fieldAliases.set('rbc', 'eritrosit');
    fieldAliases.set('platelet', 'trombosit');
    fieldAliases.set('platelets', 'trombosit');
    fieldAliases.set('plt', 'trombosit');
    fieldAliases.set('hematocrit', 'hematokrit');
    fieldAliases.set('mcv', 'mcv');
    fieldAliases.set('mch', 'mch');
    fieldAliases.set('mchc', 'mchc');
    fieldAliases.set('esr', 'led');
    
    for (const [k, v] of Object.entries(parsedData)) {
        const fieldId = fieldAliases.get(normalizeKey(k));
        if (fieldId && fieldId !== 'catatan' && v !== null && v !== undefined) {
            const value = Array.isArray(v) ? v.map(String).join(' | ') : String(v);
            validData[fieldId] = /^n\/a|null$/i.test(value.trim()) ? '' : value;
        }
    }
    if (validData.jenisKelamin) {
      const gender = validData.jenisKelamin.toLowerCase();
      validData.jenisKelamin = gender.includes('perem') || gender.includes('wanita') || gender.includes('female')
        ? 'Perempuan'
        : gender.includes('laki') || gender.includes('pria') || gender.includes('male')
          ? 'Laki - Laki'
          : validData.jenisKelamin;
    }
    if (validData.statusMCU) {
      const status = validData.statusMCU.toLowerCase();
      const match = status.includes('follow') && status.includes('pre') ? 'Follow Up - Pre Employee'
        : status.includes('follow') && status.includes('annual') ? 'Follow Up - Annual'
          : status.includes('pre') ? 'Pre Employee'
            : status.includes('annual') || status.includes('tahunan') ? 'Annual'
              : status.includes('specific') || status.includes('khusus') ? 'Specific'
                : status.includes('retirement') || status.includes('pensiun') ? 'Retirement'
                : ['Pre Employee', 'Annual', 'Specific', 'Retirement', 'Follow Up - Pre Employee', 'Follow Up - Annual'].includes(validData.statusMCU)
                  ? validData.statusMCU
                  : '';
      validData.statusMCU = match;
    }
    const conclusionOptions = MCU_FIELDS.find((field) => field.id === 'kesVendor')?.options || [];
    const normalizeConclusion = (value: string) => {
      const conclusion = value.toLowerCase();
      const normalized = conclusion.includes('restriction') || conclusion.includes('pembatasan')
        ? 'Fit With Restriction'
        : conclusion.includes('currently unfit') || conclusion.includes('tidak layak saat ini')
          ? 'Currently Unfit'
          : conclusion.includes('temporary') || conclusion.includes('sementara')
            ? 'Temporary Unfit'
            : conclusion.includes('unfit') || conclusion.includes('tidak layak')
              ? 'Unfit'
              : conclusion.includes('note') || conclusion.includes('catatan')
                ? 'Fit With Note'
                : conclusion.includes('fit to work') || conclusion.includes('layak kerja')
                ? 'Fit To Work'
                  : conclusionOptions.includes(value) ? value : '';
      return normalized;
    };
    for (const conclusionField of ['kesVendor', 'rekQSHE', 'kesimpulanFU1', 'kesimpulanFU2', 'kesimpulanFU3']) {
      if (validData[conclusionField]) {
        validData[conclusionField] = normalizeConclusion(validData[conclusionField]);
      }
    }
    if (validData.rekFU) {
      const recommendations = validData.rekFU.split(' | ').map((value) => value.trim());
      const options = MCU_FIELDS.find((field) => field.id === 'rekFU')?.options || [];
      const mappedRecommendations = recommendations.flatMap((recommendation) => {
        const normalized = recommendation.toLowerCase();
        const exact = options.find((option) => option.toLowerCase() === normalized);
        if (exact) return [exact];
        const mapped: string[] = [];
        if (/penyakit dalam|sp\.?\s*pd|internis/i.test(recommendation)) mapped.push('Dokter Sp. PD');
        if (/kardio|jantung|sp\.?\s*jp/i.test(recommendation)) mapped.push('Dokter Sp. JP');
        if (/paru|pulmon|sp\.?\s*p\b/i.test(recommendation)) mapped.push('Dokter Sp. P');
        if (/dokter umum|general practitioner/i.test(recommendation)) mapped.push('Dokter Umum');
        if (/gigi|dental/i.test(recommendation)) mapped.push('Dokter Gigi');
        if (/diet|olahraga|aktivitas fisik|penurunan berat badan|berat badan ideal/i.test(recommendation)) {
          mapped.push('Pertahankan Kondisi Tubuh Bugar Dengan Diet Sehat & Rutin Olahraga');
        }
        return mapped;
      });
      validData.rekFU = [...new Set(mappedRecommendations)].join(' | ');
    }
    if (validData.golDarah) {
      const blood = validData.golDarah.toUpperCase().replace(/\s+/g, ' ');
      const group = blood.match(/\b(A B|AB|A|B|O)\b/)?.[1]?.replace('A B', 'AB');
      const rhesus = /NEGATIF|NEGATIVE|\(-\)|\bRH-\b/.test(blood) ? '-' : /POSITIF|POSITIVE|\(\+\)|\+|\bRH\+?\b/.test(blood) ? '+' : '';
      if (group && rhesus) validData.golDarah = `${group}${rhesus}`;
    }

    return NextResponse.json({ success: true, data: validData });

  } catch (err: unknown) {
    console.error('Error in OCR API:', err);
    const message = err instanceof Error ? err.message : '';
    return NextResponse.json({
      success: false,
      errorCode: 'SERVER',
      error: message ? `Server OCR gagal: ${message}` : 'Server OCR mengalami kesalahan tak terduga.',
    }, { status: 500 });
  }
}
