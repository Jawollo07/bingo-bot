import { chromium } from "playwright";
import fs from "node:fs/promises";
import { createTwoPageLandscapePdf } from "./pdf-layout.js";
import os from "node:os";

const browser = await chromium.connectOverCDP(
    "http://127.0.0.1:9222"
);

const ptp = os.platform() === 'win32' 
  ? await import('pdf-to-printer') 
  : await import('unix-print');

const context = browser.contexts()[0];
const pages = context.pages();
const page = pages[0];

const url =
    "https://www.lotto-niedersachsen.de/spielkonto/meine-spiele";

const downloadFolder = "./downloads";

async function goTo(url) {
    console.log(`\n→ Öffne: ${url}`);

    await page.goto(url, {
        waitUntil: "networkidle"
    });
}
async function printPdf(pdfPath) {
    console.log(`\n→ Drucke PDF: ${pdfPath}`);

    if (os.platform() === 'win32') {
        await ptp.print(pdfPath);
    } else {
        await ptp.print(pdfPath, { printer: 'default' });
    }
}
async function getSpielscheine() {
    const spiele = await page.locator(
        'a[href*="/spielkonto/meine-spiele/"]'
    ).evaluateAll(elements =>
        elements
            .map(a => ({
                text: a.innerText.trim().replace(/\s+/g, " "),
                href: a.href,
                id: a.href.split("/").pop()
            }))
            .filter(x =>
                /\/spielkonto\/meine-spiele\/\d+$/.test(
                    new URL(x.href).pathname
                )
            )
    );

    // Nur die 4 neuesten Spielscheine
    return spiele.slice(0, 4);
}

async function getBingoLink() {
    const locator = page.locator(
        'a[href*="/bingomatrix"]'
    ).first();

    if (!(await locator.count())) {
        throw new Error(
            `Kein BINGO-Matrix-Link auf ${page.url()} gefunden!`
        );
    }

    return await locator.evaluate(a => ({
        text: a.innerText.trim(),
        href: a.href
    }));
}

async function downloadBingoMatrix(id, outputFolder) {
    const pdfPath = `${outputFolder}/${id}.pdf`;

    console.log(`   → Erzeuge PDF: ${pdfPath}`);

    await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        margin: {
            top: "0",
            right: "0",
            bottom: "0",
            left: "0"
        }
    });

    return pdfPath;
}

async function downloadBingoSheets(spiele, outputFolder) {
    const pdfPaths = [];

    for (const [index, spiel] of spiele.entries()) {
        console.log(
            `\n[${index + 1}/${spiele.length}] Spielschein ${spiel.id}`
        );

        console.log(`${spiel.text}`);

        // Spielschein öffnen
        await goTo(spiel.href);

        // BINGO-Matrix-Link suchen
        const bingoLink = await getBingoLink();

        console.log(`   BINGO-Link: ${bingoLink.href}`);

        // BINGO-Matrix öffnen
        await goTo(bingoLink.href);

        // Kleine zusätzliche Wartezeit für die Darstellung
        await page.waitForTimeout(500);

        // PDF erzeugen
        const pdfPath = await downloadBingoMatrix(spiel.id, outputFolder);

        pdfPaths.push(pdfPath);
    }

    return pdfPaths;
}

async function main() {
    try {
        // Download-Ordner erstellen
        await fs.mkdir(downloadFolder, {
            recursive: true
        });

        // Meine Spiele öffnen
        await goTo(url);

        // Alle Spielscheine finden
        const spiele = await getSpielscheine();

        console.log("\nGefundene Spielscheine:");
        console.table(spiele);

        if (spiele.length !== 4) {
            throw new Error(
                `Es werden genau 4 Spielscheine für die 2-seitige PDF benötigt; gefunden: ${spiele.length}.`
            );
        }

        console.log(
            `\n${spiele.length} Spielschein(e) gefunden.`
        );
        const now = new Date();
        const dateFolder =
            `${String(now.getDate()).padStart(2, "0")}-` +
            `${String(now.getMonth() + 1).padStart(2, "0")}-` +
            `${now.getFullYear()}`;
        const runDownloadFolder = `${downloadFolder}/${dateFolder}`;
        const mergedPdfPath = `${runDownloadFolder}/bingo-alle.pdf`;
        await fs.mkdir(runDownloadFolder, {
            recursive: true
        });

        // BINGO-Matrizen herunterladen
        const pdfPaths = await downloadBingoSheets(spiele, runDownloadFolder);

        console.log("\nErzeugte PDFs:");
        console.table(pdfPaths);
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
    }
}

await main();