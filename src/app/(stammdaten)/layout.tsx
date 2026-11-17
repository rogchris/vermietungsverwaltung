import type { ReactNode } from "react";
import { MasterNavigation } from "@/components/stammdaten/navigation";

export default function MasterDataLayout({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 pb-16 md:grid-cols-[9rem_minmax(0,1fr)] md:items-start md:pb-0 lg:grid-cols-[11rem_minmax(0,1fr)]">
    <MasterNavigation />
    <div className="grid min-w-0 gap-5">{children}</div>
  </div>;
}
