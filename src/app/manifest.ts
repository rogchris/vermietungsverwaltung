import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { name: "Vermietungsverwaltung", short_name: "Vermietung", lang: "de", start_url: "/dashboard",
    display: "standalone", background_color: "#121116", theme_color: "#1b1922", icons: [{ src: "/app-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }] };
}
