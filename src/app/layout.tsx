import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import Header from "@/components/Header";
import SessionProvider from "@/components/SessionProvider";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-display",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Pouls — bien-être, engagement et performance",
  description: "Check-in hebdomadaire bien-être, engagement et performance des équipes.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Pouls" },
};

export const viewport: Viewport = {
  themeColor: "#f5f3ee",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${bricolage.variable} ${figtree.variable}`}>
      <body>
        <SessionProvider>
          <ServiceWorkerRegister />
          <div className="flex min-h-screen flex-col">
            <Header />
            <main className="mx-auto w-full max-w-[1080px] flex-1 px-6 pb-16 pt-8">{children}</main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
