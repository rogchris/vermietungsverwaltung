import { z } from "zod";
import { UnitStatus, UnitUse } from "@/generated/prisma/enums";
import { decimal, integer, optional, optionalText, requiredText } from "../stammdaten/validation";

export const editableUnitStatuses = [UnitStatus.VACANT, UnitStatus.RENTED, UnitStatus.RENOVATION, UnitStatus.UNRENTABLE] as const;

export const unitInput = z.object({
  label: requiredText(80),
  floor: optional(optionalText(60)),
  livingArea: decimal(10),
  rooms: optional(decimal(3)),
  use: z.enum(UnitUse),
  status: z.enum(editableUnitStatuses),
  features: optionalText(4000),
  parkingSpaces: integer(0, 999),
});
