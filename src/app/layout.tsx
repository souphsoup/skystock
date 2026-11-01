import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, IBM_Plex_Mono } from "next/font/google";
import { RegisterSW } from "@/components/register-sw";
import { UpdateBanner } from "@/components/update-banner";
import { InstallGate } from "@/components/install-gate";
import { INSTALL_GATE_SCRIPT } from "@/components/install-gate-script";
import { THEME_SCRIPT } from "@/components/theme-script";
import { I18nProvider } from "@/i18n/client";
import { getLang } from "@/i18n/server";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  // Numbers only: fetched when a page shows them, so it doesn't compete with the Thai text font on 4G.
  preload: false,
});

export const metadata: Metadata = {
  title: "meStock · MAI The Sky Bar",
  description: "นับสต๊อกครัวและบาร์จากมือถือ",
  appleWebApp: { capable: true, title: "meStock", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0d141d" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const lang = await getLang();
  return (
    // suppressHydrationWarning: the inline scripts add data-theme / data-install before React hydrates.
    <html lang={lang} className={`${plexThai.variable} ${plexMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INSTALL_GATE_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <I18nProvider lang={lang}>
          <InstallGate />
          {children}
          <UpdateBanner />
        </I18nProvider>
        <RegisterSW />
      </body>
    </html>
  );
}
