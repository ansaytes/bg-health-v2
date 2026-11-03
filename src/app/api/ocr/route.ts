import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { GoogleGenAI } from '@google/genai';
import { MCU_FIELDS } from '@/lib/mcu-fields';
import { decryptIntegrationSecret, integrationAdminClient, readIntegration } from '@/lib/integration-settings';
import { getServerCaller, requireServerRole, STAFF_ROLES } from '@/lib/server-auth';

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
22. Jangan mengekstrak atau mengembalikan NIK KTP, NIK karyawan, nama, usia, jenis kelamin, jabatan, atau site. Identitas dan demografi diisi aplikasi dari karyawan yang dipilih, bukan dari dokumen.
23. Normalisasi kesimpulan vendor berbahasa Indonesia ke opsi terdekat: "Fit dengan Catatan" menjadi "Fit With Note", "Fit dengan Pembatasan" menjadi "Fit With Restriction", "Tidak Layak Sementara" menjadi "Temporary Unfit", dan "Tidak Layak" menjadi "Unfit".
24. Status MCU berbeda dari Kesimpulan Vendor. Jangan mengisi statusMCU dengan "Fit With Note" atau kesimpulan kelayakan kerja.
25. Rekomendasi Follow Up yang menyebut dokter spesialis penyakit dalam dipetakan ke "Dokter Sp. PD"; saran diet/olahraga dipetakan ke opsi gaya hidup yang tersedia. Gunakan beberapa opsi bila beberapa tindakan jelas tertulis.
26. Catatan Tambahan hanya boleh merangkum abnormalitas dan saran yang tercetak dalam dokumen. Jangan menyimpulkan diagnosis atau rekomendasi baru.
27. Bila eGFR tidak tercantum, biarkan field egfr kosong. Aplikasi boleh menghitung estimasi CKD-EPI 2021 dari kreatinin serum, usia, dan jenis kelamin; jangan memperkirakan eGFR dari ureum.
28. Untuk hbsag, antiHbs, vdrl, tpha, dan hiv: "Negatif"/"Negative" menjadi "Non - Reaktif"; "Positif"/"Positive" menjadi "Reaktif".
29. Untuk defWarna dan semua field Neurologi (balance, romberg, phalen, thinel, patrick, kontraPatrick, laseque, kernig), "DBN" menjadi "Normal". Hasil positif/negatif Neurologi ditulis "Positif"/"Negatif".
`;
}

export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    const denied = requireServerRole(caller, STAFF_ROLES);
    if (denied) return denied;
    const identifierHash = crypto.createHash('sha256').update(`ocr:${caller!.userId}`).digest('hex');
    const { data: allowed, error: rateLimitError } = await integrationAdminClient().rpc('consume_login_attempt', {
      p_identifier_hash: identifierHash,
      p_limit: 20,
      p_window_seconds: 3600,
    });
    if (rateLimitError) {
      console.error('[OCR] Persistent rate limit check failed:', rateLimitError.code);
      return NextResponse.json({ success: false, error: 'Pembatasan penggunaan belum tersedia.' }, { status: 503 });
    }
    if (allowed !== true) {
      return NextResponse.json(
        { success: false, error: 'Batas penggunaan OCR tercapai. Coba kembali dalam satu jam.' },
        { status: 429, headers: { 'Retry-After': '3600' } },
      );
    }
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > 4_000_000) {
      return NextResponse.json({ success: false, error: 'Ukuran gambar hasil penyamaran melebihi batas.' }, { status: 413 });
    }
    const requestBody = await req.text();
    if (Buffer.byteLength(requestBody, 'utf8') > 4_000_000) {
      return NextResponse.json({ success: false, error: 'Ukuran gambar hasil penyamaran melebihi batas.' }, { status: 413 });
    }
    let body: unknown;
    try {
      body = JSON.parse(requestBody);
    } catch {
      return NextResponse.json({ success: false, error: 'Permintaan OCR tidak valid.' }, { status: 400 });
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'Permintaan OCR tidak valid.' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    if (Object.keys(input).some((key) => !['images', 'modelId'].includes(key))) {
      return NextResponse.json({ success: false, error: 'Endpoint OCR hanya menerima gambar hasil penyamaran.' }, { status: 400 });
    }
    const { modelId } = input;
    const rawImages = input.images;
    if (!Array.isArray(rawImages) || rawImages.length < 1 || rawImages.length > 30) {
      return NextResponse.json({ success: false, error: 'Kirim 1 sampai 30 gambar halaman yang sudah disamarkan.' }, { status: 400 });
    }
    const images: Array<{ data: string; mimeType: string }> = [];
    let totalImageChars = 0;
    for (const rawImage of rawImages) {
      if (typeof rawImage !== 'string') {
        return NextResponse.json({ success: false, error: 'Format gambar hasil penyamaran tidak valid.' }, { status: 400 });
      }
      const match = rawImage.match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/);
      if (!match || match[2].length > 1_500_000) {
        return NextResponse.json({ success: false, error: 'Gambar harus berupa JPEG atau PNG hasil penyamaran.' }, { status: 400 });
      }
      totalImageChars += match[2].length;
      if (totalImageChars > 3_600_000) {
        return NextResponse.json({ success: false, error: 'Ukuran gambar hasil penyamaran melebihi batas.' }, { status: 413 });
      }
      images.push({ mimeType: match[1], data: match[2] });
    }
    const promptText = `Ekstrak hasil pemeriksaan MCU dari ${images.length} gambar halaman terlampir. Identitas telah dipilih terpisah di aplikasi.`;

    const aiIntegration = await readIntegration('ai');
    const aiSecrets = decryptIntegrationSecret(aiIntegration?.secret_ciphertext ?? null);
    const provider = aiIntegration?.config.provider === 'openai-compatible' ? 'openai-compatible' : 'gemini';
    const savedApiKey = typeof aiSecrets.apiKey === 'string' ? aiSecrets.apiKey : '';
    const apiKey = savedApiKey;
    const configuredModel = typeof aiIntegration?.config.model === 'string' ? aiIntegration.config.model : '';
    const model = typeof modelId === 'string' && modelId.trim() ? modelId.trim() : configuredModel;
    if (modelId !== undefined && (typeof modelId !== 'string' || !modelId.trim() || modelId.length > 200)) {
      return NextResponse.json({ success: false, error: 'Model AI tidak valid.' }, { status: 400 });
    }
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'API key AI belum diatur pada menu Pengaturan > Integrasi.' }, { status: 503 });
    }
    if (!model) {
      return NextResponse.json({ success: false, error: 'Pilih dan simpan model AI yang tersedia di Pengaturan > Integrasi.' }, { status: 503 });
    }

    let outputText = '';
    if (provider === 'gemini') {
      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = images.map((image) => ({
        inlineData: image,
      }));
      parts.push({ text: promptText });
      try {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction: generatePromptSchema(),
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });
        outputText = response.text || '{}';
      } catch (error: unknown) {
        const apiError = error as { code?: number; status?: string; message?: string };
        const message = apiError.message || '';
        const isQuotaError = apiError.code === 429
          || apiError.status === 'RESOURCE_EXHAUSTED'
          || /quota exceeded|rate limit|resource_exhausted/i.test(message);
        if (isQuotaError) {
          return NextResponse.json(
            { success: false, error: 'Batas penggunaan sementara tercapai. Tunggu sebelum mencoba kembali.', retryAfterSeconds: 60 },
            { status: 429, headers: { 'Retry-After': '60' } },
          );
        }
        console.error('[OCR] Gemini request failed.');
        return NextResponse.json(
          {
            success: false,
            errorCode: apiError.code === 401 || apiError.code === 403 ? 'API_KEY' : 'PROVIDER',
            error: apiError.code === 401 || apiError.code === 403
              ? 'API key AI ditolak. Periksa pengaturan integrasi.'
              : 'Layanan ekstraksi gagal memproses dokumen.',
          },
          { status: 502 },
        );
      }
    } else {
      const baseUrl = typeof aiIntegration?.config.baseUrl === 'string' ? aiIntegration.config.baseUrl.replace(/\/+$/, '') : '';
      if (!baseUrl) return NextResponse.json({ success: false, error: 'Base URL AI belum diatur.' }, { status: 503 });
      const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
      const userContent: Array<Record<string, unknown>> = [{ type: 'text', text: promptText }];
      for (const image of images) {
        userContent.push({ type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.data}` } });
      }
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: generatePromptSchema() },
              { role: 'user', content: userContent },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(60_000),
          cache: 'no-store',
        });
        if (response.status === 429) {
          return NextResponse.json(
            { success: false, error: 'Batas penggunaan sementara tercapai. Tunggu sebelum mencoba kembali.', retryAfterSeconds: 60 },
            { status: 429, headers: { 'Retry-After': '60' } },
          );
        }
        if (!response.ok) {
          console.error('[OCR] OpenAI-compatible provider rejected a request:', response.status);
          return NextResponse.json({ success: false, error: 'Layanan AI menolak permintaan. Periksa endpoint, model, dan API key.' }, { status: 502 });
        }
        const result: unknown = await response.json();
        if (!result || typeof result !== 'object' || !('choices' in result) || !Array.isArray(result.choices)) {
          return NextResponse.json({ success: false, error: 'Respons layanan AI tidak valid.' }, { status: 502 });
        }
        const firstChoice = result.choices[0];
        outputText = firstChoice && typeof firstChoice === 'object'
          && 'message' in firstChoice && firstChoice.message && typeof firstChoice.message === 'object'
          && 'content' in firstChoice.message && typeof firstChoice.message.content === 'string'
          ? firstChoice.message.content : '';
      } catch {
        console.error('[OCR] OpenAI-compatible request failed.');
        return NextResponse.json({ success: false, error: 'Endpoint layanan AI tidak dapat dijangkau atau waktu permintaan habis.' }, { status: 502 });
      }
    }
    
    let parsedData = {};
    try {
        parsedData = JSON.parse(outputText);
    } catch {
        console.error('[OCR] Provider returned invalid JSON.');
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
        if (fieldId
          && !['nationalId', 'nikKaryawan', 'nama', 'usia', 'jenisKelamin', 'jabatan', 'site'].includes(fieldId)
          && fieldId !== 'catatan' && v !== null && v !== undefined) {
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
    if (validData.defWarna && /^dbn$/i.test(validData.defWarna.trim())) {
      validData.defWarna = 'Normal';
    }
    const serologyFields = ['hbsag', 'antiHbs', 'vdrl', 'tpha', 'hiv'];
    for (const fieldId of serologyFields) {
      const result = validData[fieldId]?.trim();
      if (!result) continue;
      if (/^(negatif|negative|non[\s-]*reaktif|non[\s-]*reactive)$/i.test(result)) {
        validData[fieldId] = 'Non - Reaktif';
      } else if (/^(positif|positive|reaktif|reactive)$/i.test(result)) {
        validData[fieldId] = 'Reaktif';
      }
    }
    const neurologicalFields = ['balance', 'romberg', 'phalen', 'thinel', 'patrick', 'kontraPatrick', 'laseque', 'kernig'];
    for (const fieldId of neurologicalFields) {
      if (validData[fieldId] && /^dbn$/i.test(validData[fieldId].trim())) {
        validData[fieldId] = 'Normal';
      }
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
    for (const conclusionField of ['kesVendor', 'rekQSHE']) {
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
