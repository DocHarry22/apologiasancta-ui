import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/lib/theme";
import { ServiceWorkerRegistration } from "@/components/pwa/ServiceWorkerRegistration";
import { CapacitorShell } from "@/components/native/CapacitorShell";
import { WhatsNewPopup } from "@/components/releases/WhatsNewPopup";
import "./globals.css";


export const metadata: Metadata = {
  title: "Apologia Sancta Live",
  description: "Room-based live apologetics quiz, study library, and installable mobile web experience.",
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
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#d4af37",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body
        className="antialiased"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <ServiceWorkerRegistration />
          <WhatsNewPopup />
          {children}
          <CapacitorShell />
        </ThemeProvider>
      </body>
    </html>
  );
}
