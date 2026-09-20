'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, Edit3, Plus, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Schedule = {
  id: string; nik_karyawan: string; national_id?: string; nama: string; jenis_kelamin?: string;
  usia?: number; jabatan?: string; site: string; tanggal_jadwal: string; history?: string[];
};

const empty = { nikKaryawan: '', nationalId: '', nama: '', jenisKelamin: '', usia: '', jabatan: '', site: '', tanggalJadwal: '', note: '' };
type ScheduleForm = typeof empty;

export default function InputJadwalMCU() {
  const [rows, setRows] = useState<Schedule[]>([]);
  const [sites, setSites] = useState<string[]>([]);
  const [form, setForm] = useState<ScheduleForm>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    const response = await fetch('/api/mcu/schedule');
    const json = await response.json();
    if (response.ok) { setRows(json.schedules || []); if (json.site) setForm(prev => ({ ...prev, site: json.site })); }
    else setMessage(json.error || 'Gagal memuat jadwal');
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const update = (key: keyof ScheduleForm, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const submit = async () => {
    const response = await fetch('/api/mcu/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editing, ...form }) });
    const json = await response.json();
    setMessage(response.ok ? 'Jadwal berhasil disimpan' : (json.error || 'Gagal menyimpan jadwal'));
    if (response.ok) { setForm(empty); setEditing(null); await load(); }
  };
  const edit = (row: Schedule) => {
    setEditing(row.id);
    setForm({ nikKaryawan: row.nik_karyawan, nationalId: '', nama: row.nama, jenisKelamin: row.jenis_kelamin || '', usia: String(row.usia || ''), jabatan: row.jabatan || '', site: row.site, tanggalJadwal: row.tanggal_jadwal, note: '' });
  };

  return <div className="admin-form-container" style={{ overflow: 'auto', padding: 20 }}>
    <div className="admin-form-header"><div><h2><CalendarDays size={20} /> Input Jadwal MCU</h2><p>Kelola satu jadwal aktif per karyawan sesuai site.</p></div><Button variant="outline" onClick={() => { setEditing(null); setForm(empty); }}><Plus size={16} /> Karyawan Baru</Button></div>
    {message && <div className="admin-alert">{message}</div>}
    <div className="raw-table-container" style={{ marginBottom: 18, padding: 16 }}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {([['nikKaryawan','NIK Karyawan',true],['nationalId','NIK KTP (wajib karyawan baru)',!editing],['nama','Nama',true],['jenisKelamin','Jenis Kelamin',false],['usia','Usia',false],['jabatan','Jabatan',false],['site','Site',true],['tanggalJadwal','Tanggal Jadwal MCU',true],['note','Catatan perubahan',false]] as const).map(([key, label, required]) => <label key={key} className="admin-field-label">{label}{required && ' *'}<input className="admin-input" type={key === 'tanggalJadwal' ? 'date' : key === 'usia' ? 'number' : 'text'} value={form[key]} required={required} onChange={e => update(key, e.target.value)} readOnly={key === 'site' && !!form.site && !editing} /></label>)}
      </div>
      <div className="flex gap-2 mt-4"><Button onClick={submit}><Save size={16} /> Simpan Jadwal</Button>{editing && <Button variant="outline" onClick={() => { setEditing(null); setForm(empty); }}><X size={16} /> Batal</Button>}</div>
    </div>
    <div className="raw-table-scroll"><table><thead><tr><th>No</th><th>NIK Karyawan</th><th>Nama</th><th>Jenis Kelamin</th><th>Usia</th><th>Jabatan</th><th>Site</th><th>Jadwal MCU</th><th>Riwayat</th><th>Aksi</th></tr></thead><tbody>{loading ? <tr><td colSpan={10}>Memuat...</td></tr> : rows.map((row, index) => <tr key={row.id}><td>{index + 1}</td><td>{row.nik_karyawan}</td><td>{row.nama}</td><td>{row.jenis_kelamin || '-'}</td><td>{row.usia || '-'}</td><td>{row.jabatan || '-'}</td><td>{row.site}</td><td>{row.tanggal_jadwal}</td><td title={(row.history || []).join('\n')}>{row.history?.length ? 'Arahkan kursor untuk melihat riwayat' : '-'}</td><td><button className="icon-btn" onClick={() => edit(row)} title="Ubah jadwal"><Edit3 size={15} /></button></td></tr>)}</tbody></table></div>
  </div>;
}
