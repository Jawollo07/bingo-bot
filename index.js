import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { createTwoPageLandscapePdf } from "./pdf-layout.js";

const ACCOUNT_URL = "https://www.lotto-niedersachsen.de/spielkonto/meine-spiele";
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DOWNLOAD_FOLDER = path.join(ROOT, "downloads");
const CDP_ENDPOINT = process.env.BINGO_CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const PRINTER = process.env.BINGO_PRINTER;

async function navigate(page, url) {
    console.log(`\n→ ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.locator("body").waitFor({ state: "visible", timeout: 15_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
}

async function getSpielscheine(page) {
    const spiele = await page.locator('a[href*="/spielkonto/meine-spiele/"]').evaluateAll((elements) =>
        elements
            .map((a) => {
                const href = a.href;
                const match = new URL(href).pathname.match(/\/spielkonto\/meine-spiele\/(\d+)\/?$/);
                return match
                    ? { text: a.innerText.trim().replace(/\s+/g, " "), href, id: match[1] }
                    : null;
            })
            .filter(Boolean)
    );
    return [...new Map(spiele.map((spiel) => [spiel.id, spiel])).values()].slice(0, 4);
}

async function waitForLoginIfNeeded(page) {
    let spiele = await getSpielscheine(page);
    if (spiele.length >= 4) return spiele;

    console.log("\n🔐 Bitte melde dich im geöffneten Browser bei LOTTO Niedersachsen an.");
    console.log("Wenn du die Seite „Meine Spiele“ siehst, kehre hierher zurück.");
    const rl = readline.createInterface({ input, output });
    try {
        await rl.question("Drücke danach hier ENTER, damit der Bot fortfährt … ");
    } finally {
        rl.close();
    }

    await navigate(page, ACCOUNT_URL);
    await page.locator('a[href*="/spielkonto/meine-spiele/"]').first().waitFor({ state: "attached", timeout: 20_000 }).catch(() => {});
    spiele = await getSpielscheine(page);
    if (spiele.length !== 4) {
        throw new Error(`Es wurden ${spiele.length} von 4 benötigten Spielscheinen gefunden. Prüfe die Anmeldung und „Meine Spiele“ und starte den Bot erneut.`);
    }
    return spiele;
}

async function getBingoLink(page) {
    const locator = page.locator('a[href*="/bingomatrix"]').first();
    try {
        await locator.waitFor({ state: "attached", timeout: 15_000 });
    } catch {
        throw new Error(`Kein BINGO-Matrix-Link auf ${page.url()} gefunden. Die Website hat sich möglicherweise geändert.`);
    }
    return locator.evaluate((a) => ({ text: a.innerText.trim(), href: a.href }));
}

async function saveBingoMatrixPdf(page, id, outputFolder) {
    const pdfPath = path.join(outputFolder, `${id}.pdf`);
    await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    const stat = await fs.stat(pdfPath);
    if (stat.size < 500) throw new Error(`Die erzeugte PDF ist unerwartet klein: ${pdfPath}`);
    return pdfPath;
}

async function downloadBingoSheets(page, spiele, outputFolder) {
    const pdfPaths = [];
    for (const [index, spiel] of spiele.entries()) {
        console.log(`\n[${index + 1}/4] Erstelle Matrix für Spielschein ${spiel.id}`);
        await navigate(page, spiel.href);
        const bingoLink = await getBingoLink(page);
        await navigate(page, bingoLink.href);
        pdfPaths.push(await saveBingoMatrixPdf(page, spiel.id, outputFolder));
        console.log("   ✓ PDF gespeichert");
    }
    return pdfPaths;
}

async function printPdf(pdfPath) {
    console.log("\n🖨️ Sende die fertige PDF an den Drucker …");
    if (os.platform() === "win32") {
        const { print } = await import("pdf-to-printer");
        await print(pdfPath, PRINTER ? { printer: PRINTER } : {});
        return;
    }
    const { print } = await import("unix-print");
    await print(pdfPath, { printer: PRINTER ?? "default" });
}

async function main() {
    let browser;
    try {
        await fs.mkdir(DOWNLOAD_FOLDER, { recursive: true });

        console.log("🎱 Bingo Bot");
        console.log(`Verbinde mit dem bereits gestarteten Debug-Browser: ${CDP_ENDPOINT}`);
        try {
            browser = await chromium.connectOverCDP(CDP_ENDPOINT, { timeout: 10_000 });
        } catch {
            throw new Error(
                "Kein Debug-Browser erreichbar. Starte den Bot mit start.sh (Linux) oder start.bat (Windows), " +
                "damit Chrome/Chromium mit --remote-debugging-port=9222 geöffnet wird."
            );
        }
        const context = browser.contexts()[0];
        if (!context) {
            throw new Error("Der Debug-Browser hat keinen verfügbaren Browser-Kontext.");
        }
        const page = context.pages()[0] ?? await context.newPage();
        await navigate(page, ACCOUNT_URL);
        const spiele = await waitForLoginIfNeeded(page);

        console.log("\nGefundene Spielscheine:");
        console.table(spiele.map(({ id, text }) => ({ id, spielschein: text })));

        const now = new Date();
        const dateFolder = [
            String(now.getDate()).padStart(2, "0"),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getFullYear()),
        ].join("-");
        const runFolder = path.join(DOWNLOAD_FOLDER, dateFolder);
        await fs.mkdir(runFolder, { recursive: true });
        const mergedPdfPath = path.join(runFolder, "bingo-alle.pdf");

        const pdfPaths = await downloadBingoSheets(page, spiele, runFolder);
        await createTwoPageLandscapePdf(pdfPaths, mergedPdfPath);

        try {
            await printPdf(mergedPdfPath);
            console.log("\n✅ FERTIG – PDF wurde an den Drucker gesendet.");
        } catch (error) {
            console.error("\n⚠️ PDF ist fertig, aber automatisches Drucken ist fehlgeschlagen.");
            console.error("Du kannst die Datei manuell öffnen und drucken:");
            console.error(mergedPdfPath);
            console.error(error.message);
            process.exitCode = 2;
        }
        console.log(`\n📄 Ausgabe: ${mergedPdfPath}`);
    } catch (error) {
        console.error("\n❌ Der Bingo Bot konnte nicht fertig ausgeführt werden.");
        console.error(error.message ?? error);
        process.exitCode = 1;
    } finally {
        // Disconnect Playwright; the externally started browser stays open.
        if (browser) await browser.close().catch(() => {});
    }
}

await main();
