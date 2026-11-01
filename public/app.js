const $ = (id) => document.getElementById(id);
let lastLogCount = 0;
let cachedLogs = [];
async function api(url, options) {
  const response = await fetch(url, { cache: "no-store", ...options, headers: { "content-type": "application/json", ...(options?.headers ?? {}) } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? `HTTP ${response.status}`);
  return data;
}
function showView(name) {
  document.querySelectorAll(".view").forEach((el) => el.classList.toggle("active", el.id === `view-${name}`));
  document.querySelectorAll(".nav").forEach((el) => el.classList.toggle("active", el.dataset.view === name));
  $("page-title").textContent = ({ overview: "Übersicht", settings: "Einstellungen", history: "Protokoll" })[name];
}
document.querySelectorAll(".nav").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
function renderLogs(logs) {
  cachedLogs = logs ?? [];
  const markup = cachedLogs.map((entry) => {
    const time = new Date(entry.time).toLocaleTimeString("de-DE");
    return `<div class="log-line"><span class="log-time">${time}</span>${escapeHtml(entry.line)}</div>`;
  }).join("");
  $("log").innerHTML = markup || '<div class="empty">Noch keine Ausgabe vorhanden.</div>';
  $("history-log").innerHTML = markup || '<div class="empty">Noch kein Protokoll vorhanden.</div>';
  $("log").scrollTop = $("log").scrollHeight;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
function renderStatus(data) {
  $("status").textContent = data.running ? "Läuft" : data.exitCode === 0 ? "Abgeschlossen" : data.exitCode !== null ? "Fehler" : "Bereit";
  $("status-detail").textContent = data.running ? "Der Bot verarbeitet deine Matrizen" : data.finishedAt ? `Beendet um ${new Date(data.finishedAt).toLocaleTimeString("de-DE")}` : "Wartet auf deinen Start";
  $("last-run").textContent = data.startedAt ? new Date(data.startedAt).toLocaleString("de-DE") : "–";
  $("last-result").textContent = data.exitCode === null ? "Noch kein Ergebnis" : data.exitCode === 0 ? "Erfolgreich" : `Exit-Code ${data.exitCode}`;
  $("start").disabled = data.running;
  $("stop").disabled = !data.running;
  $("chip").textContent = data.running ? "In Bearbeitung" : data.exitCode === 0 ? "Erfolgreich" : data.exitCode !== null ? "Fehler" : "Bereit";
  $("chip").className = "status-chip " + (data.running ? "running" : data.exitCode === 0 ? "done" : data.exitCode !== null ? "error" : "");
  $("progress-bar").style.width = data.running ? "65%" : data.exitCode === 0 ? "100%" : data.exitCode !== null ? "100%" : "0%";
  renderLogs(data.logs);
}
async function refresh() {
  try { renderStatus(await api("/api/status")); } catch (error) { $("status-detail").textContent = error.message; }
}
async function loadPrinters() {
  $("printer-help").textContent = "Suche verfügbare Drucker …";
  try {
    const data = await api("/api/printers");
    const selected = $("printer").value;
    $("printer").innerHTML = '<option value="">Standarddrucker verwenden</option>' + data.printers.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
    $("printer").value = selected;
    $("printer-help").textContent = data.warning ?? (data.printers.length ? `${data.printers.length} Drucker gefunden.` : "Keine Drucker gefunden. Der Standarddrucker kann trotzdem verwendet werden.");
  } catch (error) { $("printer-help").textContent = error.message; }
}
async function init() {
  const settings = await api("/api/settings");
  await loadPrinters();
  $("printer").value = settings.printer;
  $("printer-name").textContent = settings.printer || "Standard";
  await refresh();
  setInterval(refresh, 1200);
}
$("start").addEventListener("click", async () => {
  try { await api("/api/run", { method: "POST", body: "{}" }); await refresh(); }
  catch (error) { alert(error.message); }
});
$("stop").addEventListener("click", async () => {
  try { await api("/api/stop", { method: "POST", body: "{}" }); await refresh(); }
  catch (error) { alert(error.message); }
});
$("refresh-printers").addEventListener("click", loadPrinters);
$("save-settings").addEventListener("click", async () => {
  try {
    const settings = await api("/api/settings", { method: "POST", body: JSON.stringify({ printer: $("printer").value }) });
    $("printer-name").textContent = settings.printer || "Standard";
    $("save-message").textContent = "Gespeichert ✓";
    setTimeout(() => $("save-message").textContent = "", 3000);
  } catch (error) { $("save-message").textContent = error.message; }
});
$("copy-log").addEventListener("click", async () => {
  await navigator.clipboard.writeText(cachedLogs.map((entry) => `[${entry.time}] ${entry.line}`).join("\n"));
  $("copy-log").textContent = "Kopiert ✓";
  setTimeout(() => $("copy-log").textContent = "Protokoll kopieren", 1800);
});
init().catch((error) => { $("status-detail").textContent = error.message; });
