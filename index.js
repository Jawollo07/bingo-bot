import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { spawn } from "node:child_process";
import { createTwoPageLandscapePdf } from "./pdf-layout.js";
import { REQUIRED_SPIELSCHEINE, selectSpielscheine } from "./spielschein-utils.js";

const ACCOUNT_URL = "https://www.lotto-niedersachsen.de/spielkonto/meine-spiele";
const LOTTO_ORIGIN = "https://www.lotto-niedersachsen.de";
const DOWNLOAD_FOLDER = process.env.BINGO_DATA_DIR ?? path.join(process.cwd(), "downloads");
const CDP_ENDPOINT = process.env.BINGO_CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const PRINTER = process.env.BINGO_PRINTER?.trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function navigate(page, url, attempts = 3) {
    if (new URL(url).origin !== LOTTO_ORIGIN) throw new Error("Unsicheres Navigationsziel außerhalb von LOTTO Niedersachsen blockiert.");
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            console.log(`\n→ ${url}`);
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
            await page.locator("body").waitFor({ state: "visible", timeout: 15_000 });
            await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
            return;
        } catch (error) {
            lastError = error;
            if (attempt < attempts) { console.warn(`Ladeversuch ${attempt} fehlgeschlagen; Wiederholung …`); await sleep(attempt * 1000); }
        }
    }
    throw new Error(`Seite nach ${attempts} Versuchen nicht erreichbar: ${lastError?.message}`);
}
async function getSpielscheine(page) {
    const found = await page.locator('a[href*="/spielkonto/meine-spiele/"]').evaluateAll((els) => els.map((a) => {
        try {
            const u = new URL(a.href);
            const m = u.origin === "https://www.lotto-niedersachsen.de" ? u.pathname.match(/^\/spielkonto\/meine-spiele\/(\d+)\/?$/) : null;
            return m ? { text: a.innerText.trim().replace(/\s+/g, " "), href: u.href, id: m[1] } : null;
        } catch { return null; }
    }).filter(Boolean));
    return [...new Map(found.map((item) => [item.id, item])).values()];
}
async function isLoggedIn(page) {
    let current;
    try { current = new URL(page.url()); } catch { return false; }

    // LOTTO leitet nicht angemeldete Besucher normalerweise auf die Anmeldeseite um.
    // Entscheidend ist deshalb der tatsächlich geladene Kontobereich – nicht,
    // ob die Spielschein-Links bereits im DOM stehen.
    const accountPage = current.origin === LOTTO_ORIGIN &&
        current.pathname.startsWith("/spielkonto/");

    const passwordFields = page.locator('input[type="password"]');
    const hasVisibleLoginForm = await passwordFields.count().then(async (count) => {
        for (let i = 0; i < count; i++) {
            if (await passwordFields.nth(i).isVisible().catch(() => false)) return true;
        }
        return false;
    });

    return accountPage && !hasVisibleLoginForm;
}

async function waitForSpielscheine(page, timeoutMs = 15_000) {
    const deadline = Date.now() + timeoutMs;
    let spiele = [];
    while (Date.now() < deadline) {
        spiele = await getSpielscheine(page);
        if (spiele.length >= REQUIRED_SPIELSCHEINE) {
            if (spiele.length > REQUIRED_SPIELSCHEINE) console.warn(`ℹ️ ${spiele.length} Spielscheine gefunden; für das aktuelle Drucklayout werden die ersten ${REQUIRED_SPIELSCHEINE} verwendet.`);
            return selectSpielscheine(spiele);
        }
        await sleep(500);
    }
    return spiele;
}

async function waitForLoginIfNeeded(page) {
    // Bereits angemeldete Nutzer dürfen nicht fünf Minuten auf die
    // manuelle Login-Erkennung warten, nur weil die Spielscheine später laden.
    if (await isLoggedIn(page)) {
        console.log("✓ LOTTO-Konto ist bereits angemeldet – prüfe Spielscheine …");
        const spiele = await waitForSpielscheine(page);
        if (spiele.length >= REQUIRED_SPIELSCHEINE) {
            if (spiele.length > REQUIRED_SPIELSCHEINE) console.warn(`ℹ️ ${spiele.length} Spielscheine gefunden; für das aktuelle Drucklayout werden die ersten ${REQUIRED_SPIELSCHEINE} verwendet.`);
            return selectSpielscheine(spiele);
        }
        throw new Error(`LOTTO-Anmeldung erkannt, aber es wurden nur ${spiele.length} von 4 Spielscheinen gefunden. Bitte „Meine Spiele“ im Browser prüfen.`);
    }

    console.log("\n🔐 Bitte melde dich im geöffneten Browser bei LOTTO Niedersachsen an.");
    if (process.stdin.isTTY) {
        const rl = readline.createInterface({ input, output });
        try { await rl.question("Nach erfolgreicher Anmeldung hier ENTER drücken … "); } finally { rl.close(); }
        await navigate(page, ACCOUNT_URL);
        if (!(await isLoggedIn(page))) throw new Error("Anmeldung wurde nicht erkannt. Bitte prüfen, ob LOTTO die Anmeldung übernommen hat.");
        const spiele = await waitForSpielscheine(page);
        if (spiele.length < REQUIRED_SPIELSCHEINE) throw new Error(`Anmeldung erkannt, aber es werden ${REQUIRED_SPIELSCHEINE} Spielscheine benötigt; gefunden: ${spiele.length}.`);
        if (spiele.length > REQUIRED_SPIELSCHEINE) console.warn(`ℹ️ ${spiele.length} Spielscheine gefunden; für das aktuelle Drucklayout werden die ersten ${REQUIRED_SPIELSCHEINE} verwendet.`);
        return selectSpielscheine(spiele);
        return spiele;
    }

    console.log("Warte bis zu 5 Minuten auf deine Anmeldung …");
    const deadline = Date.now() + 5 * 60_000;
    let lastCount = -1;
    while (Date.now() < deadline) {
        if (await isLoggedIn(page)) {
            const spiele = await waitForSpielscheine(page, 15_000);
            if (spiele.length === 4) return spiele;
            throw new Error(`Anmeldung erkannt, aber genau 4 Spielscheine werden benötigt; gefunden: ${spiele.length}. Bitte „Meine Spiele“ prüfen.`);
        }
        const count = (await getSpielscheine(page)).length;
        if (count !== lastCount) {
            console.log(`Anmeldung noch nicht erkannt (Spielscheine: ${count}/4) …`);
            lastCount = count;
        }
        await sleep(1000);
    }
    throw new Error("Zeitüberschreitung: LOTTO-Anmeldung wurde innerhalb von 5 Minuten nicht erkannt.");
}
async function getBingoLink(page) {
    const links = await page.locator('a[href*="/bingomatrix"]').evaluateAll((els) => els.map((a) => a.href).filter((href) => {
        try { return new URL(href).origin === "https://www.lotto-niedersachsen.de"; } catch { return false; }
    }));
    if (!links.length) throw new Error(`Kein gültiger BINGO-Matrix-Link auf ${page.url()} gefunden. Mögliche Website-Änderung.`);
    return links[0];
}
async function saveBingoMatrixPdf(page, id, folder) {
    const file = path.join(folder, `${id}.pdf`);
    await page.pdf({ path: file, format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
    const stat = await fs.stat(file);
    if (stat.size < 500) throw new Error(`PDF für Spielschein ${id} ist unerwartet klein.`);
    return file;
}
async function downloadBingoSheets(page, spiele, folder) {
    const files = [];
    for (const [i, spiel] of spiele.entries()) {
        console.log(`\n[${i + 1}/${spiele.length}] Matrix für Spielschein ${spiel.id}`);
        await navigate(page, spiel.href);
        await navigate(page, await getBingoLink(page));
        files.push(await saveBingoMatrixPdf(page, spiel.id, folder));
        console.log("PDF gespeichert");
    }
    return files;
}
async function printPdf(file) {
    console.log(`\n🖨️ Drucke über ${PRINTER ? `„${PRINTER}“` : "den Standarddrucker"} …`);
    if (os.platform() === "win32") {
        const { print } = await import("pdf-to-printer");
        await print(file, PRINTER ? { printer: PRINTER } : undefined);
        return;
    }
    await new Promise((resolve, reject) => {
        const args = PRINTER ? ["-d", PRINTER, file] : [file];
        const proc = spawn("lp", args, { stdio: ["ignore", "ignore", "pipe"] });
        let errorText = "";
        proc.stderr.setEncoding("utf8").on("data", (chunk) => errorText += chunk);
        proc.once("error", reject);
        proc.once("close", (code) => code === 0 ? resolve() : reject(new Error(errorText.trim() || `lp beendet mit Status ${code}; CUPS prüfen.`)));
    });
}
async function main() {
    let browser;
    try {
        await fs.mkdir(DOWNLOAD_FOLDER, { recursive: true });
        console.log("🎱 Bingo Bot");
        const endpoint = new URL(CDP_ENDPOINT);
        if (!["127.0.0.1", "localhost", "::1"].includes(endpoint.hostname)) throw new Error("Remote-Debugging ist aus Sicherheitsgründen nur auf localhost erlaubt.");
        console.log(`Verbinde mit Browser: ${CDP_ENDPOINT}`);
        try { browser = await chromium.connectOverCDP(CDP_ENDPOINT, { timeout: 10_000 }); }
        catch (error) { throw new Error(`Kein lokaler Debug-Browser erreichbar. Bitte den Bingo-Bot-Starter verwenden. ${error.message}`); }
        const context = browser.contexts()[0];
        if (!context) throw new Error("Browser-Kontext nicht verfügbar.");
        const page = context.pages()[0] ?? await context.newPage();
        await navigate(page, ACCOUNT_URL);
        const spiele = await waitForLoginIfNeeded(page);
        console.table(spiele.map(({ id, text }) => ({ id, spielschein: text })));
        const now = new Date();
        const folderName = [String(now.getDate()).padStart(2, "0"), String(now.getMonth() + 1).padStart(2, "0"), now.getFullYear()].join("-");
        const folder = path.join(DOWNLOAD_FOLDER, folderName);
        await fs.mkdir(folder, { recursive: true });
        const output = path.join(folder, "bingo-alle.pdf");
        const sources = await downloadBingoSheets(page, spiele, folder);
        await createTwoPageLandscapePdf(sources, output);
        try {
            await printPdf(output);
            console.log("\n✅ PDF wurde an den Drucker gesendet.");
        } catch (error) {
            console.error("\n⚠️ PDF erstellt, aber Drucken fehlgeschlagen.");
            console.error(`Manuell drucken: ${output}`);
            console.error(error.message);
            process.exitCode = 2;
        }
        console.log(`\n📄 Ausgabe: ${output}`);
    } catch (error) {
        console.error("\n❌ Bingo Bot fehlgeschlagen:");
        console.error(error.stack ?? error.message ?? error);
        process.exitCode = 1;
    } finally {
        if (browser) await browser.close().catch(() => {});
    }
}
await main();
