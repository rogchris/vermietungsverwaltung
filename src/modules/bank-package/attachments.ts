import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { Worker } from "node:worker_threads";
import { readPrivate } from "@/lib/private-storage";
import type { BankPayload } from "./snapshot";

type Attachment = BankPayload["attachments"][number];

export async function readBankAttachment(file: Attachment) {
  if (!file.available) return null;
  const bytes = await readPrivate("documents", file.id).catch(() => null);
  if (!bytes || bytes.length !== file.size || createHash("sha256").update(bytes).digest("hex") !== file.sha256) return null;
  return bytes;
}

export async function appendBankAttachments(pdf: Uint8Array, payload: BankPayload): Promise<Uint8Array> {
  const selected = new Set(payload.appendices ?? []);
  if (!selected.size) return pdf;
  const files = [];
  for (const file of payload.attachments) {
    if (!selected.has(file.id)) continue;
    const bytes = await readBankAttachment(file);
    if (!bytes) throw new Error("BANK_APPENDIX_UNAVAILABLE");
    files.push({ reference: file.reference, mime: file.mime, bytes });
  }

  const worker = new Worker(resolve(/*turbopackIgnore: true*/ process.cwd(), "worker/bank-attachments.mjs"), {
    workerData: { pdf, files }, resourceLimits: { maxOldGenerationSizeMb: 128 },
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await new Promise<Uint8Array>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("BANK_APPENDIX_TIMEOUT")), 30_000);
      worker.once("message", (result: { bytes?: Uint8Array; error?: string }) => {
        if (result.bytes instanceof Uint8Array) resolve(result.bytes);
        else reject(new Error(result.error === "BANK_APPENDIX_LIMIT" ? result.error : "BANK_APPENDIX_INVALID"));
      });
      worker.once("error", () => reject(new Error("BANK_APPENDIX_INVALID")));
      worker.once("exit", () => reject(new Error("BANK_APPENDIX_INVALID")));
    });
  } finally {
    if (timer) clearTimeout(timer);
    await worker.terminate();
  }
}
