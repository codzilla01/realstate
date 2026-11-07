/**
 * One-command demo: starts the in-memory demo API + the Vite dev server.
 *
 *   npm run demo        → http://localhost:5173
 *
 * The browser talks to the Vite server only; "/api" is proxied to the demo API
 * on port 4000, exactly like the production nginx setup.
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

if (!existsSync(join(root, "frontend", "node_modules"))) {
  console.error("Frontend dependencies are missing. Run `npm run setup` first.");
  process.exit(1);
}

const children = [];
function start(command, args, cwd, label) {
  const child = spawn(command, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });
  children.push(child);

  child.stdout.on("data", (data) => process.stdout.write(`[${label}] ${data}`));
  child.stderr.on("data", (data) => process.stderr.write(`[${label}] ${data}`));
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[${label}] exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
}

let shuttingDown = false;
function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill("SIGTERM");
  setTimeout(() => process.exit(code), 300);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start(process.execPath, [join(root, "demo", "mock-api.mjs")], root, "demo-api");
const web = start(npm, ["--prefix", "frontend", "run", "dev"], root, "web");

console.log("\n  Demo is starting…");
console.log("  الموقع العام   http://localhost:5173/");
console.log("  لوحة التحكم    http://localhost:5173/admin/login");
console.log("  دخول تجريبي    201000000001 / admin1234");
console.log("  (بيانات وهمية في الذاكرة — لا تحتاج قاعدة بيانات)\n");

web.on("exit", (code) => shutdown(code ?? 0));
