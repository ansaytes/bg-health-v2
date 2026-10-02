import fs from 'fs';
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ-_zVi1xQ2DPsiflNhCO8ODk_3oIQeM8DlJ9wMfjvp1OOwZ4pPKqlUw7vBl0MTGg9KXYoPxphjuINf/pub?gid=0&single=true&output=csv';

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else { field += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { row.push(field.trim()); field = ''; }
      else if (ch === '\n' || ch === '\r') {
        row.push(field.trim()); field = '';
        if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
        row = [];
        if (ch === '\r' && text[i + 1] === '\n') i++;
      } else { field += ch; }
    }
  }
  row.push(field.trim());
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
  return rows;
}

const COLUMN_MAP = {
  0: 'nik', 1: 'nama', 2: 'gender', 3: 'department', 4: 'division',
  5: 'client', // USER column - represents client name
  6: 'level_golongan', 7: 'job_position', 8: 'tanggal_pkwt', 9: 'masa_kerja',
  10: 'employee_status', 11: 'employment_status', 12: 'tanggal_resign',
  13: 'national_id', 14: 'phone_number', 15: 'place_of_birth',
  16: 'birth_date', 17: 'age', 18: 'last_education', 19: 'place_of_hire',
  20: 'site_name', 21: 'address', 22: 'religion',
  27: 'area', // AB column - area from spreadsheet
};

function mapRow(row) {
  const emp = {};
  for (const [colIdx, dbCol] of Object.entries(COLUMN_MAP)) {
    emp[dbCol] = row[Number(colIdx)] || '';
  }
  return emp;
}

function isEligibleEmployee(employee) {
  const division = String(employee.division || '').trim().toLowerCase();
  const status = String(employee.employment_status || '').trim().toLowerCase();
  
  const isMining = division === 'mining' || division.includes('mining');
  const isActive = status === 'aktif' || status === 'active';
  
  return isMining && isActive;
}

async function main() {
  const csvRes = await fetch(CSV_URL);
  const csvText = await csvRes.text();
  const rows = parseCSV(csvText);
  const allEmployees = rows.slice(1).map(mapRow);
  const eligible = allEmployees.filter(isEligibleEmployee);
  console.log(`Total: ${allEmployees.length}, Eligible: ${eligible.length}`);
  if (eligible.length === 0 && allEmployees.length > 0) {
     console.log('Sample row division and status:', allEmployees[3].division, allEmployees[3].employment_status);
  }
}
main();
