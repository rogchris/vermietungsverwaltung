import { createConnection } from "node:net";
import { MasterDataError } from "@/modules/stammdaten/mutations";

export const maxDocumentBytes = 10 * 1024 * 1024;
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function identifyFile(bytes: Buffer) {
  if (bytes.length < 12 || bytes.length > maxDocumentBytes) throw new MasterDataError("Die Datei ist leer oder überschreitet 10 MiB.");
  if (/^%PDF-[12]\.\d[\r\n]/.test(bytes.subarray(0, 12).toString("ascii")) &&
      /%%EOF\s*$/.test(bytes.subarray(-1024).toString("ascii"))) return "application/pdf";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 && bytes.at(-2) === 255 && bytes.at(-1) === 217) return "image/jpeg";
  if (bytes.subarray(0, 8).equals(png)) {
    let offset = 8;
    let image = false;
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const type = bytes.toString("ascii", offset + 4, offset + 8);
      if (length > bytes.length - offset - 12) break;
      if (offset === 8 && (type !== "IHDR" || length !== 13 || !bytes.readUInt32BE(offset + 8) || !bytes.readUInt32BE(offset + 12))) break;
      if (type === "IDAT") image = true;
      offset += length + 12;
      if (type === "IEND" && length === 0 && offset === bytes.length && image) return "image/png";
    }
  }
  throw new MasterDataError("Die Datei muss ein gültiges PDF, JPEG oder PNG sein.");
}

export async function scanDocument(bytes: Buffer) {
  const host = process.env.CLAMAV_HOST;
  if (!host) {
    if (process.env.REQUIRE_MALWARE_SCAN === "1") throw new MasterDataError("Der Virenscanner ist nicht eingerichtet.");
    return;
  }
  const size = Buffer.alloc(4);
  size.writeUInt32BE(bytes.length);
  const result = await new Promise<string>((resolve, reject) => {
    const socket = createConnection({ host, port: 3310 }, () => {
      socket.write(Buffer.concat([Buffer.from("zINSTREAM\0"), size, bytes, Buffer.alloc(4)]));
    });
    const timer = setTimeout(() => socket.destroy(new Error("Scan timeout")), 15_000);
    let result = "";
    socket.on("data", (data) => {
      result += data.toString("ascii");
      if (result.includes("\0")) { resolve(result); socket.destroy(); }
      else if (result.length > 4096) socket.destroy(new Error("Invalid response"));
    });
    socket.on("error", reject);
    socket.on("close", () => { clearTimeout(timer); reject(new Error("Scanner connection closed")); });
  }).catch(() => { throw new MasterDataError("Der Virenscanner ist zurzeit nicht erreichbar."); });
  if (result.trim().replace(/\0$/, "") !== "stream: OK") throw new MasterDataError("Die Datei wurde durch die Sicherheitsprüfung abgewiesen.");
}
