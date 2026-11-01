// Uji tampilan diagram: label sumbu lengkap, tinggi chart, tooltip.
export default async function run(page) {
  const klikNav = async (label) => {
    await page.evaluate((lbl) => {
      const el = [...document.querySelectorAll('.header-nav button, .header-nav a')]
        .find((b) => b.innerText.trim().toLowerCase() === lbl.toLowerCase());
      el?.click();
    }, label);
    await page.waitForTimeout(600);
  };
  const klikSidebar = async (label) => {
    await page.evaluate((lbl) => {
      const el = [...document.querySelectorAll('.sidebar-nav .nav-btn')]
        .find((b) => b.innerText.trim().toLowerCase() === lbl.toLowerCase());
      el?.click();
    }, label);
    await page.waitForTimeout(1200);
  };
  // Ukur setiap canvas: tinggi elemen + jumlah label yang tergambar.
  const ukurChart = () => page.evaluate(() => {
    return [...document.querySelectorAll('.chart-box, .mcu-dashboard-chart')].map((box) => {
      const c = box.querySelector('canvas');
      const r = box.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), adaCanvas: !!c };
    });
  });

  const out = {};
  await klikNav('Dashboard');
  await page.waitForTimeout(700);
  await klikSidebar('Statistik');
  await page.waitForTimeout(4500);
  out.statistik = await ukurChart();
  await page.screenshot({ path: 'D:/WebApp/bg-health-v2/.qa-stat.png' });

  await klikSidebar('Layanan Kuratif');
  await page.waitForTimeout(4500);
  out.kuratif = await ukurChart();
  await page.screenshot({ path: 'D:/WebApp/bg-health-v2/.qa-kur.png' });

  await klikSidebar('Higiene Industri');
  await page.waitForTimeout(4500);
  out.higiene = await ukurChart();
  await page.screenshot({ path: 'D:/WebApp/bg-health-v2/.qa-hig.png' });

  await klikSidebar('SPIP');
  await page.waitForTimeout(4500);
  out.spip = await ukurChart();
  await page.screenshot({ path: 'D:/WebApp/bg-health-v2/.qa-spip.png' });

  return out;
}
