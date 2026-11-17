import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { DocumentType } from "@/generated/prisma/enums";
import { getDb } from "@/lib/db";
import { discardPrivate, putPrivate } from "@/lib/private-storage";
import { audit, MasterDataError, writeMasterData } from "@/modules/stammdaten/mutations";
import { idSchema, optional, optionalText } from "@/modules/stammdaten/validation";
import { identifyFile, scanDocument } from "./inspection";

const metadata = z.object({ propertyId: optional(idSchema), acquisitionProjectId: optional(idSchema), unitId: optional(idSchema), leaseId: optional(idSchema), expenseId: optional(idSchema),
  type: z.enum(DocumentType), description: optionalText(500) });

export async function storeDocument(actor: string, form: FormData) {
  const parsed = metadata.safeParse({
    ...Object.fromEntries(form), propertyId: form.get("propertyId") ?? "", acquisitionProjectId: form.get("acquisitionProjectId") ?? "", unitId: form.get("unitId") ?? "", leaseId: form.get("leaseId") ?? "", expenseId: form.get("expenseId") ?? "",
  });
  if (!parsed.success) throw new MasterDataError("Bitte prüfe Objekt, Dokumenttyp und Beschreibung.");
  const data = parsed.data;
  if (Boolean(data.propertyId) === Boolean(data.acquisitionProjectId)) throw new MasterDataError("Bitte eine Immobilie oder ein Kaufobjekt wählen.");
  if ([data.unitId, data.leaseId, data.expenseId].filter(Boolean).length > (data.acquisitionProjectId ? 0 : 1)) throw new MasterDataError("Bitte nur eine zusätzliche Zuordnung wählen.");
  const file = form.get("file");
  if (!(file instanceof File)) throw new MasterDataError("Bitte eine Datei auswählen.");
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = identifyFile(bytes);
  if (data.type === "PHOTO" && mime === "application/pdf") throw new MasterDataError("Objektfotos müssen JPEG oder PNG sein.");
  if (file.type && file.type !== "application/octet-stream" && file.type !== mime) throw new MasterDataError("Dateityp und Dateisignatur stimmen nicht überein.");
  const extension = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png" }[mime];
  const name = (file.name.split(/[\\/]/).at(-1) ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 150);
  const filename = (name.replace(/\.[^.]+$/, "") || "Dokument") + extension;
  await scanDocument(bytes);
  const id = randomUUID();
  await putPrivate("documents", id, bytes);
  try {
    await writeMasterData(async (tx) => {
      if (data.acquisitionProjectId && !await tx.acquisitionProject.findFirst({
        where: { id: data.acquisitionProjectId, convertedAt: null }, select: { id: true },
      })) throw new MasterDataError("Das Kaufobjekt ist archiviert oder nicht verfügbar.");
      const propertyId = data.propertyId;
      if (propertyId && (!await tx.property.findUnique({ where: { id: propertyId }, select: { id: true } }) ||
          (data.unitId && !await tx.rentalUnit.findFirst({ where: { id: data.unitId, propertyId } })) ||
          (data.leaseId && !await tx.lease.findFirst({ where: { id: data.leaseId, unit: { propertyId } } })) ||
          (data.expenseId && !await tx.expense.findFirst({ where: { id: data.expenseId, propertyId } })))) {
        throw new MasterDataError("Die Zuordnung gehört nicht zur gewählten Immobilie.");
      }
      await tx.document.create({ data: { ...data, id, filename, mime, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") } });
      await audit(tx, actor, "document.uploaded", "Document", id);
    });
  } catch (cause) {
    const committed = await getDb().document.findUnique({ where: { id }, select: { id: true } }).catch(() => undefined);
    if (committed === null) await discardPrivate("documents", id);
    if (!committed) throw cause;
  }
  return id;
}

export function documentList(propertyId: string | null, query: string) {
  const contains = { contains: query, mode: "insensitive" as const };
  return getDb().document.findMany({
    where: { propertyId: propertyId ?? { not: null }, OR: query ? [{ filename: contains }, { description: contains }, { property: { name: contains } }] : undefined },
    include: { property: { select: { name: true } }, unit: { select: { label: true } }, expense: { select: { description: true } },
      lease: { select: { startsOn: true, unit: { select: { label: true } } } } },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
}

export function documentTargets(propertyId: string) {
  return getDb().property.findUnique({ where: { id: propertyId }, select: { name: true, units: { select: { id: true, label: true, leases: { select: { id: true, startsOn: true } } } },
    expenses: { select: { id: true, description: true, paidOn: true }, orderBy: { paidOn: "desc" } } } });
}

export const documentTypes = { EXPOSE: "Exposé", CONTRACT: "Mietvertrag", PHOTO: "Objektfoto", INVOICE: "Beleg", STATEMENT: "Abrechnung", OTHER: "Sonstiges" } as const;
