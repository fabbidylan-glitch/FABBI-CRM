import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { Barlow } from "next/font/google";
import { config } from "@/lib/config";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FABBI CRM",
  description: "Internal operating system for FABBI's new business pipeline.",
};

export const viewport: Viewport = {
  themeColor: "#07183a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const body = (
    <html lang="en" className={barlow.variable}>
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
