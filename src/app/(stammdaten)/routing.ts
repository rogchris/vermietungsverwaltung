import { notFound } from "next/navigation";
import { idSchema } from "@/modules/stammdaten/validation";

export type Search = Promise<Record<string, string | string[] | undefined>>;
export type DetailProps = { params: Promise<{ id: string }>; searchParams: Search };

export function queryValue(value: string | string[] | undefined, max = 80) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function queryOption<const T extends readonly string[]>(value: string | string[] | undefined, options: T, fallback: T[number]): T[number] {
  const candidate = queryValue(value);
  return options.find((option) => option === candidate) ?? fallback;
}

export async function detailId(params: DetailProps["params"]) {
  const result = idSchema.safeParse((await params).id);
  if (!result.success) notFound();
  return result.data;
}
