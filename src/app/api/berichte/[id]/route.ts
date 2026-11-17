import { getDb } from "@/lib/db";
import { problem } from "@/lib/http";
import { attachment, readPrivate } from "@/lib/private-storage";
import { currentSession } from "@/modules/authentication/access";
import { allowsAccess } from "@/modules/authentication/policy";
import { idSchema } from "@/modules/stammdaten/validation";
import { artifactName } from "@/modules/reports/jobs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await currentSession();
  if (!session || !allowsAccess(session)) return problem(session ? 403 : 401, "ACCESS_DENIED");
  const { id } = await params;
  if (!idSchema.safeParse(id).success) return problem(404, "NOT_FOUND");
  const job = await getDb().reportJob.findFirst({ where: { id, userId: session.user.id, status: "READY" }, include: { bankSnapshot: { select: { version: true } } } });
  if (!job) return problem(404, "NOT_FOUND");
  const bytes = await readPrivate("reports", artifactName(id, job.attempts)).catch(() => null);
  if (!bytes) return problem(503, "FILE_UNAVAILABLE");
  const filename = job.bankSnapshot ? "bankmappe-v" + job.bankSnapshot.version : job.type.toLowerCase() + "-" + job.period.toISOString().slice(0, 7);
  const response = attachment(bytes, "application/pdf", filename + ".pdf");
  if (new URL(request.url).searchParams.get("druck") === "1") {
    response.headers.set("content-disposition", response.headers.get("content-disposition")!.replace(/^attachment;/, "inline;"));
    response.headers.delete("content-security-policy");
  }
  return response;
}
