import http from "node:http";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, "public");
const DATA = process.env.BINGO_DATA_HOME ?? (process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, "Bingo-Bot")
  : path.join(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"), "bingo-bot"));
const SETTINGS = path.join(DATA, "settings.json");
const execFileAsync = promisify(execFile);
const PORT = Number(process.env.BINGO_UI_PORT ?? 4173);
const HOST = "127.0.0.1";
let child = null;
let run = { running: false, startedAt: null, finishedAt: null, exitCode: null, logs: [] };

async function readSettings() {
  try {
    const value = JSON.parse(await fs.readFile(SETTINGS, "utf8"));
    return { printer: typeof value.printer === "string" ? value.printer : "" };
  } catch { return { printer: "" }; }
}
async function saveSettings(settings) {
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(SETTINGS, JSON.stringify(settings, null, 2), { mode: 0o600 });
}
function log(line) {
  run.logs.push({ time: new Date().toISOString(), line: String(line).slice(0, 2000) });
  if (run.logs.length > 500) run.logs.shift();
}
function status() {
  return { ...run, logs: run.logs.slice(-150) };
}
function send(res, code, value) {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
}
async function body(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error("Anfrage ist zu groß.");
  }
  return raw ? JSON.parse(raw) : {};
}
async function printers() {
  if (process.platform === "win32") {
    const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-Command", "Get-Printer | Select-Object -ExpandProperty Name"], { timeout: 8000 });
    return stdout.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  }
  const { stdout } = await execFileAsync("lpstat", ["-p"], { timeout: 8000 });
  return stdout.split(/\r?\n/).map((x) => x.match(/^printer\s+(.+?)\s/)?.[1]).filter(Boolean);
}
async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  if (req.method === "GET" && url.pathname === "/api/status") return send(res, 200, status());
  if (req.method === "GET" && url.pathname === "/api/settings") return send(res, 200, await readSettings());
  if (req.method === "GET" && url.pathname === "/api/printers") {
    try { return send(res, 200, { printers: await printers() }); }
    catch (error) { return send(res, 200, { printers: [], warning: error.message }); }
  }
  if (req.method === "POST" && url.pathname === "/api/settings") {
    try {
      const data = await body(req);
      if (data.printer !== undefined && (typeof data.printer !== "string" || data.printer.length > 200 || /[\r\n]/.test(data.printer))) {
        return send(res, 400, { error: "Ungültiger Druckername." });
      }
      const settings = { printer: data.printer?.trim() ?? (await readSettings()).printer };
      await saveSettings(settings);
      return send(res, 200, settings);
    } catch (error) { return send(res, 400, { error: error.message }); }
  }
  if (req.method === "POST" && url.pathname === "/api/run") {
    if (run.running) return send(res, 409, { error: "Der Bot läuft bereits." });
    const settings = await readSettings();
    run = { running: true, startedAt: new Date().toISOString(), finishedAt: null, exitCode: null, logs: [] };
    log("Starte Bingo Bot …");
    child = spawn(process.execPath, [path.join(ROOT, "index.js")], {
      cwd: ROOT,
      env: { ...process.env, BINGO_PRINTER: settings.printer, BINGO_DATA_DIR: path.join(DATA, "downloads") },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const consume = (stream) => {
      let pending = "";
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        pending += chunk;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? "";
        for (const line of lines) log(line);
      });
      stream.on("end", () => { if (pending) log(pending); });
    };
    consume(child.stdout); consume(child.stderr);
    child.once("error", (error) => { log(`Startfehler: ${error.message}`); run.running = false; run.finishedAt = new Date().toISOString(); run.exitCode = 1; child = null; });
    child.once("close", (code) => { run.running = false; run.finishedAt = new Date().toISOString(); run.exitCode = code; log(code === 0 ? "Vorgang erfolgreich abgeschlossen." : `Vorgang beendet (Exit-Code ${code}).`); child = null; });
    return send(res, 202, { accepted: true });
  }
  if (req.method === "POST" && url.pathname === "/api/stop") {
    if (!child || !run.running) return send(res, 409, { error: "Es läuft gerade kein Vorgang." });
    child.kill("SIGTERM");
    log("Abbruch angefordert …");
    return send(res, 202, { stopping: true });
  }
  if (req.method === "GET" && url.pathname === "/api/output") {
    const root = path.resolve(DATA, "downloads");
    const requested = path.resolve(root, url.searchParams.get("file") ?? "");
    if (!requested.startsWith(root + path.sep)) return send(res, 400, { error: "Ungültiger Dateipfad." });
    try {
      const stat = await fs.stat(requested);
      if (!stat.isFile() || !requested.toLowerCase().endsWith(".pdf")) return send(res, 404, { error: "PDF nicht gefunden." });
      res.writeHead(200, { "content-type": "application/pdf", "content-length": stat.size, "content-disposition": 'inline; filename="bingo-alle.pdf"' });
      return createReadStream(requested).pipe(res);
    } catch { return send(res, 404, { error: "PDF nicht gefunden." }); }
  }
  if (req.method === "GET" && url.pathname === "/") {
    const html = await fs.readFile(path.join(PUBLIC, "index.html"));
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    return res.end(html);
  }
  if (req.method === "GET" && url.pathname === "/app.js") {
    const js = await fs.readFile(path.join(PUBLIC, "app.js"));
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    return res.end(js);
  }
  if (req.method === "GET" && url.pathname === "/style.css") {
    const css = await fs.readFile(path.join(PUBLIC, "style.css"));
    res.writeHead(200, { "content-type": "text/css; charset=utf-8" });
    return res.end(css);
  }
  return send(res, 404, { error: "Nicht gefunden." });
}
await fs.mkdir(DATA, { recursive: true });
const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => send(res, 500, { error: error.message }));
});
server.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`Bingo Bot UI: ${url}`);
  console.log("Die Oberfläche ist ausschließlich auf diesem Gerät erreichbar.");
  if (process.env.BINGO_NO_OPEN !== "1") {
    const opener = spawn("xdg-open", [url], { detached: true, stdio: "ignore" });
    opener.unref();
  }
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
  if (child) child.kill("SIGTERM");
  server.close(() => process.exit(0));
});
