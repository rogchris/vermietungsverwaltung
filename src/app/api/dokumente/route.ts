import { currentSession } from "@/modules/authentication/access";
import { allowsAccess } from "@/modules/authentication/policy";
import { privateHeaders, problem } from "@/lib/http";
import { maxDocumentBytes } from "@/modules/documents/inspection";
import { storeDocument } from "@/modules/documents/service";
import { MasterDataError } from "@/modules/stammdaten/mutations";

const limit = maxDocumentBytes + 32_768;
export async function POST(request: Request) {
  const session = await currentSession();
  if (!session || !allowsAccess(session, true)) return problem(session ? 403 : 401, "ACCESS_DENIED");
  const origin = process.env.BETTER_AUTH_URL;
  if (!origin || request.headers.get("origin") !== new URL(origin).origin) return problem(403, "ORIGIN_DENIED");
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data;") || !request.body) return problem(400, "INVALID_UPLOAD");
  if (Number(request.headers.get("content-length")) > limit) return problem(413, "UPLOAD_TOO_LARGE");
  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > limit) { await reader.cancel(); return problem(413, "UPLOAD_TOO_LARGE"); }
      chunks.push(Buffer.from(value));
    }
    const form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { "content-type": type } }).formData().catch(() => null);
    if (!form) return problem(400, "INVALID_UPLOAD");
    const id = await storeDocument(session.user.id, form);
    return Response.json({ id }, { status: 201, headers: privateHeaders });
  } catch (cause) {
    if (cause instanceof MasterDataError) return Response.json({ error: cause.message }, { status: 422, headers: privateHeaders });
    console.error("Dokumentenupload fehlgeschlagen.");
    return problem(500, "UPLOAD_FAILED");
  }
}
