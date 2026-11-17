import { getDb } from "@/lib/db";
import { problem } from "@/lib/http";
import { attachment, readPrivate } from "@/lib/private-storage";
import { currentSession } from "@/modules/authentication/access";
import { allowsAccess } from "@/modules/authentication/policy";
import { idSchema } from "@/modules/stammdaten/validation";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session || !allowsAccess(session)) return problem(session ? 403 : 401, "ACCESS_DENIED");
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return problem(404, "NOT_FOUND");
  const file = await getDb().document.findUnique({ where: { id } });
  if (!file) return problem(404, "NOT_FOUND");
  const bytes = await readPrivate("documents", id).catch(() => null);
  if (!bytes) return problem(503, "FILE_UNAVAILABLE");
  return attachment(bytes, file.mime, file.filename);
}
