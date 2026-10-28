import type { Metadata } from "next";
import "./globals.css";
import { AppHeader } from "@/components/AppHeader";
import { EmergencyStrip } from "@/components/EmergencyStrip";

export const metadata: Metadata = {
  title: "IWACU RWANDA — Menya abayobozi b'aho uri",
  description:
    "Kanda «Menya aho ndi», ubone umudugudu wawe n'abayobozi bawo, ubahamagare. Harimo na nimero z'ubutabazi.",
  manifest: "/manifest.json",
  openGraph: {
    title: "IWACU RWANDA — Menya abayobozi b'aho uri",
    description:
      "Kanda «Menya aho ndi», ubone umudugudu wawe n'abayobozi bawo, ubahamagare. Harimo na nimero z'ubutabazi.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="rw" className="scroll-smooth">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00A3E0" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-[#00A3E0] selection:text-white pb-24">
        {/* Top Header with Rwandan Sun & Agaseke branding */}
        <AppHeader />

        {/* Main Viewport Content */}
        <main id="main-content" className="relative">
          {children}
        </main>

        {/* Fixed Emergency Strip at the bottom */}
        <EmergencyStrip />

        {/* Service Worker Registration & Cache Busting */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  // Purge old caches unconditionally
                  if ('caches' in window) {
                    caches.keys().then((keys) => {
                      keys.forEach((key) => {
                        if (!key.includes('v2-nocache-html')) {
                          caches.delete(key);
                        }
                      });
                    });
                  }

                  navigator.serviceWorker.register('/sw.js').then((reg) => {
                    reg.update();
                  }).catch(console.error);
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
