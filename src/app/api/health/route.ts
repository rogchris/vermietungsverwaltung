import { getDb } from "@/lib/db";
import { privateHeaders } from "@/lib/http";

export async function GET() {
  try {
    await getDb().$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: privateHeaders });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers: privateHeaders });
  }
}
