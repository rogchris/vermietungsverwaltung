import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { getDb } from "@/lib/db";
import { adminInput } from "./validation";

export async function bootstrapAdmin(rawInput: unknown) {
  const { name, email, password } = adminInput.parse(rawInput);
  const hash = await hashPassword(password);
  const id = randomUUID();

  await getDb().$transaction(async (tx) => {
    const claim = await tx.bootstrap.createMany({ data: { id: "initial-admin" }, skipDuplicates: true });
    if (claim.count !== 1) throw new Error("Die Administratoreinrichtung wurde bereits ausgeführt.");
    await tx.user.create({ data: { id, name, email, role: "ADMIN" } });
    await tx.account.create({
      data: { id: randomUUID(), userId: id, accountId: id, providerId: "credential", password: hash },
    });
    await tx.auditEvent.create({
      data: { actorId: id, action: "auth.admin_bootstrapped", targetType: "User", targetId: id },
    });
  });
}
