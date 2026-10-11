import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createTwoPageLandscapePdf } from "./pdf-layout.js";

const ACCOUNT_URL = "https://www.lotto-niedersachsen.de/spielkonto/meine-spiele";
const DOWNLOAD_FOLDER = path.resolve("downloads");
const CDP_ENDPOINT = process.env.BINGO_CDP_ENDPOINT ?? "http://127.0.0.1:9222";

async function navigate(page, url) {
    console.log(`\n→ Öffne: ${url}`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    // Manche Seiten halten Hintergrundanfragen offen; networkidle ist deshalb kein Muss.
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await page.locator("body").waitFor({ state: "visible", timeout: 10_000 });
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

    // Reihenfolge der Lotto-Seite beibehalten und doppelte Links entfernen.
    return [...new Map(spiele.map((spiel) => [spiel.id, spiel])).values()].slice(0, 4);
}

async function getBingoLink(page) {
    const locator = page.locator('a[href*="/bingomatrix"]').first();
    try {
        await locator.waitFor({ state: "attached", timeout: 10_000 });
    } catch {
        throw new Error(`Kein BINGO-Matrix-Link auf ${page.url()} gefunden. Ist der Account angemeldet?`);
    }
    return locator.evaluate((a) => ({ text: a.innerText.trim(), href: a.href }));
}

async function saveBingoMatrixPdf(page, id, outputFolder) {
    const pdfPath = path.join(outputFolder, `${id}.pdf`);
    console.log(`   → Erzeuge PDF: ${pdfPath}`);
    await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    const stat = await fs.stat(pdfPath);
    if (stat.size === 0) throw new Error(`Die erzeugte PDF ist leer: ${pdfPath}`);
    return pdfPath;
}

async function downloadBingoSheets(page, spiele, outputFolder) {
    const pdfPaths = [];
    for (const [index, spiel] of spiele.entries()) {
        console.log(`\n[${index + 1}/${spiele.length}] Spielschein ${spiel.id}`);
        console.log(spiel.text || "(ohne Beschriftung)");
        await navigate(page, spiel.href);
        const bingoLink = await getBingoLink(page);
        console.log(`   BINGO-Link: ${bingoLink.href}`);
        await navigate(page, bingoLink.href);
        pdfPaths.push(await saveBingoMatrixPdf(page, spiel.id, outputFolder));
    }
    return pdfPaths;
}

async function printPdf(pdfPath) {
    console.log(`\n→ Drucke PDF: ${pdfPath}`);
    const printer = process.env.BINGO_PRINTER;
    if (os.platform() === "win32") {
        const { print } = await import("pdf-to-printer");
        await print(pdfPath, printer ? { printer } : {});
        return;
    }
    const { print } = await import("unix-print");
    await print(pdfPath, { printer: printer ?? "default" });
}

async function main() {
    let browser;
    try {
        await fs.mkdir(DOWNLOAD_FOLDER, { recursive: true });
        try {
            browser = await chromium.connectOverCDP(CDP_ENDPOINT, { timeout: 5_000 });
        } catch (error) {
            throw new Error(
                `Chromium ist unter ${CDP_ENDPOINT} nicht erreichbar. Starte Chrome mit Remote-Debugging (Port 9222) und melde dich bei LOTTO Niedersachsen an. Details: ${error.message}`
            );
        }

        const context = browser.contexts()[0];
        if (!context) throw new Error("Der verbundene Chromium-Browser hat keinen Browser-Kontext.");
        const page = context.pages()[0] ?? await context.newPage();

        await navigate(page, ACCOUNT_URL);
        const spiele = await getSpielscheine(page);
        console.log("\nGefundene Spielscheine:");
        console.table(spiele);
        if (spiele.length !== 4) {
            throw new Error(
                `Für die zweiseitige PDF werden genau 4 Spielscheine benötigt; gefunden: ${spiele.length}. Prüfe Anmeldung und „Meine Spiele“.`
            );
        }

        const now = new Date();
        const dateFolder = [
            String(now.getDate()).padStart(2, "0"),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getFullYear()),
        ].join("-");
        const runDownloadFolder = path.join(DOWNLOAD_FOLDER, dateFolder);
        const mergedPdfPath = path.join(runDownloadFolder, "bingo-alle.pdf");
        await fs.mkdir(runDownloadFolder, { recursive: true });

        const pdfPaths = await downloadBingoSheets(page, spiele, runDownloadFolder);
        await createTwoPageLandscapePdf(pdfPaths, mergedPdfPath);
        await printPdf(mergedPdfPath);

        console.log("\n=================================");
        console.log("✅ FERTIG");
        console.log("=================================");
        console.log(`PDFs: ${pdfPaths.length}`);
        console.log("Seiten im Querformat: 2");
        console.log(`Ausgabe: ${mergedPdfPath}`);
    } catch (error) {
        console.error("\n❌ FEHLER:");
        console.error(error);
        process.exitCode = 1;
    } finally {
        // Bei einer CDP-Verbindung wird die Verbindung getrennt; der Nutzerbrowser bleibt offen.
        if (browser) await browser.close().catch(() => {});
    }
}

await main();
