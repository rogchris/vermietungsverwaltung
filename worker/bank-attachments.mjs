import { parentPort, workerData } from "node:worker_threads";
import { degrees, PageSizes, PDFDocument, rgb, StandardFonts } from "pdf-lib";

const [width, height] = PageSizes.A4;
const margin = 40;

function placement(originalWidth, originalHeight, rotation) {
  const sideways = rotation === 90 || rotation === 270;
  const visibleWidth = sideways ? originalHeight : originalWidth;
  const visibleHeight = sideways ? originalWidth : originalHeight;
  const scale = Math.min((width - 2 * margin) / visibleWidth, (height - 2 * margin - 36) / visibleHeight);
  if (!Number.isFinite(scale) || scale <= 0) throw new Error("Ungültige Anlagengröße");
  return {
    x: (width - visibleWidth * scale) / 2 + (rotation === 180 || rotation === 270 ? visibleWidth * scale : 0),
    y: (height - 36 - visibleHeight * scale) / 2 + (rotation === 90 || rotation === 180 ? visibleHeight * scale : 0),
    width: originalWidth * scale,
    height: originalHeight * scale,
    rotate: degrees(-rotation),
  };
}

async function append() {
  const result = await PDFDocument.load(workerData.pdf, { updateMetadata: false });
  const font = await result.embedFont(StandardFonts.Helvetica);
  let total = 0;
  const addPage = (reference, position, count) => {
    if (++total > 80) throw new Error("BANK_APPENDIX_LIMIT");
    const page = result.addPage(PageSizes.A4);
    page.drawText("Anlage " + reference + "  |  Seite " + position + " / " + count, {
      x: margin, y: height - margin - 3, size: 11, font, color: rgb(0.11, 0.32, 0.38),
    });
    return page;
  };

  for (const file of workerData.files) {
    if (file.mime === "application/pdf") {
      const source = await PDFDocument.load(file.bytes, { updateMetadata: false, throwOnInvalidObject: true });
      const pages = source.getPages();
      if (!pages.length) throw new Error("Leere Anlage");
      if (total + pages.length > 80) throw new Error("BANK_APPENDIX_LIMIT");
      for (const [index, original] of pages.entries()) {
        const page = addPage(file.reference, index + 1, pages.length);
        if (!original.node.Contents()) continue;
        const crop = original.getCropBox();
        const embedded = await result.embedPage(original, {
          left: crop.x, bottom: crop.y, right: crop.x + crop.width, top: crop.y + crop.height,
        });
        const rotation = ((original.getRotation().angle % 360) + 360) % 360;
        page.drawPage(embedded, placement(embedded.width, embedded.height, rotation));
      }
    } else if (file.mime === "image/jpeg" || file.mime === "image/png") {
      const picture = file.mime === "image/png" ? await result.embedPng(file.bytes) : await result.embedJpg(file.bytes);
      addPage(file.reference, 1, 1).drawImage(picture, placement(picture.width, picture.height, 0));
    } else {
      throw new Error("Nicht unterstütztes Anlagenformat");
    }
  }
  return result.save();
}

try {
  const bytes = await append();
  parentPort.postMessage({ bytes });
} catch (error) {
  parentPort.postMessage({ error: error.message === "BANK_APPENDIX_LIMIT" ? error.message : "BANK_APPENDIX_INVALID" });
}
