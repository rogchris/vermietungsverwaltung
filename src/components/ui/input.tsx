import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// Lokale shadcn/ui-Komponente mit den Eingabegrößen und Farben der Anwendung.
export function Input({ className, type, ...props }: ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(
    "min-h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 py-1 text-base shadow-xs outline-none",
    "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/60",
    "aria-invalid:border-red-400 aria-invalid:ring-red-400/25",
    "disabled:pointer-events-none disabled:opacity-50",
    className,
  )} {...props} />;
}
