import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import { generateReceivables } from "../src/modules/finance/service";
import { berlinToday } from "../src/modules/stammdaten/calendar";
import { getDb } from "../src/lib/db";
import { processNextReport } from "../src/modules/reports/jobs";
import { renderPdf } from "../src/modules/reports/pdf";

let stopping = false;
let generatedDay = 0;
let nextGeneration = 0;
process.on("SIGTERM", () => { stopping = true; });
process.on("SIGINT", () => { stopping = true; });
while (!stopping) {
  try {
    await writeFile(process.env.WORKER_HEARTBEAT || join(tmpdir(), "vermietung-worker-health"), String(Date.now()));
    const today = berlinToday();
    if (+today !== generatedDay && Date.now() >= nextGeneration) {
      try {
        await generateReceivables(null, today, null, true);
        generatedDay = +today;
      } catch {
        nextGeneration = Date.now() + 60_000;
        console.error("Automatische Mietforderungserzeugung wird erneut versucht.");
      }
    }
    if (!await processNextReport(renderPdf)) await wait(1500);
  } catch {
    console.error("PDF-Worker wartet nach einem Infrastrukturfehler.");
    await wait(5000);
  }
}
await getDb().$disconnect();
