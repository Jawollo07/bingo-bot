import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PDFDocument, PageSizes } from "pdf-lib";
import { createTwoPageLandscapePdf } from "../pdf-layout.js";

async function makePdf(filePath, pageCount = 1) {
    const pdf = await PDFDocument.create();
    for (let i = 0; i < pageCount; i += 1) pdf.addPage(PageSizes.A4);
    await fs.writeFile(filePath, await pdf.save());
}

test("creates two landscape A4 pages from four single-page PDFs", async (t) => {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), "bingo-layout-"));
    t.after(() => fs.rm(folder, { recursive: true, force: true }));

    const sources = [];
    for (let i = 0; i < 4; i += 1) {
        const source = path.join(folder, `source-${i + 1}.pdf`);
        await makePdf(source);
        sources.push(source);
    }

    const output = path.join(folder, "combined.pdf");
    await createTwoPageLandscapePdf(sources, output);
    const result = await PDFDocument.load(await fs.readFile(output));

    assert.equal(result.getPageCount(), 2);
    for (const page of result.getPages()) {
        const { width, height } = page.getSize();
        assert.ok(width > height, "output pages should be landscape");
        assert.ok(Math.abs(width - PageSizes.A4[1]) < 1);
        assert.ok(Math.abs(height - PageSizes.A4[0]) < 1);
    }
});

test("rejects input other than four PDFs", async () => {
    await assert.rejects(
        createTwoPageLandscapePdf(["one.pdf"], "unused.pdf"),
        /Genau 4 Quelldateien/
    );
});

test("rejects multi-page source PDFs instead of silently dropping pages", async (t) => {
    const folder = await fs.mkdtemp(path.join(os.tmpdir(), "bingo-layout-"));
    t.after(() => fs.rm(folder, { recursive: true, force: true }));

    const sources = [];
    for (let i = 0; i < 4; i += 1) {
        const source = path.join(folder, `source-${i + 1}.pdf`);
        await makePdf(source, i === 0 ? 2 : 1);
        sources.push(source);
    }

    await assert.rejects(
        createTwoPageLandscapePdf(sources, path.join(folder, "combined.pdf")),
        /muss genau eine Seite enthalten/
    );
});
