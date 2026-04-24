import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Barlow, Fraunces } from "next/font/google";
import { config } from "@/lib/config";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

// Display face for the FABBI wordmark + intake H1s — matches the marketing
// site at fabbi.co so the intake flow reads as one branded experience.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fraunces",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FABBI CRM",
  description: "Internal operating system for FABBI's new business pipeline.",
  // Explicit icon references so the manifest and <head> all point at the same
  // assets served from /public (stable paths, no hashing).
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  },
  // PWA-specific hints for iOS Safari. These make "Add to Home Screen" feel
  // native: full-screen launch, branded status bar, correct app title.
  appleWebApp: {
    capable: true,
    title: "FABBI",
    statusBarStyle: "black-translucent",
  },
  // Tell iOS/Android this is a standalone app when launched from home screen.
  applicationName: "FABBI",
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  // Swapped to brand blue — what phones use to tint the status bar chrome
  // when the PWA is launched standalone.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#005bf7" },
    { media: "(prefers-color-scheme: dark)", color: "#07183a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en" className={`${barlow.variable} ${fraunces.variable}`}>
      <body className="min-h-screen bg-brand-blue-tint text-brand-navy antialiased">
        {children}
      </body>
    </html>
  );

  if (!config.authEnabled) return body;
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#005bf7",
          colorBackground: "#ffffff",
          colorText: "#07183a",
        },
      }}
    >
      {body}
    </ClerkProvider>
  );
}
