import fs from "node:fs/promises";
import { PDFDocument, PageSizes } from "pdf-lib";

export async function createTwoPageLandscapePdf(sourcePdfPaths, outputPath) {
    if (sourcePdfPaths.length !== 4) {
        throw new Error(
            `Genau 4 Quelldateien werden benötigt; erhalten: ${sourcePdfPaths.length}.`
        );
    }

    const landscapeWidth = PageSizes.A4[1];
    const landscapeHeight = PageSizes.A4[0];
    const outputPdf = await PDFDocument.create();

    for (let index = 0; index < sourcePdfPaths.length; index += 2) {
        const page = outputPdf.addPage([landscapeWidth, landscapeHeight]);

        for (let half = 0; half < 2; half += 1) {
            const sourcePath = sourcePdfPaths[index + half];
            const sourceBytes = await fs.readFile(sourcePath);
            const sourcePdf = await PDFDocument.load(sourceBytes);
            const [sourcePage] = sourcePdf.getPages();

            if (!sourcePage) {
                throw new Error(`Keine Seite in Quelldatei gefunden: ${sourcePath}`);
            }

            const [embeddedPage] = await outputPdf.embedPages([sourcePage]);
            const scale = Math.min(
                (landscapeWidth / 2) / embeddedPage.width,
                landscapeHeight / embeddedPage.height
            );
            const width = embeddedPage.width * scale;
            const height = embeddedPage.height * scale;
            const x =
                half * (landscapeWidth / 2) +
                ((landscapeWidth / 2) - width) / 2;
            const y = (landscapeHeight - height) / 2;

            page.drawPage(embeddedPage, { x, y, width, height });
        }
    }

    await fs.writeFile(outputPath, await outputPdf.save());
    console.log(`\n✅ Zweiseitige Querformat-PDF: ${outputPath}`);
}
