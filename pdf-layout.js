import fs from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PageSizes } from "pdf-lib";

export async function createTwoPageLandscapePdf(sourcePdfPaths, outputPath) {
    if (!Array.isArray(sourcePdfPaths) || sourcePdfPaths.length !== 4) {
        throw new Error(
            `Genau 4 Quelldateien werden benötigt; erhalten: ${Array.isArray(sourcePdfPaths) ? sourcePdfPaths.length : "ungültige Eingabe"}.`
        );
    }

    const landscapeWidth = PageSizes.A4[1];
    const landscapeHeight = PageSizes.A4[0];
    const outputPdf = await PDFDocument.create();

    for (let index = 0; index < sourcePdfPaths.length; index += 2) {
        const page = outputPdf.addPage([landscapeWidth, landscapeHeight]);
        for (let half = 0; half < 2; half += 1) {
            const sourcePath = sourcePdfPaths[index + half];
            let sourcePdf;
            try {
                sourcePdf = await PDFDocument.load(await fs.readFile(sourcePath));
            } catch (error) {
                throw new Error(`Quelldatei kann nicht als PDF gelesen werden (${sourcePath}): ${error.message}`);
            }

            const sourcePages = sourcePdf.getPages();
            if (sourcePages.length !== 1) {
                throw new Error(
                    `Die Quelldatei ${sourcePath} muss genau eine Seite enthalten; gefunden: ${sourcePages.length}. Es werden keine Seiten stillschweigend ausgelassen.`
                );
            }

            const [embeddedPage] = await outputPdf.embedPages([sourcePages[0]]);
            const scale = Math.min(
                (landscapeWidth / 2) / embeddedPage.width,
                landscapeHeight / embeddedPage.height
            );
            const width = embeddedPage.width * scale;
            const height = embeddedPage.height * scale;
            const x = half * (landscapeWidth / 2) + ((landscapeWidth / 2) - width) / 2;
            const y = (landscapeHeight - height) / 2;
            page.drawPage(embeddedPage, { x, y, width, height });
        }
    }

    await fs.mkdir(path.dirname(path.resolve(outputPath)), { recursive: true });
    await fs.writeFile(outputPath, await outputPdf.save());
    console.log(`\n✅ Zweiseitige Querformat-PDF: ${outputPath}`);
}
