/**
 * Dashboard Kesehatan - Dashboard Kesehatan Karyawan
 * Google Apps Script Backend + Frontend
 */

// ============================================================
// CONFIGURATION
// ============================================================

// Sheet yang BUKAN jobsite (akan difilter otomatis)
var EXCLUDED_SHEETS = ['Data Karyawan Sakit', 'Rekapan Karyawan Sakit'];

// Ambil daftar sheet jobsite secara otomatis dari spreadsheet
// Semua sheet kecuali EXCLUDED_SHEETS dianggap jobsite
function _getJobSiteSheetNames() {
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  var names = [];
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    var skip = false;
    for (var j = 0; j < EXCLUDED_SHEETS.length; j++) {
      if (name === EXCLUDED_SHEETS[j]) { skip = true; break; }
    }
    if (!skip) names.push(name);
  }
  names.sort();
  // Pastikan "All Site" selalu di urutan pertama
  var allIdx = names.indexOf('All Site');
  if (allIdx > 0) {
    names.splice(allIdx, 1);
    names.unshift('All Site');
  }
  return names;
}

var MONTH_KEYS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];

// Definisi indikator lagging - baris 1-indexed (sesuai spreadsheet)
var LAGGING_DEFS = [
  { label: 'Rasio Kelayakan Kerja (RKK)',                           row: 16 },
  { label: 'Angka Kesakitan Kasar (CMR)',                           row: 17 },
  { label: 'MFR',                                                   row: 18 },
  { label: 'Tingkat Keparahan Penyakit (SSR)',                      row: 19 },
  { label: 'Tingkat Keparahan Penyakit berdasarkan absensi (ASR)', row: 20 },
  { label: 'Penyakit Akibat Kerja (FR PAK)',                        row: 21 },
  { label: 'Kejadian Akibat Penyakit Tenaga Kerja (KAPTK)',         row: 22 }
];

var MCU_SS_ID = '1wGhrqUgWIMZ8UMFNMEXH7FC5u84xxftFhxKL5W86GtM';
var KUNJUNGAN_SS_ID = '1xyL30mgbRHIigKAHoRhZR9-et_MX100YKdAt-1KQujA';
var SICK_SS_ID = '1vM82D2qqeFc_2ewTmVTxcPkywhkYZl506PhcS81SvjA';
var SICK_SHEET_NAME = 'Data Karyawan Sakit';

// ============================================================
// WEB APP ENTRY POINT
// ============================================================

function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Dashboard Kesehatan')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// ============================================================
// SPREADSHEET MENU
// ============================================================

function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('Update Data')
      .addItem('Update Monitor MCU', 'updateDataMCU')
      .addToUi();
  } catch(e) {
    // Silently fail in web app context (no UI available)
  }
}

// ============================================================
// LAGGING & LEADING DATA
// ============================================================

function getSheetNames() {
  return _getJobSiteSheetNames();
}

// Ambil data 1 sheet (lagging baris 16-22 kolom D-P, leading baris 5-14 kolom B-P)
function getSiteData(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return null;

  // --- LAGGING: baris 16-22, kolom D(4) s/d P(16) --- 7 baris x 13 kolom
  var lagVals = sheet.getRange(16, 4, 7, 13).getValues();
  var lagging = [];
  for (var i = 0; i < LAGGING_DEFS.length; i++) {
    var row = lagVals[i];
    if (!row) continue;
    var entry = { indicator: LAGGING_DEFS[i].label };
    for (var m = 0; m < 12; m++) {
      entry[MONTH_KEYS[m]] = parseNum(row[m]);
    }
    entry.ytd = parseNum(row[12]); // kolom P = index ke-13 di range
    lagging.push(entry);
  }

  // --- LEADING: baris 5-14, kolom B(2) s/d P(16) --- 10 baris x 15 kolom
  var leadVals = sheet.getRange(5, 2, 10, 15).getValues();
  var leading  = [];
  var skipWords = ['OH','INDIKATOR','PERIODE','LAGGING','LEADING','NOTE','SPELL','NO','NOMOR','TOTAL','NO.'];

  for (var i = 0; i < leadVals.length; i++) {
    var row  = leadVals[i];
    var name = String(row[0] || '').trim(); // kolom B = index 0
    if (!name) continue;

    var upper = name.toUpperCase();
    var skip  = false;
    for (var s = 0; s < skipWords.length; s++) {
      if (upper.indexOf(skipWords[s]) >= 0) { skip = true; break; }
    }
    if (skip) continue;

    var entry   = { indicator: name };
    var hasData = false;
    for (var m = 0; m < 12; m++) {
      entry[MONTH_KEYS[m]] = parseNum(row[2 + m]); // kolom D = index 2 di range
      if (entry[MONTH_KEYS[m]] !== 0) hasData = true;
    }
    entry.total = parseNum(row[14]); // kolom P = index 14 di range
    if (hasData) leading.push(entry);
  }

  return { name: sheetName, lagging: lagging, leading: leading };
}

// Ambil data ASR (baris 20) dari semua jobsite untuk ranking
function getAsrRanking() {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var allNames = _getJobSiteSheetNames();
  var result  = [];

  for (var i = 0; i < allNames.length; i++) {
    var name  = allNames[i];
    // Skip "All Site" — ranking hanya untuk jobsite individual
    if (name === 'All Site') continue;
    var sheet = ss.getSheetByName(name);
    if (!sheet) continue;

    // Baris 20 (ASR), kolom D(4) s/d P(16) → 1 baris x 13 kolom
    var vals = sheet.getRange(20, 4, 1, 13).getValues()[0];
    if (!vals) continue;

    var entry = { name: name };
    for (var m = 0; m < 12; m++) {
      entry[MONTH_KEYS[m]] = parseNum(vals[m]);
    }
    result.push(entry);
  }

  return result;
}

// ============================================================
// MCU DATA
// ============================================================
//
// Sheet Monitor_MCU - mulai baris 3 (skip header baris 1-2):
//   H(8)=Client, I(9)=Site, J(10)=Area
//   R(18)=MCU Terakhir, S(19)=Kategori, X(24)=Status, Y(25)=Rencana MCU
//
// Kolom R + 1 tahun < hari ini = Expired
// Achievement: Y(rencana) <= R(realisasi) = Tercapai
//
// getMcuRawData() mengembalikan semua baris, diproses client-side
// getMcuDropdownData() mengembalikan daftar Site, Area, Client unik

// Baca semua data MCU mentah, diproses di client-side
function getMcuRawData() {
  try {
    var ss    = SpreadsheetApp.openById(MCU_SS_ID);
    var sheet = ss.getSheetByName('Monitor_MCU');
    if (!sheet) return [];

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) return [];

    // Baca kolom H(8) s/d AD(30) = 23 kolom, mulai baris 3
    var data = sheet.getRange(3, 8, lastRow - 2, 23).getValues();

    var today = new Date();
    today.setHours(0,0,0,0);
    var rows = [];

    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      if (!r || r.length < 23) continue;

      var site = String(r[1] || '').trim(); // I = Site
      if (!site) continue;

      var rTs = (r[10] && r[10] instanceof Date) ? r[10].getTime() : 0; // R: MCU Terakhir
      var yTs = (r[17] && r[17] instanceof Date) ? r[17].getTime() : 0; // Y: Rencana MCU

      var statusX = String(r[16] || '').trim().toLowerCase(); // X: Status

      // Tentukan status berdasarkan kolom X (hasil updateDataMCU)
      var isExempt  = statusX === 'tidak perlu mine permit';
      var isValid   = statusX.indexOf('valid') >= 0;
      var isExpired = statusX.indexOf('expired') >= 0;
      var isNoData  = statusX === 'no data';

      var _client = String(r[0]  || '').trim();
      if (!_client) _client = 'PT. BDM'; // Kolom H kosong → default PT. BDM

      rows.push({
        c:   _client,                     // H: Client (kosong = PT. BDM)
        s:   site,                        // I: Site
        a:   String(r[2]  || '').trim(), // J: Area
        r:   rTs,                         // R: MCU Terakhir (timestamp)
        k:   String(r[11] || '').trim(), // S: Kategori
        x:   String(r[16] || '').trim(), // X: Status (teks lengkap)
        y:   yTs,                         // Y: Rencana MCU (timestamp)
        exp:    isExpired,                // true jika expired
        valid:  isValid,                  // true jika valid
        exempt: isExempt,                 // true jika Tidak Perlu Mine Permit
        noData: isNoData,                 // true jika No Data
        t:   String(r[12] || '').trim(),  // T: Hasil MCU
        u:   String(r[13] || '').trim(),  // U: Jenis Follow Up
        v:   String(r[14] || '').trim(),  // V: Status Follow Up
        zr:  String(r[19] || '').trim(),  // AA: Zona Risiko
        kj:  String(r[18] || '').trim(),  // Z: Ket jadwal
        dg:  String(r[21] || '').trim(),   // AC: Diagnosa
        frs: String(r[22] || '').trim()   // AD: FRS
      });
    }

    return rows;

  } catch(e) {
    return [];
  }
}

// Ambil daftar unique Client, Site, Area dari Monitor_MCU kolom H(8), I(9), J(10)
function getMcuDropdownData() {
  try {
    var ss    = SpreadsheetApp.openById(MCU_SS_ID);
    var sheet = ss.getSheetByName('Monitor_MCU');
    if (!sheet) return { sites: [], areas: [], clients: [], siteArea: {} };

    var lastRow = sheet.getLastRow();
    if (lastRow < 3) return { sites: [], areas: [], clients: [], siteArea: {} };

    // Baca kolom H(8), I(9), J(10) = 3 kolom, mulai baris 3
    var data    = sheet.getRange(3, 8, lastRow - 2, 3).getValues();
    var siteMap = {};
    var areaMap = {};
    var clientMap = {};
    var siteArea = {};

    for (var i = 0; i < data.length; i++) {
      var c = String(data[i][0] || '').trim();
      if (!c) c = 'PT. BDM'; // Kolom H kosong → default PT. BDM
      var s = String(data[i][1] || '').trim();
      var a = String(data[i][2] || '').trim();
      if (s) siteMap[s] = true;
      if (a) areaMap[a] = true;
      clientMap[c] = true;
      if (s && a) siteArea[s] = a;
    }

    var sites = Object.keys(siteMap).sort();
    sites.unshift('All Site');

    return {
      sites:   sites,
      areas:   Object.keys(areaMap).sort(),
      clients: (function(){
        var arr = Object.keys(clientMap).sort();
        var idx = arr.indexOf('PT. BDM');
        if (idx > 0) { arr.splice(idx, 1); arr.unshift('PT. BDM'); }
        return arr;
      })(),
      siteArea: siteArea
    };

  } catch(e) {
    return { sites: [], areas: [], clients: [], siteArea: {} };
  }
}

// ============================================================
// KUNJUNGAN DATA
// ============================================================
//
// Sheet "Kunjungan Klinik" - mulai baris 2 (baris 1 = header):
//   A(1)=Tanggal, B(2)=Jam, C(3)=Week, D(4)=NIK, E(5)=Nama,
//   F(6)=Usia, G(7)=JK, H(8)=Job Position, I(9)=Department,
//   J(10)=Alergy, K(11)=Keluhan, L(12)=Sistole, M(13)=Diastole,
//   N(14)=HR, O(15)=RR, P(16)=Suhu, Q(17)=SPO2, R(18)=GDP,
//   S(19)=GDS, T(20)=GD2PP, U(21)=CHOL, V(22)=UA,
//   W(23)=Diagnosa, X(24)=Terapi (dropdown: "Rujuk RS" = perlu rujukan),
//   Y(25)=Dosis, Z(26)=Jumlah Obat Keluar, AA(27)=Satuan,
//   AB(28)=Kategori, AC(29)=Absen, AF(32)=Teks Bulan, AG(33)=Tahun

var MONTH_NAMES_ID = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

// Parse kolom Tanggal (bisa Date object ATAU string "16/03/2026") -> index bulan 0-11, atau -1
function parseBulanIndex(val) {
  if (val instanceof Date) return val.getMonth();
  var s = String(val || '').trim();
  if (!s) return -1;
  // Coba format DD/MM/YYYY atau D/M/YYYY
  var p = s.split('/');
  if (p.length === 3) {
    var m = parseInt(p[1], 10);
    if (m >= 1 && m <= 12) return m - 1;
  }
  // Fallback: coba parse biasa
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d.getMonth();
  return -1;
}

function getKunjunganRawData() {
  try {
    var ss    = SpreadsheetApp.openById(KUNJUNGAN_SS_ID);
    var sheet = ss.getSheetByName('Kunjungan Klinik');
    if (!sheet) return [];

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    // Baca kolom A(1) s/d AG(33) = 33 kolom, mulai baris 2
    var data = sheet.getRange(2, 1, lastRow - 1, 33).getValues();
    var rows = [];

    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      if (!r || r.length < 33) continue;

      var nama = String(r[4] || '').trim();
      if (!nama) continue;

      var dateTs = 0;
      var bulanDariTanggal = '';
      var mi = parseBulanIndex(r[0]);
      if (mi >= 0) {
        bulanDariTanggal = MONTH_NAMES_ID[mi];
        if (r[0] instanceof Date) dateTs = r[0].getTime();
      }

      rows.push({
        dt:   dateTs,                                      // A: Tanggal (timestamp)
        tm:   String(r[1]  || '').trim(),                  // B: Jam
        wk:   String(r[2]  || '').trim(),                  // C: Week
        nik:  String(r[3]  || '').trim(),                  // D: NIK
        nm:   nama,                                        // E: Nama
        usia: String(r[5]  || '').trim(),                  // F: Usia
        jk:   String(r[6]  || '').trim(),                  // G: JK
        pos:  String(r[7]  || '').trim(),                  // H: Job Position
        dept: String(r[8]  || '').trim(),                  // I: Department
        alrg: String(r[9]  || '').trim(),                  // J: Alergy
        klhn: String(r[10] || '').trim(),                  // K: Keluhan
        diag: String(r[22] || '').trim(),                  // W: Diagnosa
        trp:  String(r[23] || '').trim(),                  // X: Terapi
        dos:  String(r[24] || '').trim(),                  // Y: Dosis
        jml:  Number(r[25]) || 0,                          // Z: Jumlah Obat Keluar
        sat:  String(r[26] || '').trim(),                  // AA: Satuan
        kat:  String(r[27] || '').trim(),                  // AB: Kategori
        absn: String(r[28] || '').trim(),                  // AC: Absen
        bln:  bulanDariTanggal,                            // Bulan diturunkan dari kolom A (Tanggal)
        thn:  String(r[32] || '').trim()                   // AG: Tahun
      });
    }

    return rows;

  } catch(e) {
    return [];
  }
}

function getKunjunganDropdownData() {
  try {
    var ss    = SpreadsheetApp.openById(KUNJUNGAN_SS_ID);
    var sheet = ss.getSheetByName('Kunjungan Klinik');
    if (!sheet) return { months: [], weeks: [], departments: [] };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { months: [], weeks: [], departments: [] };

    // Baca kolom A(Tanggal), C(Week), I(Department)
    var dateData = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var weekData = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
    var deptData = sheet.getRange(2, 9, lastRow - 1, 1).getValues();

    var monthMap = {}, weekMap = {}, deptMap = {};

    for (var i = 0; i < weekData.length; i++) {
      var w = String(weekData[i][0]  || '').trim();
      var d = String(deptData[i][0]  || '').trim();
      // Bulan diturunkan dari kolom A (Tanggal)
      var mi = parseBulanIndex(dateData[i][0]);
      var m = (mi >= 0) ? MONTH_NAMES_ID[mi] : '';
      if (m) monthMap[m] = true;
      if (w) weekMap[w] = true;
      if (d) deptMap[d] = true;
    }

    // Sort weeks numerically if possible
    var weekArr = Object.keys(weekMap).sort(function(a, b) {
      var na = parseInt(a), nb = parseInt(b);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });

    // Sort months by calendar order
    var monthArr = Object.keys(monthMap).sort(function(a, b) {
      return MONTH_NAMES_ID.indexOf(a) - MONTH_NAMES_ID.indexOf(b);
    });

    return {
      months:      monthArr,
      weeks:       weekArr,
      departments: Object.keys(deptMap).sort()
    };

  } catch(e) {
    return { months: [], weeks: [], departments: [] };
  }
}

// ============================================================
// UTILITIES
// ============================================================

function parseNum(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  var str = String(val).replace(/%/g, '').replace(/,/g, '').trim();
  if (str === '' || str === '-') return 0;
  var num = Number(str);
  return isNaN(num) ? 0 : num;
}

// ============================================================
// SICK LIST DATA (Data Karyawan Sakit)
// ============================================================

function getSickListData() {
  try {
    var ss    = SpreadsheetApp.openById(SICK_SS_ID);
    SpreadsheetApp.flush();
    var sheet = ss.getSheetByName(SICK_SHEET_NAME);
    if (!sheet) return { headers: [], rows: [] };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return { headers: [], rows: [] };

    var totalCols = Math.max(15, sheet.getLastColumn());

    // Read header row (row 1) to get column names
    var headerRow = sheet.getRange(1, 1, 1, totalCols).getValues()[0];

    // Display columns (1-based): B=2, C=3, D=4, E=5, H=8, K=11, N=14, O=15 (No column A)
    var displayIdx = [2, 3, 4, 5, 8, 11, 14, 15];
    var displayHeaders = [];
    for (var h = 0; h < displayIdx.length; h++) {
      var colNum = displayIdx[h];
      var hVal = String(headerRow[colNum - 1] || '').trim();
      if (!hVal || hVal.toLowerCase() === 'undefined') hVal = 'Kolom ' + String.fromCharCode(64 + colNum);
      displayHeaders.push(hVal);
    }

    // Read all data rows, columns 1 to totalCols
    var data = sheet.getRange(2, 1, lastRow - 1, totalCols).getValues();
    var rows = [];

    for (var i = 0; i < data.length; i++) {
      var r = data[i];
      var nama = String(r[2] || '').trim();
      if (!nama) continue;

      // Build display column values
      var cols = [];
      for (var c = 0; c < displayIdx.length; c++) {
        var val = r[displayIdx[c] - 1];
        if (val instanceof Date) {
          cols.push(formatDate(val));
        } else {
          var s = String(val == null ? '' : val).trim();
          if (s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') s = '';
          cols.push(s);
        }
      }

      // Filter date: column F (index 5, 0-based) as timestamp
      var fDate = null;
      if (r[5] instanceof Date && !isNaN(r[5].getTime())) {
        fDate = r[5].getTime();
      }

      rows.push({
        cols: cols,
        filterDate: fDate,
        site: String(r[3] || '').trim()
      });
    }

    return { headers: displayHeaders, rows: rows };

  } catch(e) {
    return { headers: [], rows: [] };
  }
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    var dd = val.getDate();
    var mm = val.getMonth() + 1;
    var yy = val.getFullYear();
    return (dd < 10 ? '0' + dd : dd) + '/' + (mm < 10 ? '0' + mm : mm) + '/' + yy;
  }
  return String(val).trim();
}

// ============================================================
// UPDATE MCU STATUS (Full Version)
// ============================================================

function _parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    var d = new Date(val);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  var parts = val.toString().trim().split('/');
  if (parts.length === 3) {
    var d = new Date(parts[2], parts[1] - 1, parts[0]);
    d.setHours(0, 0, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function _normalizeNIK(val) {
  if (!val) return '';
  return val.toString().replace(/\s+/g, '').trim().replace(/^0+/, '');
}

function _normalizeArea(val) {
  if (val === undefined || val === null) return '';
  var v = val.toString().trim().toLowerCase();
  if (v === '1') return 'Area 1';
  if (v === '2') return 'Area 2';
  if (v === '3') return 'Area 3';
  if (v === 'head office') return 'HO';
  return '';
}

function _calcAgeFromNIK(nikRaw) {
  if (!nikRaw) return '';
  var s = nikRaw.toString().replace(/\s+/g, '').trim();
  while (s.length < 16) s = '0' + s;
  if (s.length !== 16 || !/^\d{16}$/.test(s)) return '';
  var dd = parseInt(s.substring(6, 8), 10);
  var mm = parseInt(s.substring(8, 10), 10);
  var yy = parseInt(s.substring(10, 12), 10);
  if (dd > 40) dd -= 40;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
  var today = new Date();
  var currentYear = today.getFullYear();
  var currentCentury = Math.floor(currentYear / 100) * 100;
  var birthYear = currentCentury + yy;
  if (birthYear > currentYear) birthYear -= 100;
  var birthDate = new Date(birthYear, mm - 1, dd);
  if (isNaN(birthDate.getTime())) return '';
  var age = currentYear - birthDate.getFullYear();
  var diffMonth = today.getMonth() - birthDate.getMonth();
  if (diffMonth < 0 || (diffMonth === 0 && today.getDate() < birthDate.getDate())) age--;
  return age >= 0 ? age : '';
}

function _calcMasaKerja(tglMasukRaw, today) {
  var start = _parseDate(tglMasukRaw);
  if (!start) return '';
  if (start > today) return '';
  var years  = today.getFullYear() - start.getFullYear();
  var months = today.getMonth() - start.getMonth();
  var days   = today.getDate() - start.getDate();
  if (days < 0) {
    months--;
    var prevMonthLastDay = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
    days += prevMonthLastDay;
  }
  if (months < 0) { years--; months += 12; }
  return years + ' Tahun, ' + months + ' Bulan, ' + days + ' Hari';
}

function _getAreaRank(area) {
  var a = (area || '').toString().trim().toLowerCase();
  if (a === 'ho') return 0;
  if (a === 'area 1') return 1;
  if (a === 'area 2') return 2;
  if (a === 'area 3') return 3;
  return 4;
}

var _JABATAN_ORDER = [
  'General Manager',
  'Superintendent - Plant','Superintendent - Area','Superintendent Area Jakarta',
  'Manager - QSHE','Manager - HCGS','Manager - Operation','Manager - Plant','Sr. Manager - Finance, Account, & Tax',
  'Penanggung Jawab Operasional','Penanggung Jawab Area','PJO - Representative',
  'Supervisor - SHE Operational','Supervisor - QSHE Area',
  'Supervisor - Plant','Supervisor - Operation','Supervisor - Finance','Supervisor - Accounting',
  'Supervisor - Tax','Supervisor - Marketing','Supervisor - Organization Development',
  'Supervisor - General Services','Supervisor - Warehouse & Logistic','Supervisor - Inventory',
  'Supervisor - Officer TDC','Supervisor - Trainer Plant','Supervisor - Trainer Operation','Supervisor - SEED','SPV - Plant',
  'Foreman - SHE Operational','Foreman - QSHE Representatif','Paramedic','Paramedic - Representatif',
  'Foreman - Operation','Foreman - Plant','Foreman - Planner','Foreman - Warehouse & Inventory',
  'Foreman - Trainer Operation','Foreman - Trainer Plant','Foreman - Tax','Foreman - AP',
  'Foreman - QC QA Finishing','Foreman - Treasury','Foreman - QE Plant','Foreman - IT',
  'Foreman - AR','Foreman - Inventory','Foreman - Procurement','Foreman - Warehouse & Dispatching',
  'Foreman - Marketing','Foreman - Industrial Relation','Foreman - GS Area','Foreman - Recruitment',
  'Foreman - Organization Development','Foreman - Employee Services','Foreman - Legal',
  'Foreman - Warehouse & Receiving','Foreman - HC Area','Foreman - Refurbish','Foreman - Tyre','Foreman - Development Plant',
  'Staff - Document Control QSHE','Staff - Safety Support',
  'Personal Assistant','Secretary','Content Creator','Staff - Data Evaluator','Staff - IT',
  'Staff - Purchasing','Staff - Planner','Staff - Surat','Staff - Plant','Staff - General Services',
  'Staff - Treasury','Staff - Setoran AKDP','Staff - Accounting','Staff - AP','Staff - Tax',
  'Staff - Operation','Staff - AR','Staff - TDC','Staff - Procurement Legal','Staff - Recruitment',
  'Staff - Employee Services','Staff - MEP','Staff - Inventory','Staff - Warehouse & Dispatching',
  'Admin - System & Enviro','Admin - Umum','Admin - Plant & SCM','Admin - SCM','Admin - Plant',
  'Admin - Receiving dan Binning','Admin - Setoran AKDP','Admin - AP Site',
  'Admin - Recruitment','Admin - Treasury','Admin - Operation','Admin - Purchasing',
  'Admin - Accounting','Admin - Employee Services','Admin - Warehouse','Admin - General Services',
  'Admin - Inventory','Admin IT - System Solution','Admin - IER',
  'Sr. Mekanik','Md. Mekanik','Jr. Mekanik','Mekanik','Mekanik - Plant','Mekanik - Umum',
  'Mekanik Transmisi','Welder','Toolskepeer',
  'Helper - Mekanik','Helper - Plant','Helper - SCM','Operator - Forklift','Part Counter - SCM','Storeman - SCM','Package - SCM',
  'Driver - Operation','Driver Spare - Operation','Driver - Head Office','Helper Driver - Operation',
  'Komandan Regu','Security HO','Security',
  'Wakar','Juru Masak','Chef','Cleaning Service'
];

var _JABATAN_ORDER_MAP = {};
for (var _ji = 0; _ji < _JABATAN_ORDER.length; _ji++) {
  var _jk = _JABATAN_ORDER[_ji].toLowerCase().replace(/\s+/g, ' ').trim();
  if (!(_jk in _JABATAN_ORDER_MAP)) _JABATAN_ORDER_MAP[_jk] = _ji;
}

function _getJabatanRank(jab) {
  var key = (jab || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
  var idx = _JABATAN_ORDER_MAP[key];
  return idx !== undefined ? idx : _JABATAN_ORDER.length;
}

function _getFollowUpStatus(item) {
  var sourceValue = '', rekomendasiRaw = '';
  if (item.fuDV !== undefined && item.fuDV !== null && item.fuDV.toString().trim() !== '') {
    sourceValue = item.fuDV.toString().trim(); rekomendasiRaw = item.fuDX;
  } else if (item.fuDP !== undefined && item.fuDP !== null && item.fuDP.toString().trim() !== '') {
    sourceValue = item.fuDP.toString().trim(); rekomendasiRaw = item.fuDR;
  } else {
    sourceValue = (item.fuDG !== undefined && item.fuDG !== null) ? item.fuDG.toString().trim() : '';
    rekomendasiRaw = item.fuDJ;
  }
  if (!sourceValue) return {status: '', sourceValue: ''};
  var valLower = sourceValue.toLowerCase();
  if (valLower === 'fit to work' || valLower === 'fit') return {status: 'Close: FTW', sourceValue: sourceValue};
  if (valLower === 'unfit') return {status: 'Close: UNFIT', sourceValue: sourceValue};
  var rekomendasi = rekomendasiRaw ? rekomendasiRaw.toString().trim() : '';
  if (rekomendasi) return {status: 'Open: FU - ' + rekomendasi, sourceValue: sourceValue};
  return {status: 'Open: FU', sourceValue: sourceValue};
}

function _getRightmostFollowUpValue(item) {
  if (item.fuDV !== undefined && item.fuDV !== null && item.fuDV.toString().trim() !== '') return item.fuDV.toString().trim();
  if (item.fuDP !== undefined && item.fuDP !== null && item.fuDP.toString().trim() !== '') return item.fuDP.toString().trim();
  if (item.fuDG !== undefined && item.fuDG !== null && item.fuDG.toString().trim() !== '') return item.fuDG.toString().trim();
  return '';
}

function updateDataMCU() {
  var isWebApp = false;
  var ui;
  try { ui = SpreadsheetApp.getUi(); } catch(e) { isWebApp = true; }

  var ss = SpreadsheetApp.openById(MCU_SS_ID);
  var sheet = ss.getSheetByName('Monitor_MCU');
  var idManpower = '12zcuL_CH5zeVSBASrliUFose1v_mnY0gOUUV_O17SrA';
  var id2425     = '17EtuuTdr4jgwAEtMaSfsZb65n96oLnhq7qYhNeNbu18';
  var id2026     = '1tvH5W-GrzIAWATjawb8rp6lnCZhO7y-X9amaILuEgnA';
  var PlanMCU    = '1tMG_YMdeACgW_gaMw5t9bKis2LDW5TsW8ca9Chjff2I';
  var today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    var rawMan = SpreadsheetApp.openById(idManpower).getSheets()[0].getRange('A2:AB').getValues();
    var dataMan = [];
    for (var ri = 0; ri < rawMan.length; ri++) {
      var r = rawMan[ri];
      var statusKerja = r[10] ? r[10].toString().trim() : '';
      if (r[4] !== 'Mining' || r[11] !== 'Aktif' || (statusKerja !== 'PKWT' && statusKerja !== 'Permanen')) continue;
      var siteRaw = r[20] ? r[20].toString().toLowerCase().trim() : '';
      var site = siteRaw.replace(/\b\w/g, function(c) { return c.toUpperCase(); });
      var area = _normalizeArea(r[27]);
      var ktpRaw = r[13];
      var ktp = _normalizeNIK(r[13]);
      var umur = _calcAgeFromNIK(ktpRaw);
      var klien = r[5] ? r[5].toString().trim() : '';
      var tglMasuk = r[8];
      dataMan.push(['', r[0], ktp, r[1], r[2], umur, r[7], klien, site, area, tglMasuk]);
    }

    dataMan.sort(function(a, b) {
 var areaA = _getAreaRank(a[9]), areaB = _getAreaRank(b[9]);
      if (areaA !== areaB) return areaA - areaB;
      var siteCmp = (a[8] || '').localeCompare(b[8] || '');
      if (siteCmp !== 0) return siteCmp;
      var klienA = (a[7] || '').toString().trim().toLowerCase();
      var klienB = (b[7] || '').toString().trim().toLowerCase();
      if (klienA !== klienB) return klienA.localeCompare(klienB);
      var jabA = _getJabatanRank(a[6]), jabB = _getJabatanRank(b[6]);
      if (jabA !== jabB) return jabA - jabB;
      var tglA = _parseDate(a[10]), tglB = _parseDate(b[10]);
      if (tglA && tglB) { if (tglA.getTime() !== tglB.getTime()) return tglA - tglB; }
      else if (tglA && !tglB) return -1;
      else if (!tglA && tglB) return 1;
      return (a[3] || '').toString().localeCompare((b[3] || '').toString());
    });
    for (var si = 0; si < dataMan.length; si++) dataMan[si][0] = si + 1;
    for (var mi2 = 0; mi2 < dataMan.length; mi2++) dataMan[mi2][10] = _calcMasaKerja(dataMan[mi2][10], today);

    var currentLastRow = sheet.getLastRow();
    if (currentLastRow >= 3) sheet.getRange(3, 1, currentLastRow - 2, 30).clearContent();
    if (dataMan.length === 0) {
      if (isWebApp) return {success: false, message: 'Tidak ada data Manpower yang sesuai.'};
      else { ui.alert('Selesai', 'Tidak ada data Manpower yang sesuai dengan kriteria.', ui.ButtonSet.OK); return; }
    }
    sheet.getRange(3, 1, dataMan.length, 11).setValues(dataMan);

    // ========== AMBIL DATA MCU ==========
    var data2425 = SpreadsheetApp.openById(id2425).getSheetByName('2024-2025').getRange('B2:BM').getValues();
    var data2026 = SpreadsheetApp.openById(id2026).getSheetByName('RAW_DATA').getRange('B4:FC').getValues();

    // ========== AMBIL DATA PLAN MCU ==========
    var dataPlanMCU = SpreadsheetApp.openById(PlanMCU).getSheetByName('Data All Site').getRange('B2:L').getValues();
    var mapRemind = {}, mapRawRemind = {};
    for (var pi = 0; pi < dataPlanMCU.length; pi++) {
      var rowPlan = dataPlanMCU[pi];
      var nikPlan = _normalizeNIK(rowPlan[0]);
      if (!nikPlan) continue;
      var tglRaw = rowPlan[10];
      if (tglRaw) {
        var dRem = _parseDate(tglRaw);
        if (dRem) { mapRemind[nikPlan] = dRem; mapRawRemind[nikPlan] = tglRaw; }
      }
    }

    // Catatan: kolom baru disisipkan di posisi DR pada spreadsheet Record 2026,
    // sehingga semua kolom asli mulai dari DR ke kanan bergeser +1.
    // dg, dj, ee, dq, dh berada di kiri DR -> index TIDAK berubah.
    // dp, dr, dv, dx berada di DR / setelah DR -> index +1 dari sebelumnya.
    var FU_INDICES_2026 = { dg: 109, dj: 112, ee: 115, dp: 125, dr: 127, dv: 131, dx: 133, dq: 119, dh: 110 };
    // FRS: kolom DP=118 (dihitung dari B=0)
    var FRS_COL_DP = 118;
    var frsMap2026 = {};
    for (var fri = 0; fri < data2026.length; fri++) {
      var fr = data2026[fri];
      var nikFr = _normalizeNIK(fr[0]);
      if (!nikFr) continue;
      var _dpVal = fr[FRS_COL_DP] ? String(fr[FRS_COL_DP]).trim() : '';
      if (_dpVal) {
        frsMap2026[nikFr] = _dpVal;
      }
    }
    var FU_INDICES_2425 = { bm: 63 };
    var mapMCU = {};

    var _processMCU = function(data, kesimpulanIdx, itemMcuIdx, dataAAIdx, fuIndices, dhBmIdx) {
      for (var di = 0; di < data.length; di++) {
        var mr = data[di];
        var nik = _normalizeNIK(mr[0]);
        if (!nik) continue;
        if (!mapMCU[nik]) mapMCU[nik] = [];
        var entry = { tipe: mr[6], tgl: mr[7], kesimpulan: mr[kesimpulanIdx], itemMcu: mr[itemMcuIdx], dataAA: mr[dataAAIdx], dhBm: (dhBmIdx !== null && dhBmIdx !== undefined) ? mr[dhBmIdx] : '' };
        if (fuIndices && fuIndices.dg !== undefined) {
          entry.fuDG = mr[fuIndices.dg]; entry.fuDJ = mr[fuIndices.dj];
          entry.fuEE = mr[fuIndices.ee]; entry.fuDP = mr[fuIndices.dp];
          entry.fuDR = mr[fuIndices.dr]; entry.fuDV = mr[fuIndices.dv]; entry.fuDX = mr[fuIndices.dx];
        }
        mapMCU[nik].push(entry);
      }
    };
    _processMCU(data2425, 11, 9, 13, FU_INDICES_2425, 63);
    _processMCU(data2026, 109, 113, 119, FU_INDICES_2026, 110);

    // ========== PROSES DATA AKHIR ==========
    var lastRowUpdated = sheet.getLastRow();
    var nikData = sheet.getRange(3, 3, lastRowUpdated - 2, 1).getValues();
    var jabData = sheet.getRange(3, 7, lastRowUpdated - 2, 1).getValues();
    var hasilFinal = [];

    for (var fi = 0; fi < nikData.length; fi++) {
      var nik = _normalizeNIK(nikData[fi][0]);
      var jab = jabData[fi][0] ? jabData[fi][0].toString().toLowerCase() : '';
      var isExempt = /wakar|cook|masak|juru masak|clean|cleaning|cs|security|sec/.test(jab);
      var L = 0, M = 0, N = 0, O = 0, P = 0, Q = 0;
      var lastDateMcu = null, kategoriTerakhir = '', kesimpulanTerakhir = 'No Data';
      var itemMcuTerakhir = '', dataAATerakhir = '', dhBmTerakhir = '', lastMCUItem = null;

      if (mapMCU[nik]) {
        for (var ii = 0; ii < mapMCU[nik].length; ii++) {
          var item = mapMCU[nik][ii];
          var tipe = item.tipe ? item.tipe.toString().toLowerCase() : '';
          if (!tipe.includes('pre') && !tipe.includes('ann')) continue;
          var tMcu = _parseDate(item.tgl);
          if (!tMcu) continue;
          L++;
          if (tipe.includes('pre')) P++;
          if (tipe.includes('ann')) Q++;
          if (tMcu.getFullYear() === 2024) M++;
          if (tMcu.getFullYear() === 2025) N++;
          if (tMcu.getFullYear() === 2026) O++;
          if (!lastDateMcu || tMcu > lastDateMcu) {
            lastDateMcu = tMcu; kategoriTerakhir = item.tipe || '-';
            kesimpulanTerakhir = item.kesimpulan || '-'; dataAATerakhir = item.dataAA || '';
            dhBmTerakhir = item.dhBm ? item.dhBm.toString().trim() : '';
            var rawItem = item.itemMcu ? item.itemMcu.toString().trim() : '';
            itemMcuTerakhir = rawItem ? rawItem.split(/\r?\n/).map(function(line) { return line.trim(); }).filter(function(line) { return line !== ''; }).join(', ') : '';
            lastMCUItem = item;
          }
        }
      }

      var statusFollowUp = '', dataFollowUp = '';
      if (lastMCUItem) { var fuResult = _getFollowUpStatus(lastMCUItem); statusFollowUp = fuResult.status; dataFollowUp = _getRightmostFollowUpValue(lastMCUItem); }

      var statusHari = 'No Data', statusValid = 'No Data', isExpiredFlag = true, sisaHariExp = -9999;
      var tglReminder = mapRemind[nik] || null;
      var dataKolomY = mapRawRemind[nik] || '';
      var ketJadwal = '';

      if (lastDateMcu) {
        var expDate = null;
        if (lastMCUItem && lastMCUItem.fuEE) expDate = _parseDate(lastMCUItem.fuEE);
        if (!expDate) { expDate = new Date(lastDateMcu); expDate.setFullYear(expDate.getFullYear() + 1); }
        sisaHariExp = Math.floor((expDate - today) / 86400000);
        isExpiredFlag = sisaHariExp < 0;
        statusHari = sisaHariExp >= 0 ? sisaHariExp + ' Hari lagi' : 'Expired ' + Math.abs(sisaHariExp) + ' Hari';
        if (sisaHariExp >= 0) {
          statusValid = sisaHariExp <= 30 ? 'Valid \u2264 1 Bulan' : sisaHariExp <= 90 ? 'Valid \u2264 3 Bulan' : 'Valid > 3 Bulan';
        } else {
          var absSisa = Math.abs(sisaHariExp);
          statusValid = absSisa <= 30 ? 'Expired \u2264 1 Bulan' : absSisa <= 90 ? 'Expired \u2264 3 Bulan' : absSisa <= 365 ? 'Expired \u2264 1 Tahun' : 'Expired > 1 Tahun';
        }
      }

      // ========== KETERANGAN JADWAL (KOLOM Z) ==========
      if (isExempt) {
        statusValid = 'Tidak Perlu Mine Permit';
        ketJadwal   = 'Tidak Perlu Mine Permit';
      } else if (!lastDateMcu) {
        if (!tglReminder) {
          ketJadwal = 'MCU Tidak Ditemukan, Belum Dijadwalkan MCU';
        } else {
          var _diffU = Math.floor((tglReminder - today) / 86400000);
          ketJadwal = _diffU >= 0
            ? 'MCU Tidak Ditemukan, Dijadwalkan MCU ' + _diffU + ' Hari Lagi'
            : 'MCU Tidak Ditemukan, Jadwal MCU Terlewat ' + Math.abs(_diffU) + ' Hari';
        }
      } else if (!tglReminder) {
        ketJadwal = !isExpiredFlag
          ? 'MCU Valid, Belum Dijadwalkan MCU Ulang'
          : 'MCU Expired, Belum Dijadwalkan MCU Ulang';
      } else {
        var _diffTodayToU = Math.floor((tglReminder - today) / 86400000);
        var _diffUtoR     = Math.floor((tglReminder - lastDateMcu) / 86400000);
        if (!isExpiredFlag) {
          if (_diffTodayToU >= 0) {
            ketJadwal = 'MCU Valid, Dijadwalkan ' + _diffTodayToU + ' Hari Lagi';
          } else {
            if (_diffUtoR < 0) {
              ketJadwal = 'MCU Valid, Pelaksanaan Terlambat ' + Math.abs(_diffUtoR) + ' Hari';
            } else if (_diffUtoR > 0) {
              ketJadwal = sisaHariExp >= 100
                ? 'MCU Valid, Pelaksanaan ' + _diffUtoR + ' Hari Lebih Cepat'
                : 'MCU Valid, Jadwal Terlewat ' + Math.abs(_diffTodayToU) + ' Hari';
            } else {
              ketJadwal = 'MCU Valid, Pelaksanaan Tepat Waktu';
            }
          }
        } else {
          ketJadwal = _diffTodayToU >= 0
            ? 'MCU Expired, Dijadwalkan ' + _diffTodayToU + ' Hari Lagi'
            : 'MCU Expired, Jadwal Terlewat ' + Math.abs(_diffTodayToU) + ' Hari';
        }
      }

      var EXEMPT_TEXT = 'Tidak Perlu Mine Permit', NO_DATA_TEXT = 'No Data';

      // ========== FRS (Framingham Risk Score) ==========
      // FRS diambil dari spreadsheet eksternal sheet RAW_DATA kolom DP (kategori)
      var frsValue = 'FRS Belum Dimapping';
      if (isExempt) {
        frsValue = EXEMPT_TEXT;
      } else {
        var _frsCat = frsMap2026[nik];
        if (_frsCat) {
          frsValue = _frsCat;
        }
      }

      hasilFinal.push([
        L, M, N, O, P, Q,
        isExempt ? EXEMPT_TEXT : (lastDateMcu || NO_DATA_TEXT),
        isExempt ? EXEMPT_TEXT : (kategoriTerakhir || NO_DATA_TEXT),
        isExempt ? EXEMPT_TEXT : (kesimpulanTerakhir === 'No Data' ? NO_DATA_TEXT : kesimpulanTerakhir),
        statusFollowUp, dataFollowUp,
        isExempt ? EXEMPT_TEXT : statusHari,
        statusValid, dataKolomY, ketJadwal,
        isExempt ? EXEMPT_TEXT : (dataAATerakhir || NO_DATA_TEXT),
        itemMcuTerakhir, dhBmTerakhir,
        frsValue
      ]);
    }

    if (hasilFinal.length > 0) {
      sheet.getRange(3, 12, hasilFinal.length, 19).setValues(hasilFinal);
      sheet.getRange(3, 21, hasilFinal.length, 1).setHorizontalAlignment('left');
      var alignments = hasilFinal.map(function(row) { return row.map(function(val) { return val === 'No Data' ? 'left' : null; }); });
      sheet.getRange(3, 12, hasilFinal.length, 19).setHorizontalAlignments(alignments);
    }

    if (isWebApp) return {success: true, message: 'Data Berhasil Diperbarui. (' + dataMan.length + ' karyawan)', updated: dataMan.length};
    else ui.alert('Selesai!', 'Data Berhasil Diperbarui.', ui.ButtonSet.OK);

  } catch(err) {
    if (isWebApp) return {success: false, message: 'Error: ' + err.message};
    else ui.alert('Gagal Terjadi Kesalahan', err.message, ui.ButtonSet.OK);
  }
}