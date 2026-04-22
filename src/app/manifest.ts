import type { MetadataRoute } from "next";

/**
 * PWA manifest — lets the CRM install as a home-screen app on iOS/Android.
 * Next.js picks up this file-based route automatically and serves it as
 * /manifest.webmanifest with the correct Content-Type.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FABBI CRM",
    short_name: "FABBI",
    description:
      "FABBI operating system — leads, proposals, and client onboarding in one place.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafbfd",
    theme_color: "#005bf7",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
