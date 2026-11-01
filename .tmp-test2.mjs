export default async function run(page) {
  const klik = async (sel, label) => {
    await page.evaluate(([s, l]) => {
      const el = [...document.querySelectorAll(s)].find((b) => b.innerText.trim().toLowerCase() === l.toLowerCase());
      el?.click();
    }, [sel, label]);
    await page.waitForTimeout(500);
  };
  await klik('.header-nav button, .header-nav a', 'Dashboard');
  await page.waitForTimeout(700);
  const sisi = await page.evaluate(() => [...document.querySelectorAll('.sidebar-nav .nav-btn')].map(b => b.innerText.trim()));
  await klik('.sidebar-nav .nav-btn', 'Layanan Kuratif');
  await page.waitForTimeout(5000);
  const out = { sidebar: sisi };
  out.boxes = await page.evaluate(() =>
    [...document.querySelectorAll('canvas')].map(c => {
      const r = c.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), inChartBox: !!c.closest('.chart-box') };
    }));
  await page.screenshot({ path: 'D:/WebApp/bg-health-v2/.qa-kur2.png' });
  return out;
}
