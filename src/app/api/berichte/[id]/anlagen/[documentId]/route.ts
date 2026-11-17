import { getDb } from "@/lib/db";
import { attachment } from "@/lib/private-storage";
import { problem } from "@/lib/http";
import { currentSession } from "@/modules/authentication/access";
import { allowsAccess } from "@/modules/authentication/policy";
import { idSchema } from "@/modules/stammdaten/validation";
import { readBankAttachment } from "@/modules/bank-package/attachments";
import { bankPayload } from "@/modules/bank-package/service";

export async function GET(_: Request, { params }: { params: Promise<{ id: string; documentId: string }> }) {
  const session = await currentSession();
  if (!session || !allowsAccess(session)) return problem(session ? 403 : 401, "ACCESS_DENIED");
  const { id, documentId } = await params;
  if (!idSchema.safeParse(id).success || !idSchema.safeParse(documentId).success) return problem(404, "NOT_FOUND");
  const snapshot = await getDb().bankSnapshot.findFirst({ where: { jobId: id, job: { userId: session.user.id } } });
  const file = snapshot ? bankPayload(snapshot).attachments.find((entry) => entry.id === documentId) : null;
  if (!file) return problem(404, "NOT_FOUND");
  const bytes = await readBankAttachment(file);
  if (!bytes) return problem(503, "FILE_UNAVAILABLE");
  return attachment(bytes, file.mime, file.filename);
}
