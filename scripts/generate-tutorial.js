const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, PageNumber, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, PageBreak, TableOfContents,
} = require('docx');
const fs = require('fs');

// Palette: Swiss Tech
const P = {
  primary: "101820", body: "1E293B", secondary: "64748B",
  accent: "2563EB", surface: "F1F5F9", white: "FFFFFF",
  border: "CBD5E1", code: "F8FAFC", codeText: "334155",
};
const c = (hex) => hex.replace('#', '');

// Helpers
const allNoBorders = {
  top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 },
  insideHorizontal: { style: BorderStyle.NONE, size: 0 }, insideVertical: { style: BorderStyle.NONE, size: 0 },
};

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 480, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.primary) })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 360, after: 160 },
    children: [new TextRun({ text, bold: true, size: 28, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.primary) })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.accent) })] });
}
function p(text) {
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 140, line: 312 }, indent: { firstLine: 420 },
    children: [new TextRun({ text, size: 22, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.body) })] });
}
function emptyLine() { return new Paragraph({ spacing: { after: 80 }, children: [] }); }

function step(num, text) {
  return new Paragraph({ spacing: { after: 100, line: 312 }, indent: { left: 360 },
    children: [
      new TextRun({ text: `${num}. `, bold: true, size: 22, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.accent) }),
      new TextRun({ text, size: 22, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.body) }),
    ] });
}

function codeBlock(lines) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 1, color: c(P.border) }, bottom: { style: BorderStyle.SINGLE, size: 1, color: c(P.border) }, left: { style: BorderStyle.SINGLE, size: 1, color: c(P.border) }, right: { style: BorderStyle.SINGLE, size: 1, color: c(P.border) } },
    shading: { type: ShadingType.CLEAR, fill: c(P.code) },
    margins: { top: 80, bottom: 80, left: 160, right: 160 },
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: 100, type: WidthType.PERCENTAGE },
      children: [new Paragraph({ spacing: { line: 276 }, children: [new TextRun({ text: lines.join('\n'), size: 18, font: { name: 'Consolas', ascii: 'Consolas' }, color: c(P.codeText) })] })],
    })] })],
  });
}

function infoBox(title, text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.SINGLE, size: 12, color: c(P.accent) }, right: { style: BorderStyle.NONE } },
    shading: { type: ShadingType.CLEAR, fill: "EFF6FF" },
    margins: { top: 80, bottom: 80, left: 200, right: 160 },
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: 100, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: title, bold: true, size: 21, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.accent) })] }),
        new Paragraph({ spacing: { line: 300 }, children: [new TextRun({ text, size: 21, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.body) })] }),
      ],
    })] })],
  });
}

function warnBox(title, text) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.SINGLE, size: 12, color: "D97706" }, right: { style: BorderStyle.NONE } },
    shading: { type: ShadingType.CLEAR, fill: "FFFBEB" },
    margins: { top: 80, bottom: 80, left: 200, right: 160 },
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: 100, type: WidthType.PERCENTAGE },
      children: [
        new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: title, bold: true, size: 21, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: "D97706" })] }),
        new Paragraph({ spacing: { line: 300 }, children: [new TextRun({ text, size: 21, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.body) })] }),
      ],
    })] })],
  });
}

function simpleTable(headers, rows) {
  const colW = Math.floor(100 / headers.length);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.SINGLE, size: 2, color: c(P.border) }, bottom: { style: BorderStyle.SINGLE, size: 2, color: c(P.border) }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: c(P.border) }, insideVertical: { style: BorderStyle.NONE } },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: headers.map(h => new TableCell({
        width: { size: colW, type: WidthType.PERCENTAGE }, shading: { type: ShadingType.CLEAR, fill: c(P.surface) },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 21, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.primary) })] })],
      })) }),
      ...rows.map(row => new TableRow({ cantSplit: true, children: row.map(cell => new TableCell({
        width: { size: colW, type: WidthType.PERCENTAGE },
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({ children: [new TextRun({ text: cell, size: 21, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.body) })] })],
      })) })),
    ],
  });
}

// COVER
const coverChildren = [
  new Paragraph({ spacing: { before: 4000 }, children: [] }),
  new Paragraph({ spacing: { after: 400 }, indent: { left: 2400 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: c(P.accent), space: 8 } }, children: [new TextRun({ text: ' ', size: 4 })] }),
  new Paragraph({ spacing: { after: 160 }, indent: { left: 2400 }, children: [new TextRun({ text: 'TUTORIAL DEPLOY', size: 28, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.secondary), characterSpacing: 200 })] }),
  new Paragraph({ spacing: { after: 200 }, indent: { left: 2400 }, children: [new TextRun({ text: 'QSHE Department', bold: true, size: 52, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.primary) })] }),
  new Paragraph({ spacing: { after: 600 }, indent: { left: 2400 }, children: [new TextRun({ text: 'GitHub \u00D7 Supabase \u00D7 Vercel', size: 30, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.accent) })] }),
  new Paragraph({ spacing: { after: 120 }, indent: { left: 2400 }, children: [new TextRun({ text: 'PT. BAGONG DEKAKA MAKMUR', size: 24, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.secondary) })] }),
  new Paragraph({ indent: { left: 2400 }, children: [new TextRun({ text: 'Agustus 2026', size: 22, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.secondary) })] }),
];

const coverTable = new Table({
  width: { size: 100, type: WidthType.PERCENTAGE },
  borders: allNoBorders,
  rows: [new TableRow({
    height: { value: 16838, rule: 'exact' },
    children: [new TableCell({
      width: { size: 100, type: WidthType.PERCENTAGE },
      verticalAlign: 'top',
      borders: allNoBorders,
      children: coverChildren,
    })],
  })],
});

const coverSection = {
  properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
  children: [coverTable],
};

// TOC
const tocSection = {
  properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 } } },
  headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Tutorial Deploy QSHE Department', size: 18, font: { ascii: 'Calibri' }, color: c(P.secondary), italics: true })] })] }) },
  footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Halaman ', size: 18, font: { ascii: 'Calibri' }, color: c(P.secondary) }), new TextRun({ children: [PageNumber.CURRENT], size: 18, font: { ascii: 'Calibri' }, color: c(P.secondary) })] })] }) },
  children: [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 480, after: 360 }, children: [new TextRun({ text: 'Daftar Isi', bold: true, size: 32, font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, color: c(P.primary) })] }),
    new TableOfContents('Daftar Isi', { hyperlink: true, headingStyleRange: '1-3' }),
    new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Catatan: Klik kanan pada Daftar Isi lalu pilih \"Update Field\" untuk memperbarui nomor halaman.', italics: true, size: 18, color: '888888' })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ],
};

// BODY
const hdrFtr = {
  headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'Tutorial Deploy QSHE Department', size: 18, font: { ascii: 'Calibri' }, color: c(P.secondary), italics: true })] })] }) },
  footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Halaman ', size: 18, font: { ascii: 'Calibri' }, color: c(P.secondary) }), new TextRun({ children: [PageNumber.CURRENT], size: 18, font: { ascii: 'Calibri' }, color: c(P.secondary) })] })] }) },
};

const bodySection = { ...hdrFtr,
  properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 }, pageNumbers: { start: 1 } } },
  children: [
    h1('1. Prasyarat'),
    p('Sebelum memulai proses deploy, pastikan semua persyaratan berikut sudah terpenuhi. Tutorial ini mengasumsikan kamu menggunakan sistem operasi Windows atau macOS dengan koneksi internet yang stabil.'),
    h2('1.1 Akun yang Dibutuhkan'),
    p('Kamu memerlukan tiga akun gratis dari layanan berikut. Jika belum punya, daftar terlebih dahulu melalui link yang disediakan.'),
    simpleTable(['Layanan', 'URL Pendaftaran', 'Fungsi'], [
      ['GitHub', 'https://github.com/signup', 'Version control dan hosting kode sumber'],
      ['Supabase', 'https://supabase.com/signup', 'Database PostgreSQL + Backend-as-a-Service'],
      ['Vercel', 'https://vercel.com/signup', 'Hosting frontend + API routes + Cron Jobs'],
    ]),
    emptyLine(),
    h2('1.2 Software yang Dibutuhkan'),
    simpleTable(['Software', 'Versi Minimum', 'URL Download'], [
      ['Node.js', 'v18.x atau lebih baru', 'https://nodejs.org'],
      ['Git', 'v2.x atau lebih baru', 'https://git-scm.com/downloads'],
      ['VS Code (opsional)', 'Latest', 'https://code.visualstudio.com'],
    ]),
    emptyLine(),
    infoBox('Tip: Cek Instalasi', 'Setelah menginstall Node.js dan Git, buka terminal lalu jalankan perintah berikut untuk memastikan keduanya terinstall dengan benar:'),
    emptyLine(),
    codeBlock(['node --version    # harus menampilkan v18.x atau lebih baru', 'git --version     # harus menampilkan 2.x atau lebih baru', 'npm --version     # harus menampilkan 9.x atau lebih baru']),
    emptyLine(),
    h2('1.3 Source Code Project'),
    p('Pastikan kamu sudah memiliki source code terbaru project QSHE Department dalam format zip (QSHE-App-sourcecode-v3.zip). File ini berisi seluruh kode sumber termasuk konfigurasi Supabase, schema database, dan API routes yang sudah siap digunakan.'),

    h1('2. Setup GitHub Repository'),
    p('GitHub berfungsi sebagai version control system yang menyimpan seluruh kode sumber project. Selain itu, GitHub juga menjadi penghubung utama antara kode yang kamu tulis dengan Vercel yang akan men-deploy-nya secara otomatis.'),
    h2('2.1 Membuat Repository Baru'),
    step(1, 'Buka browser dan navigasi ke https://github.com. Login menggunakan akun GitHub yang sudah didaftarkan.'),
    step(2, 'Klik tombol \"+\" di pojok kanan atas, lalu pilih \"New repository\".'),
    step(3, 'Isi form pembuatan repository berikut:'),
    emptyLine(),
    simpleTable(['Field', 'Nilai yang Diisi'], [
      ['Repository name', 'qshe-department'],
      ['Description', 'QSHE Department Dashboard - PT. BAGONG DEKAKA MAKMUR'],
      ['Visibility', 'Private (direkomendasikan untuk internal app)'],
      ['README', 'Jangan dicentang (karena sudah ada di project)'],
      ['.gitignore', 'Jangan dicentang (sudah ada di source code)'],
      ['License', 'None'],
    ]),
    emptyLine(),
    step(4, 'Klik \"Create repository\". GitHub akan menampilkan halaman setup untuk repository kosong.'),
    emptyLine(),
    h2('2.2 Upload Source Code ke GitHub'),
    p('Setelah membuat repository, langkah selanjutnya adalah mengupload source code project. Ada dua metode yang bisa digunakan: melalui Git CLI atau melalui browser.'),
    h3('Metode A: Menggunakan Git CLI (Direkomendasikan)'),
    p('Ekstrak file zip QSHE-App-sourcecode-v3.zip ke folder yang diinginkan. Kemudian buka terminal di folder tersebut dan jalankan perintah berikut secara berurutan:'),
    emptyLine(),
    codeBlock(['# Masuk ke folder project (sesuaikan path-nya)', 'cd /path/ke/qshe-department', '', '# Inisialisasi Git', 'git init', '', '# Tambahkan semua file ke staging', 'git add .', '', '# Commit pertama', 'git commit -m "Initial commit: QSHE Department Dashboard"', '', '# Tambahkan remote origin (ganti USERNAME)', 'git remote add origin https://github.com/USERNAME/qshe-department.git', '', '# Rename branch ke main', 'git branch -M main', '', '# Push ke GitHub', 'git push -u origin main']),
    emptyLine(),
    h3('Metode B: Upload via Browser (Lebih Simpel)'),
    p('Jika belum familiar dengan Git CLI, kamu bisa mengupload langsung melalui browser. Namun metode ini tidak direkomendasikan untuk jangka panjang karena tidak memungkinkan update yang mudah.'),
    step(1, 'Di halaman repository GitHub yang baru dibuat, klik link \"uploading an existing file\".'),
    step(2, 'Drag dan drop seluruh isi folder project ke area upload.'),
    step(3, 'Klik \"Commit changes\" untuk mengupload semua file.'),
    emptyLine(),
    warnBox('Penting', 'Pastikan file .gitignore sudah ada di folder project sebelum melakukan git add. File ini memastikan file-file sensitif (seperti .env) dan file yang tidak perlu (seperti node_modules, upload, download) tidak ikut terupload ke GitHub.'),
    emptyLine(),
    h2('2.3 Verifikasi Upload'),
    p('Setelah push berhasil, refresh halaman repository di browser. Kamu harus bisa melihat seluruh file project di GitHub. Pastikan struktur folder sudah benar: folder src/, public/, file supabase-schema.sql, vercel.json, .env.example, dan lain-lain.'),

    h1('3. Setup Supabase'),
    p('Supabase adalah Backend-as-a-Service yang menyediakan database PostgreSQL, autentikasi, storage, dan realtime subscriptions. Untuk project QSHE Department, Supabase digunakan sebagai database utama yang menyimpan data karyawan, man power, absensi sakit, kunjungan berobat, serta KPI yang dihitung otomatis melalui SQL views.'),
    h2('3.1 Membuat Project Supabase'),
    step(1, 'Buka https://supabase.com/dashboard dan login menggunakan akun yang sudah didaftarkan.'),
    step(2, 'Klik tombol \"New Project\" di halaman dashboard.'),
    step(3, 'Isi form pembuatan project:'),
    emptyLine(),
    simpleTable(['Field', 'Nilai yang Diisi'], [
      ['Name', 'qshe-department'],
      ['Database Password', 'Buat password yang kuat (MINIMAL 8 karakter, simpan baik-baik)'],
      ['Region', 'Southeast Asia (Singapore)'],
      ['Plan', 'Free (sudah cukup untuk mulai)'],
    ]),
    emptyLine(),
    warnBox('Simpan Password Database!', 'Password database ini dibutuhkan saat koneksi dari tool eksternal. Jangan sampai lupa karena tidak bisa di-reset dengan mudah. Simpan di password manager atau tempat yang aman.'),
    emptyLine(),
    step(4, 'Klik \"Create new project\" dan tunggu proses provisioning selesai (biasanya 1-2 menit).'),
    emptyLine(),
    h2('3.2 Menjalankan Schema Database'),
    p('Setelah project Supabase siap, langkah selanjutnya adalah membuat tabel-tabel database. Seluruh schema sudah disediakan dalam file supabase-schema.sql yang ada di repository.'),
    step(1, 'Di sidebar kiri dashboard Supabase, klik menu \"SQL Editor\".'),
    step(2, 'Klik tombol \"+ New query\" untuk membuat query baru.'),
    step(3, 'Buka file supabase-schema.sql dari repository. Salin seluruh isinya.'),
    step(4, 'Tempelkan seluruh kode SQL ke editor di Supabase SQL Editor.'),
    step(5, 'Klik tombol \"Run\" (atau tekan Ctrl+Enter) untuk menjalankan seluruh schema.'),
    step(6, 'Pastikan tidak ada error. Jika berhasil, akan muncul pesan \"Success\" di panel output.'),
    emptyLine(),
    infoBox('Yang Dibuat oleh Schema', 'Schema SQL akan membuat 4 tabel (employees, man_power, absensi_sakit, kunjungan_berobat), 6 index untuk optimasi query, 6 views untuk KPI dashboard (v_kpi_per_site, v_kpi_all_site, v_top_asr, v_sick_list, v_rujuk_rs), trigger auto-update updated_at, dan konfigurasi RLS dalam komentar yang siap diaktifkan untuk production.'),
    emptyLine(),
    h2('3.3 Mendapatkan API Keys'),
    p('API keys diperlukan agar aplikasi Next.js bisa terhubung ke Supabase. Berikut langkah-langkah untuk mendapatkannya:'),
    step(1, 'Di dashboard Supabase, klik menu \"Project Settings\" (ikon gear di sidebar kiri bawah).'),
    step(2, 'Pilih tab \"API\".'),
    step(3, 'Catat dua nilai berikut:'),
    emptyLine(),
    simpleTable(['Parameter', 'Contoh Nilai', 'Keterangan'], [
      ['Project URL', 'https://xxxxx.supabase.co', 'URL endpoint project Supabase'],
      ['Anon (public) Key', 'eyJhbGciOiJIUzI1NiIs...', 'Key untuk akses publik (aman karena dilindungi RLS)'],
    ]),
    emptyLine(),
    warnBox('Keamanan API Key', 'Anon key aman digunakan di sisi klien (browser) karena akses data masih dibatasi oleh Row Level Security (RLS). Jangan pernah menggunakan Service Role Key di sisi klien karena key tersebut memiliki akses penuh ke seluruh data tanpa batasan RLS.'),
    emptyLine(),
    h2('3.4 Verifikasi Tabel'),
    p('Untuk memastikan seluruh tabel sudah terbuat dengan benar, klik menu \"Table Editor\" di sidebar kiri. Kamu harus bisa melihat 4 tabel: employees, man_power, absensi_sakit, dan kunjungan_berobat. Klik masing-masing tabel untuk memastikan kolom-kolom sudah sesuai dengan schema.'),

    h1('4. Setup Vercel'),
    p('Vercel adalah platform hosting yang akan menjalankan aplikasi Next.js secara online. Vercel secara otomatis mendeteksi framework Next.js, melakukan build, dan mendistribusikan aplikasi ke CDN global. Setiap kali ada push ke branch main di GitHub, Vercel akan otomatis melakukan build ulang dan men-deploy versi terbaru.'),
    h2('4.1 Menghubungkan GitHub dengan Vercel'),
    step(1, 'Buka https://vercel.com dan login. Disarankan login menggunakan akun GitHub (klik \"Continue with GitHub\") agar proses otomatis lebih mudah.'),
    step(2, 'Di dashboard Vercel, klik tombol \"Add New\" lalu pilih \"Project\".'),
    step(3, 'Pada bagian \"Import Git Repository\", cari dan pilih repository \"qshe-department\" yang sudah dibuat di GitHub.'),
    step(4, 'Jika repository tidak muncul, klik \"Adjust GitHub App Permissions\" dan berikan akses Vercel ke repository tersebut.'),
    step(5, 'Di halaman konfigurasi project, biarkan semua setting default. Pastikan Framework Preset menampilkan \"Next.js\".'),
    step(6, 'Sebelum klik Deploy, tambahkan Environment Variables terlebih dahulu (lihat bagian 4.2).'),
    emptyLine(),
    h2('4.2 Konfigurasi Environment Variables'),
    p('Environment variables adalah konfigurasi sensitif yang tidak disimpan dalam kode sumber. Di Vercel, ini dikonfigurasi melalui dashboard. Klik bagian \"Environment Variables\" pada halaman konfigurasi project, lalu tambahkan variabel berikut:'),
    emptyLine(),
    simpleTable(['Key', 'Value', 'Keterangan'], [
      ['NEXT_PUBLIC_SUPABASE_URL', 'https://xxxxx.supabase.co', 'Project URL dari Supabase (Bagian 3.3)'],
      ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIs...', 'Anon Key dari Supabase (Bagian 3.3)'],
      ['GOOGLE_SHEETS_CSV_URL', 'https://docs.google.com/...', 'URL export CSV Google Sheets (Bagian 5)'],
    ]),
    emptyLine(),
    infoBox('Environment Variables', 'Variabel dengan prefix NEXT_PUBLIC_ akan tersedia di sisi klien (browser). Variabel tanpa prefix hanya tersedia di sisi server (API routes). Untuk keamanan, kredensial sensitif tidak boleh menggunakan prefix NEXT_PUBLIC_.'),
    emptyLine(),
    h2('4.3 Deploy Pertama'),
    step(1, 'Setelah environment variables ditambahkan, klik tombol \"Deploy\".'),
    step(2, 'Vercel akan menjalankan proses build (download dependencies, compile Next.js, optimize assets). Proses ini membutuhkan waktu sekitar 1-3 menit.'),
    step(3, 'Jika build berhasil, Vercel akan menampilkan pesan sukses beserta URL deployment, misalnya: https://qshe-department-xxx.vercel.app.'),
    step(4, 'Klik URL tersebut untuk membuka aplikasi di browser dan memastikan semuanya berjalan normal.'),
    emptyLine(),
    h2('4.4 Custom Domain (Opsional)'),
    p('Jika ingin menggunakan domain kustom (misalnya qshe.bagong.co.id), kamu bisa mengaturnya melalui menu \"Settings > Domains\" di dashboard Vercel. Tambahkan domain yang diinginkan, lalu konfigurasi DNS record di provider domain sesuai instruksi yang diberikan Vercel.'),

    h1('5. Setup Google Sheets Sync'),
    p('Data master karyawan (6.227 record) disimpan di Google Spreadsheet. Agar data ini otomatis tersinkronisasi ke Supabase, spreadsheet perlu dipublish dan URL-nya dikonfigurasi di Vercel.'),
    h2('5.1 Publish Spreadsheet'),
    step(1, 'Buka Google Spreadsheet yang berisi data karyawan di browser.'),
    step(2, 'Klik menu \"File\" di pojok kiri atas.'),
    step(3, 'Pilih \"Share\" lalu klik \"Publish to web\".'),
    step(4, 'Pada dialog yang muncul, pastikan: Embed = Entire Document, Sheet = Data Karyawan, Format = Web page.'),
    step(5, 'Klik \"Publish\" dan konfirmasi dengan mengklik \"OK\".'),
    step(6, 'Salin URL yang muncul. Formatnya: https://docs.google.com/spreadsheets/d/xxxxx/pub?output=csv'),
    emptyLine(),
    h2('5.2 Konfigurasi URL di Vercel'),
    step(1, 'Buka dashboard Vercel, masuk ke project qshe-department.'),
    step(2, 'Pergi ke \"Settings > Environment Variables\".'),
    step(3, 'Edit variabel GOOGLE_SHEETS_CSV_URL dengan URL yang sudah disalin.'),
    step(4, 'Klik \"Save\". Vercel akan melakukan redeploy otomatis.'),
    emptyLine(),
    h2('5.3 Menjalankan Sync Pertama'),
    p('Setelah URL dikonfigurasi, jalankan sync pertama melalui terminal:'),
    emptyLine(),
    codeBlock(['curl -X POST https://qshe-department-xxx.vercel.app/api/sync-employees']),
    emptyLine(),
    p('Respons yang diharapkan berupa JSON dengan stats: csv_rows, upserted, dan errors. Untuk mengecek status sync, buka di browser:'),
    emptyLine(),
    codeBlock(['https://qshe-department-xxx.vercel.app/api/sync-employees']),
    emptyLine(),
    h2('5.4 Cron Job (Auto Sync Harian)'),
    p('File vercel.json sudah dikonfigurasi dengan jadwal \"0 23 * * *\" (setiap pukul 23:00 UTC atau 06:00 WIB). Vercel akan secara otomatis membaca konfigurasi cron ini dan menjalankannya sesuai jadwal. Pantau log cron job di dashboard Vercel pada menu \"Logs > Cron Jobs\".'),

    h1('6. Testing dan Verifikasi'),
    p('Setelah seluruh setup selesai, langkah terakhir adalah memastikan semua komponen bekerja dengan baik.'),
    h2('6.1 Checklist Verifikasi'),
    simpleTable(['No', 'Komponen', 'Cara Verifikasi', 'Expected Result'], [
      ['1', 'Aplikasi utama', 'Buka URL Vercel di browser', 'Halaman QSHE Department tampil'],
      ['2', 'Favicon', 'Cek tab browser', 'Logo BM terlihat jelas'],
      ['3', 'Database koneksi', 'Buka halaman Statistik', 'Tidak ada error koneksi'],
      ['4', 'Data karyawan', 'GET /api/sync-employees', 'Menampilkan total_employees'],
      ['5', 'Sync data', 'POST /api/sync-employees', 'Menampilkan stats upserted'],
      ['6', 'Cari karyawan', 'GET /api/employee?nik=BG0002', 'Data karyawan ditemukan'],
      ['7', 'Auto deploy', 'Push commit ke GitHub', 'Vercel otomatis redeploy'],
      ['8', 'Cron job', 'Cek Vercel Cron Jobs log', 'Sync berjalan sesuai jadwal'],
    ]),
    emptyLine(),
    h2('6.2 Troubleshooting Umum'),
    h3('Build Gagal di Vercel'),
    p('Buka menu \"Logs > Build Logs\" untuk melihat error detail. Penyebab umum: typo di kode, dependency yang hilang, atau versi Node.js tidak kompatibel. Pastikan package.json sudah benar dan tidak ada import dari modul yang sudah dihapus (seperti prisma).'),
    h3('Error Koneksi Supabase'),
    p('Periksa: (1) NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY sudah benar di Environment Variables Vercel, (2) Project Supabase tidak dalam status paused, (3) Tabel sudah dibuat dengan menjalankan supabase-schema.sql.'),
    h3('Data Karyawan Kosong'),
    p('Pastikan: (1) GOOGLE_SHEETS_CSV_URL sudah di-set, (2) Spreadsheet sudah di-publish to web, (3) Sync sudah dijalankan minimal sekali via POST /api/sync-employees.'),
    h3('Cron Job Tidak Berjalan'),
    p('Cron job Vercel hanya berjalan pada plan Hobby atau Pro. Pada plan Free, gunakan external cron service seperti cron-job.org yang memanggil POST /api/sync-employees secara berkala.'),

    h1('7. Peta API Routes'),
    p('Berikut daftar lengkap API routes yang tersedia di aplikasi QSHE Department, beserta method dan fungsinya:'),
    emptyLine(),
    simpleTable(['Endpoint', 'Method', 'Fungsi', 'Status'], [
      ['/api/sync-employees', 'GET', 'Cek status sync data karyawan', 'Aktif'],
      ['/api/sync-employees', 'POST', 'Jalankan sync dari Google Sheets', 'Aktif'],
      ['/api/employee', 'GET', 'Cari karyawan (nik/search/site)', 'Aktif'],
      ['/api/employee', 'POST', 'Cari karyawan by NIK (compatibility)', 'Aktif'],
      ['/api/manpower', 'GET', 'Ambil data man power', 'Aktif'],
      ['/api/manpower', 'POST', 'Input/update data man power', 'Aktif'],
      ['/api/absensi', 'GET', 'Ambil data absensi sakit', 'Aktif'],
      ['/api/absensi', 'POST', 'Input/update absensi sakit', 'Aktif'],
      ['/api/kunjungan', 'GET', 'Ambil data kunjungan berobat', 'Aktif'],
      ['/api/kunjungan', 'POST', 'Input kunjungan berobat', 'Aktif'],
      ['/api/kpi', 'GET', 'Ambil data KPI dashboard', 'Aktif'],
      ['/api/save', 'POST', 'Simpan data MCU (mock)', 'Sementara'],
      ['/api/ocr', 'POST', 'Ekstraksi OCR hasil MCU (mock)', 'Sementara'],
    ]),
    emptyLine(),
    p('Routes dengan status \"Aktif\" sudah terhubung ke Supabase. Routes dengan status \"Sementara\" masih menggunakan data mock dan akan diintegrasikan di tahap berikutnya.'),

    h1('8. Tips dan Best Practices'),
    h2('8.1 Alur Kerja Harian'),
    p('Dengan setup yang sudah dikonfigurasi, alur kerja harian menjadi sangat sederhana. Data karyawan otomatis tersinkronisasi dari Google Sheets ke Supabase setiap hari pukul 06:00 WIB. Admin QSHE hanya perlu membuka dashboard Vercel untuk melihat data yang sudah terupdate, melakukan input data absensi sakit dan kunjungan berobat melalui form di halaman Administrator, serta memonitor KPI melalui halaman Dashboard Statistik Kesehatan.'),
    h2('8.2 Update Kode ke Production'),
    p('Setiap kali ada perubahan kode yang ingin di-deploy, cukup lakukan git push ke branch main di repository GitHub. Vercel akan secara otomatis mendeteksi perubahan, melakukan build, dan men-deploy versi terbaru. Proses ini biasanya memakan waktu 1-3 menit.'),
    h2('8.3 Backup Data'),
    p('Meskipun Supabase sudah melakukan backup otomatis, disarankan untuk melakukan backup manual secara berkala melalui Supabase Dashboard. Navigasi ke \"Project Settings > Database > Backups\" untuk mengelola backup. Selain itu, karena source code tersimpan di GitHub, kamu selalu bisa mengembalikan kode ke versi sebelumnya menggunakan fitur revert commit.'),
    h2('8.4 Monitoring'),
    p('Vercel menyediakan fitur monitoring yang bisa diakses melalui dashboard. Menu \"Logs\" menampilkan log real-time dari aplikasi, termasuk API requests dan error. Menu \"Analytics\" menampilkan statistik pengunjung, performa halaman, dan penggunaan bandwidth. Manfaatkan fitur-fitur ini untuk memantau kesehatan aplikasi secara berkala.'),
  ],
};

// ASSEMBLE
const doc = new Document({
  styles: {
    default: { document: { run: { font: { ascii: 'Calibri', eastAsia: 'Microsoft YaHei' }, size: 22, color: c(P.body) }, paragraph: { spacing: { line: 312 } } } },
  },
  sections: [coverSection, tocSection, bodySection],
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync('/home/z/my-project/download/Tutorial-Deploy-QSHE-Department.docx', buf);
  console.log('Document generated!');
});
