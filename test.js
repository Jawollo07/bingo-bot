import { chromium } from "playwright";

const browser = await chromium.connectOverCDP(
    "http://127.0.0.1:9222"
);

const context = browser.contexts()[0];
const pages = context.pages();
const page = pages[0];

await page.goto(
    "https://www.lotto-niedersachsen.de/spielkonto/meine-spiele",
    {
        waitUntil: "networkidle"
    }
);

// Alle Spielschein-Links
const spiele = await page.locator(
    'a[href*="/spielkonto/meine-spiele/"]'
).evaluateAll(elements =>
    elements
        .map(a => ({
            text: a.innerText.trim().replace(/\s+/g, " "),
            href: a.href
        }))
        .filter(x =>
            /\/spielkonto\/meine-spiele\/\d+$/.test(
                new URL(x.href).pathname
            )
        )
);

console.log("Gefundene Spielscheine:");
console.table(spiele);

if (!spiele.length) {
    throw new Error("Kein Spielschein gefunden!");
}

// Neuesten Spielschein nehmen
const latest = spiele[0];

console.log("\nNeustes Los:");
console.log(latest);

const latest_id = latest.href.split("/").pop();

console.log("Latest ID:", latest_id);

// Spielschein öffnen
await page.goto(latest.href, {
    waitUntil: "networkidle"
});

console.log("Titel:", await page.title());
console.log("URL:", page.url());

// BINGO!-Schein-Link direkt aus der Seite holen
const bingoLink = await page.locator(
    'a[href*="/bingomatrix"]'
).first().evaluate(a => ({
    text: a.innerText.trim(),
    href: a.href
}));

console.log("\nBINGO!-Schein:");
console.log(bingoLink);

// Optional: BINGO-Matrix öffnen
await page.goto(bingoLink.href, {
    waitUntil: "networkidle"
});

console.log("\nBINGO-Matrix:");
console.log("Titel:", await page.title());
console.log("URL:", page.url());
const pdfPath = `./bingo-${latest_id}.pdf`;

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

console.log("PDF gespeichert:", pdfPath);