/**
 * يلتقط لقطات الشاشة التسويقية للمشروع تلقائياً.
 *
 * التهيئة مرة واحدة:
 *   npm i -D playwright && npx playwright install chromium
 *
 * التشغيل (بعد `npm run demo` في طرفية أخرى):
 *   node scripts/screenshots.mjs
 *   node scripts/screenshots.mjs --url https://demo.example.com --out docs/screenshots
 *
 * الناتج: ملفات PNG بمقاس 1440×900 لصفحات الموقع واللوحة الأساسية.
 */
import { mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const BASE_URL = arg("url", process.env.BASE_URL || "http://localhost:5173").replace(/\/$/, "");
const OUT_DIR = resolve(root, arg("out", process.env.OUT_DIR || "docs/screenshots"));
const PHONE = process.env.DEMO_PHONE || "201000000001";
const PASSWORD = process.env.DEMO_PASSWORD || "admin1234";

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "\nPlaywright غير مثبّت.\n" +
      "شغّل:\n  npm i -D playwright\n  npx playwright install chromium\n\n" +
      "ثم أعد المحاولة.\n"
  );
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: "ar-EG",
});
const page = await context.newPage();

async function settle(ms = 1500) {
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    /* الصور الخارجية قد تتأخر — نكتفي بالمهلة الزمنية */
  }
  await page.waitForTimeout(ms);
}

async function shot(name, path, { fullPage = true } = {}) {
  process.stdout.write(`  • ${name} … `);
  await page.goto(`${BASE_URL}${path}`, { waitUntil: "domcontentloaded" });
  await settle();
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`), fullPage });
  console.log("✓");
}

try {
  console.log(`[screenshots] ${BASE_URL} → ${OUT_DIR}`);

  // ── الموقع العام ──
  await shot("01-home", "/");
  await shot("02-properties", "/properties");

  // صفحة أول عقار متاحة
  await page.goto(`${BASE_URL}/properties`, { waitUntil: "domcontentloaded" });
  await settle(1200);
  const firstProperty = page.locator('a[href^="/properties/"]').first();
  if (await firstProperty.count()) {
    await firstProperty.click();
    await page.waitForURL(/\/properties\/[^/]+$/, { timeout: 8000 }).catch(() => {});
    await settle();
    await page.screenshot({ path: join(OUT_DIR, "03-property-details.png"), fullPage: true });
    console.log("  • 03-property-details … ✓");
  } else {
    console.log("  ! لا توجد عقارات لعرض صفحة التفاصيل (شغّل seed أو الديمو).");
  }

  // ── لوحة التحكم ──
  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: "domcontentloaded" });
  await settle(800);
  await page.screenshot({ path: join(OUT_DIR, "04-admin-login.png"), fullPage: false });
  console.log("  • 04-admin-login … ✓");

  await page.getByPlaceholder("رقم الهاتف").fill(PHONE);
  await page.getByPlaceholder("كلمة المرور").fill(PASSWORD);
  await Promise.all([
    page.waitForURL(/\/admin/, { timeout: 15000 }),
    page.getByRole("button", { name: "دخول" }).click(),
  ]);
  await settle();

  await shot("05-admin-dashboard", "/admin");
  await shot("06-admin-properties", "/admin/properties");
  await shot("07-admin-contracts", "/admin/contracts");
  await shot("08-admin-reports", "/admin/reports");

  console.log(`\nتم إنشاء ${9} لقطة تقريباً في: ${OUT_DIR}`);
  console.log("اقترح استخدام 01 و02 و03 و05 في صفحة البيع، و04 لبيان لوحة التحكم.");
} catch (error) {
  console.error("\nفشل التقاط اللقطات:", error.message);
  console.error("تأكد أن الموقع يعمل على", BASE_URL);
  process.exitCode = 1;
} finally {
  await context.close();
  await browser.close();
}
