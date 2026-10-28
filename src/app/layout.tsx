import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { EmergencyBar } from "@/components/EmergencyBar";

export const metadata: Metadata = {
  title: "IWACU RWANDA",
  description:
    "Civic geospatial platform for locating local leaders in Rwanda (Gasabo District MVP) with NCSA compliance.",
  manifest: "/manifest.json",
  openGraph: {
    title: "IWACU RWANDA",
    description:
      "Civic geospatial platform for locating local leaders in Rwanda (Gasabo District MVP) with NCSA compliance.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="rw">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-blue-600 selection:text-white">
        <EmergencyBar />

        <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-40">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-md shadow-blue-600/20 group-hover:scale-105 transition-transform">
                I
              </div>
              <div>
                <span className="font-bold tracking-tight text-foreground text-base">
                  IWACU RWANDA
                </span>
                <span className="block text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  Gasabo MVP · NCSA Law No. 058/2021
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                Kinyarwanda
              </span>
              <Link
                href="/admin/login"
                className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                Injira nk’umuyobozi
              </Link>
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="border-t border-border mt-16 py-8 text-center text-xs text-muted-foreground">
          <div className="mx-auto max-w-5xl px-4 space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold text-foreground">
              <a href="tel:112" className="text-blue-600 hover:underline">
                112 Polisi
              </a>
              <span className="text-muted-foreground">·</span>
              <a href="tel:113" className="text-orange-600 hover:underline">
                113 Abazimya umuriro
              </a>
              <span className="text-muted-foreground">·</span>
              <a href="tel:912" className="text-red-600 hover:underline">
                912 Ambulance
              </a>
            </div>
            <p>
              IWACU RWANDA · Menya ahantu uri n’abayobozi bawe mu Gasabo.
            </p>
            <p className="text-[11px] text-muted-foreground/80">
              Amakuru n’umwirondoro byubahiriza itegeko NCSA Law No. 058/2021
              rigenga uburinzi bw’amakuru bwite.
            </p>
          </div>
        </footer>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(console.error);
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
