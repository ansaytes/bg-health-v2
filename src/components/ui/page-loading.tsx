'use client';

// ============================================================
// Loading halaman — logo spinner, satu per HALAMAN
// ============================================================
//
// Kenapa satu per halaman: sebelumnya tiap diagram punya spinner sendiri,
// sehingga halaman dengan enam grafik menampilkan enam spinner sekaligus —
// berisik dan tidak memberi tahu apakah halaman sudah siap.
//
// Komponen ini menggantikan seluruh isi halaman selama data dimuat, lalu
// hilang sekali ketika data siap. Tampilan mengikuti spinner Monitoring MCU
// (ring berputar + logo BM di tengah), ukuran kartu 66px.

export default function PageLoading({ label = 'Memuat data' }: { label?: string }) {
  return (
    <div className="dashboard mcu-live-dashboard" style={{ overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
      <div className="bm-loading is-card" role="status" aria-live="polite" aria-label={label}>
        <div className="bm-loading-spinner">
          <div className="bm-loading-ring" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/BM.png" alt="" className="bm-loading-logo" aria-hidden="true" />
        </div>
        <p className="bm-loading-label">{label}…</p>
      </div>
    </div>
  );
}
