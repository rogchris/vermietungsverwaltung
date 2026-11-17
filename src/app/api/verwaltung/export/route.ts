import { Readable } from "node:stream";
import { currentSession } from "@/modules/authentication/access";
import { allowsAccess } from "@/modules/authentication/policy";
import { problem } from "@/lib/http";
import { getDb } from "@/lib/db";
import { exportArchive, exportSnapshot } from "@/modules/administration/export";

export async function GET() {
  const session = await currentSession();
  if (!session || !allowsAccess(session, true)) return problem(session ? 403 : 401, "ACCESS_DENIED");
  try {
    const snapshot = await exportSnapshot();
    await getDb().auditEvent.create({ data: { actorId: session.user.id, action: "administration.export_requested" } });
    const stream = Readable.toWeb(Readable.from(exportArchive(snapshot))) as ReadableStream<Uint8Array>;
    return new Response(stream, { headers: {
      "Content-Type": "application/x-tar", "Content-Disposition": "attachment; filename=vermietung-datenexport.tar",
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    console.error("Datenexport fehlgeschlagen.");
    return problem(503, "EXPORT_UNAVAILABLE");
  }
}
