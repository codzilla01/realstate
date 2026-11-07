/**
 * فاحص جاهزية النسخة الكاملة (MySQL + Prisma).
 *
 *   npm run doctor
 *
 * يتحقق من: إصدار Node، الاعتماديات، توليد Prisma، صحة DATABASE_URL والاتصال
 * بقاعدة البيانات، قوة JWT_SECRET، مجلد الصور، وبناء الواجهة — ويطبع قائمة
 * واضحة بما ينقص قبل `docker compose up` أو `npm run dev:api`.
 */
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { connect } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(root, "backend");
const frontend = join(root, "frontend");

const results = [];
const record = (level, area, message) => results.push({ level, area, message });

function parseEnvFile(path) {
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match || line.trim().startsWith("#")) continue;
    env[match[1]] = match[2].replace(/^["']|["']$/g, "").trim();
  }
  return env;
}

function canConnect(host, port, timeoutMs = 3000) {
  return new Promise((resolvePromise) => {
    const socket = connect({ host, port });
    const done = (ok) => {
      socket.destroy();
      resolvePromise(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

// ── 1) Node & dependencies ────────────────────────────────────────────────
const major = Number(process.versions.node.split(".")[0]);
if (major >= 18) record("ok", "Node", `v${process.versions.node}`);
else record("error", "Node", `v${process.versions.node} — يتطلب 18.18 أو أحدث`);

for (const [name, dir] of [
  ["backend", backend],
  ["frontend", frontend],
]) {
  if (existsSync(join(dir, "node_modules"))) record("ok", name, "الاعتماديات مثبتة");
  else record("error", name, `شغّل: npm --prefix ${name} install`);
}

// ── 2) Prisma client generated ────────────────────────────────────────────
const generatedClient = join(backend, "node_modules", ".prisma", "client", "index.js");
if (existsSync(generatedClient)) record("ok", "Prisma", "العميل مولَّد");
else record("error", "Prisma", "شغّل: npm --prefix backend run prisma:generate");

// ── 3) Environment ────────────────────────────────────────────────────────
const envFile = join(backend, ".env");
const env = { ...parseEnvFile(envFile), ...process.env };
if (existsSync(envFile)) record("ok", "env", "backend/.env موجود");
else record("warn", "env", "لا يوجد backend/.env — انسخه من backend/.env.example");

const databaseUrl = env.DATABASE_URL || "";
if (/^mysql:\/\//.test(databaseUrl)) {
  record("ok", "DATABASE_URL", "MySQL");
} else if (/^postgres(ql)?:\/\//.test(databaseUrl)) {
  record("ok", "DATABASE_URL", "PostgreSQL (بدّل provider في schema.prisma)");
} else if (databaseUrl) {
  record("error", "DATABASE_URL", "صيغة غير معروفة (mysql:// أو postgres://)");
} else {
  record("error", "DATABASE_URL", "غير مضبوط في backend/.env");
}

const secret = env.JWT_SECRET || "";
if (secret.length >= 32 && !/change-?me/i.test(secret)) {
  record("ok", "JWT_SECRET", `${secret.length} حرفاً`);
} else if (secret) {
  record("error", "JWT_SECRET", "قصير أو قيمة افتراضية — استخدم 32+ حرفاً عشوائياً");
} else {
  record("error", "JWT_SECRET", "غير مضبوط (مطلوب في الإنتاج)");
}

// ── 4) Database reachable ─────────────────────────────────────────────────
if (/^(mysql|postgres(ql)?):\/\//.test(databaseUrl)) {
  try {
    const url = new URL(databaseUrl);
    const port = Number(url.port || (/^mysql/.test(databaseUrl) ? 3306 : 5432));
    const reachable = await canConnect(url.hostname, port);
    if (reachable) record("ok", "قاعدة البيانات", `${url.hostname}:${port} يستجيب`);
    else
      record(
        "error",
        "قاعدة البيانات",
        `لا يمكن الاتصال بـ ${url.hostname}:${port} — شغّل MySQL أو استخدم Docker`
      );
  } catch {
    record("error", "قاعدة البيانات", "تعذر تحليل DATABASE_URL");
  }
}

// ── 5) Uploads directory ─────────────────────────────────────────────────
const uploadDir = resolve(backend, env.UPLOAD_DIR || "uploads");
try {
  mkdirSync(uploadDir, { recursive: true });
  const probe = join(uploadDir, `.doctor-${Date.now()}`);
  writeFileSync(probe, "ok");
  unlinkSync(probe);
  record("ok", "مجلد الصور", uploadDir);
} catch {
  record("error", "مجلد الصور", `غير قابل للكتابة: ${uploadDir}`);
}

// ── 6) Frontend build ────────────────────────────────────────────────────
const dist = join(frontend, "dist", "index.html");
if (existsSync(dist)) {
  const { mtime } = statSync(dist);
  record("ok", "بناء الواجهة", `dist/ — ${mtime.toISOString().slice(0, 16).replace("T", " ")}`);
} else {
  record("warn", "بناء الواجهة", "غير موجود — شغّل: npm run build");
}

// ── Report ───────────────────────────────────────────────────────────────
const icon = { ok: "✓", warn: "!", error: "✗" };
const color = { ok: "\x1b[32m", warn: "\x1b[33m", error: "\x1b[31m" };
console.log("\n  فحص جاهزية النسخة الكاملة\n  " + "─".repeat(58));
for (const { level, area, message } of results) {
  console.log(`  ${color[level]}${icon[level]}\x1b[0m  ${area.padEnd(14)} ${message}`);
}
const errors = results.filter((r) => r.level === "error").length;
const warnings = results.filter((r) => r.level === "warn").length;
console.log("  " + "─".repeat(58));
console.log(
  errors
    ? `  ${errors} مشكلة تمنع التشغيل، ${warnings} تحذير.\n`
    : `  جاهزة للتشغيل${warnings ? ` (${warnings} تحذير)` : ""}.\n`
);
console.log("  التالي: npm --prefix backend run prisma:migrate && npm --prefix backend run prisma:seed");
console.log("          npm run dev:api   |   أو:  docker compose up --build\n");

process.exit(errors ? 1 : 0);
