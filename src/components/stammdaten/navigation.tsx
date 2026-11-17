"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Ellipsis, KeyRound, LayoutDashboard, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/immobilien", label: "Immobilien", icon: Building2 },
  { href: "/ankauf", label: "Ankauf", icon: KeyRound },
  { href: "/finanzen", label: "Finanzen", icon: Wallet },
  { href: "/mehr", label: "Mehr", icon: Ellipsis },
];

export function MasterNavigation() {
  const path = usePathname();
  return <nav aria-label="Stammdaten" className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:static md:flex md:flex-col md:gap-1 md:rounded-lg md:border md:bg-transparent md:p-2">
    {links.map(({ href, label, icon: Icon }) => {
      const active = path === href || path.startsWith(href + "/") || (href === "/immobilien" && path.startsWith("/einheiten/")) ||
        (href === "/mehr" && ["/dokumente", "/berichte", "/mieter", "/mietvertraege"].some((route) => path.startsWith(route)));
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn(
        "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs text-muted-foreground hover:bg-background md:min-h-11 md:flex-row md:justify-start md:gap-3 md:px-3 md:text-sm",
        active && "bg-background font-semibold text-primary md:bg-card",
      )}>
        <Icon className="size-4" aria-hidden="true" /> {label}
      </Link>;
    })}
  </nav>;
}
