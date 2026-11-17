import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

type Bucket = "documents" | "reports";
function pathFor(bucket: Bucket, name: string) {
  if (!/^[a-f0-9-]{36}(?:-\d+\.pdf)?$/.test(name)) throw new Error("Ungültiger privater Speichername.");
  const root = resolve(/*turbopackIgnore: true*/ process.env.APP_DATA_DIR || ".private-data");
  const publicDir = relative(resolve("public"), root);
  if (!publicDir || (!(publicDir === ".." || publicDir.startsWith(".." + sep)) && !isAbsolute(publicDir))) throw new Error("Der Speicher muss außerhalb von public liegen.");
  return join(/*turbopackIgnore: true*/ root, bucket, name);
}

export async function putPrivate(bucket: Bucket, name: string, bytes: Uint8Array) {
  const path = pathFor(bucket, name);
  await mkdir(/*turbopackIgnore: true*/ join(/*turbopackIgnore: true*/ path, ".."), { recursive: true, mode: 0o700 });
  await writeFile(/*turbopackIgnore: true*/ path, bytes, { flag: "wx", mode: 0o600 });
}

export function readPrivate(bucket: Bucket, name: string) {
  return readFile(/*turbopackIgnore: true*/ pathFor(bucket, name));
}

export async function privateFileExists(bucket: Bucket, name: string, size: number) {
  const info = await stat(/*turbopackIgnore: true*/ pathFor(bucket, name)).catch(() => null);
  return Boolean(info?.isFile() && info.size === size);
}

export async function discardPrivate(bucket: Bucket, name: string) {
  try { await unlink(/*turbopackIgnore: true*/ pathFor(bucket, name)); } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code !== "ENOENT") throw cause;
  }
}

export function attachment(bytes: Uint8Array, mime: string, filename: string) {
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": mime, "Content-Length": String(bytes.byteLength),
    "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(filename).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16)),
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  } });
}
