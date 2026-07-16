import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/lib/theme";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { CapacitorShell } from "@/components/native/CapacitorShell";
import { WhatsNewPopup } from "@/components/releases/WhatsNewPopup";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://sandybrown-bear-488955.hostingersite.com";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Apologia Sancta | Catholic Learning and Live Quiz Competition",
    template: "%s | Apologia Sancta",
  },
  description: "Learn sourced Catholic apologetics, practice with explanations, and compete in live quiz rooms.",
  keywords: ["Catholic apologetics", "Catechism", "Bible quiz", "Catholic learning", "live quiz"],
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/app-icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/app-icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/app-icons/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Apologia Sancta",
  },
  applicationName: "Apologia Sancta",
  category: "education",
  openGraph: {
    type: "website",
    siteName: "Apologia Sancta",
    title: "Know the Faith. Give the reason.",
    description: "Sourced Catholic formation, solo practice, and live quiz competition.",
    url: "/",
    images: [{
      url: "/apologia-sancta-social.png",
      width: 1728,
      height: 910,
      alt: "Apologia Sancta — Learn the faith. Defend it with charity.",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Apologia Sancta",
    description: "Sourced Catholic formation, solo practice, and live quiz competition.",
    images: ["/apologia-sancta-social.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeBootstrap = `
(() => {
  try {
    const key = "apologia-sancta-theme";
    const saved = localStorage.getItem(key);
    const preference = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    const theme = preference === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : preference;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = preference;
    document.getElementById("apologia-theme-color")?.setAttribute("content", theme === "dark" ? "#081B29" : "#F7F2E8");
  } catch {
    const theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themePreference = "system";
    document.getElementById("apologia-theme-color")?.setAttribute("content", theme === "dark" ? "#081B29" : "#F7F2E8");
  }
})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta id="apologia-theme-color" name="theme-color" content="#F7F2E8" />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body
        className="antialiased"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <a className="skip-link" href="#main-content">Skip to main content</a>
          <ServiceWorkerRegistration />
          <WhatsNewPopup />
          {children}
          <CapacitorShell />
        </ThemeProvider>
      </body>
    </html>
  );
}
