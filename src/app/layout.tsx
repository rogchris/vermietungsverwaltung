import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Building2 } from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vermietungsverwaltung",
  description: "Privater Arbeitsbereich für die Immobilienverwaltung.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="de">
    <body className="min-h-dvh">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-5 sm:px-8">
          <Building2 aria-hidden="true" className="size-6 shrink-0 text-primary" />
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">Immobilienverwaltung</p>
            <p className="font-semibold">Vermietungs Tool</p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-5 py-8 sm:px-8 sm:py-12">{children}</main>
    </body>
  </html>;
}
