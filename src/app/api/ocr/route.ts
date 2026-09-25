import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { MCU_FIELDS } from '@/lib/mcu-fields';

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
2. Gunakan "N/A" hanya jika pemeriksaan memang tidak dilakukan atau dokumen menyatakan N/A. Jangan gunakan N/A hanya karena pembacaan AI gagal.
3. Hasil pemeriksaan normal ditulis "DBN" jika field tersebut adalah pemeriksaan kualitatif.
4. Jangan menambahkan satuan pada nilai laboratorium atau angka spirometri. Simpan angka saja.
5. Gunakan koma untuk desimal. Untuk hasil laboratorium dengan satuan ribuan, normalkan ke satuan ribuan tanpa nol yang tidak perlu: "8.900" menjadi "8,9", "9.030" menjadi "9,03". Jangan menambahkan "000".
6. Jangan mengubah nilai medis, membulatkan secara bebas, atau membuat diagnosis yang tidak tertulis.
7. Output HARUS valid JSON tanpa awalan markdown seperti \`\`\`json.
8. Key JSON harus menggunakan ID field yang persis sama.
9. Jangan mengisi field "catatan". Field tersebut khusus input manual.
10. "Pemeriksaan Lain" hanya berisi pemeriksaan yang tidak termasuk daftar field pemeriksaan lain pada form.
11. "rekFU" harus berisi isi kolom DJ spreadsheet secara verbatim, bukan rekomendasi baru dari AI.
12. "itemFU" harus berisi isi kolom DK spreadsheet secara verbatim, bukan ringkasan baru dari AI.
13. "kesVendor" harus mengambil kesimpulan vendor dari kolom DF/dokumen, dengan pilihan yang sesuai:
    Fit To Work, Fit With Note, Fit With Restriction, Currently Unfit, Temporary Unfit, atau Unfit.
14. "perluFU" harus mengambil nilai Ya/Tidak dari dokumen. Jangan menyimpulkan hanya dari adanya abnormalitas.
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
   ACR adalah telinga kanan dan ACL telinga kiri. Nilai frekuensi yang tidak diperiksa diisi "N/A" hanya jika dokumen menyatakan tidak dilakukan.
19. Normalisasi identitas: Laki-laki/Pria menjadi "Laki - Laki"; Perempuan/Wanita menjadi "Perempuan".
20. Status MCU harus mengikuti nilai yang benar-benar tertulis di dokumen, termasuk "Pre - Employee", "Annual", dan jenis lain yang tersedia pada form.
`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { text } = body;

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Teks OCR kosong' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'GEMINI_API_KEY tidak dikonfigurasi' }, { status: 500 });
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

    // Gunakan Gemini 3.6 Flash dengan mekanisme Auto-Retry (Max 3x)
    let response;
    let retries = 3;
    let lastError;

    for (let i = 0; i < retries; i++) {
      try {
        response = await ai.models.generateContent({
            model: 'gemini-3.6-flash',
            contents: [
                { role: 'user', parts: parts }
            ],
            config: {
                systemInstruction: generatePromptSchema(),
                responseMimeType: "application/json",
                temperature: 0.1, // Low temp for more deterministic extraction
            }
        });
        break; // Berhasil, keluar dari loop
      } catch (err: any) {
        lastError = err;
        console.warn(`[OCR] Gemini API error (Attempt ${i + 1}/${retries}):`, err.message);
        if (i === retries - 1) break; // Jangan tunggu di percobaan terakhir
        
        // Jeda 2 detik sebelum mencoba ulang
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    if (!response) {
      throw lastError || new Error("Gagal menghubungi server AI setelah beberapa kali percobaan.");
    }

    const outputText = response.text || "{}";
    
    let parsedData = {};
    try {
        parsedData = JSON.parse(outputText);
    } catch (e) {
        console.error("Failed to parse Gemini output:", outputText);
        return NextResponse.json({ success: false, error: 'Gagal memformat hasil AI ke JSON' }, { status: 500 });
    }

    // Hanya ambil field yang valid sesuai mcu-fields.ts
    const validData: Record<string, string> = {};
    const validKeys = new Set(MCU_FIELDS.map(f => f.id));
    
    for (const [k, v] of Object.entries(parsedData)) {
        if (validKeys.has(k) && k !== 'catatan' && v !== null && v !== undefined) {
            validData[k] = String(v);
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
      const match = status.includes('pre') ? 'Pre - Employee'
        : status.includes('annual') || status.includes('tahunan') ? 'Annual'
          : status.includes('resmi') ? 'Resmi'
            : status.includes('khusus') ? 'Khusus'
              : status.includes('lain') ? 'Lainnya' : validData.statusMCU;
      validData.statusMCU = match;
    }
    if (validData.golDarah) {
      const blood = validData.golDarah.toUpperCase().replace(/\s+/g, ' ');
      const group = blood.match(/\b(A B|AB|A|B|O)\b/)?.[1]?.replace('A B', 'AB');
      const rhesus = /NEGATIF|NEGATIVE|\(-\)|\bRH-\b/.test(blood) ? '-' : /POSITIF|POSITIVE|\(\+\)|\+|\bRH\+?\b/.test(blood) ? '+' : '';
      if (group && rhesus) validData.golDarah = `${group}${rhesus}`;
    }

    return NextResponse.json({ success: true, data: validData });

  } catch (err: any) {
    console.error('Error in OCR API:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
