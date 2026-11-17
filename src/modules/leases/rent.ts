import { Prisma } from "@/generated/prisma/client";

export function totalRent(condition: { baseRent: Prisma.Decimal; operatingCosts: Prisma.Decimal; heatingCosts: Prisma.Decimal }) {
  return condition.baseRent.plus(condition.operatingCosts).plus(condition.heatingCosts);
}
