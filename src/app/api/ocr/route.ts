import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { MCU_FIELDS } from '@/lib/mcu-fields';

// Create a schema mapping dynamically from MCU_FIELDS
function generatePromptSchema() {
  const fieldsInfo = MCU_FIELDS.map(f => {
    return `- ${f.id} (${f.label}): Type ${f.type}, Section ${f.section}`;
  }).join('\n');

  return `
Kamu adalah asisten medis ahli dalam membaca data Medical Check Up (MCU).
Ekstrak teks MCU berikut ke dalam format JSON dengan key (kunci) yang sesuai dengan daftar ID field berikut:
${fieldsInfo}

Aturan:
1. Hanya kembalikan data yang ada/terdeteksi di dalam teks (tidak perlu mengembalikan semua key jika tidak ada nilainya).
2. Format angka sebagai string angka biasa (misal "120" bukan "120 mmHg").
3. Pastikan key JSON yang dikembalikan menggunakan ID yang persis sama.
4. Output HARUS valid JSON, tanpa awalan markdown seperti \`\`\`json.
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

    // Gunakan Gemini 2.5 Flash yang gratis dan cepat
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            { role: 'user', parts: parts }
        ],
        config: {
            systemInstruction: generatePromptSchema(),
            responseMimeType: "application/json",
            temperature: 0.1, // Low temp for more deterministic extraction
        }
    });

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
        if (validKeys.has(k) && v !== null && v !== undefined) {
            validData[k] = String(v);
        }
    }

    return NextResponse.json({ success: true, data: validData });

  } catch (err: any) {
    console.error('Error in OCR API:', err);
    return NextResponse.json({ success: false, error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
