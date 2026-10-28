"use client";

import { useState } from "react";
import Link from "next/link";
import { HelpCircle, Sun, Moon, Shield } from "lucide-react";
import { RwandanSun, AgasekeEmblem } from "./RwandanSun";
import { HelpModal, PrivacyModal } from "./HelpModal";

export function AppHeader() {
  const [helpOpen, setHelpOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  function toggleTheme() {
    setIsDark(!isDark);
    if (!isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-2.5 sm:px-6">
          {/* Logo & Brand with Agaseke and Rwandan Sun */}
          <Link href="/" className="flex items-center gap-2.5 group select-none">
            <div className="relative">
              <AgasekeEmblem size={38} className="group-hover:scale-105 transition-transform" />
              <div className="absolute -top-1.5 -right-1.5 pointer-events-none">
                <RwandanSun size={18} glow={false} />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-foreground text-base sm:text-lg">
                  IWACU RWANDA
                </span>
                <span className="inline-block h-2 w-2 rounded-full bg-[#00A3E0]" aria-hidden />
                <span className="inline-block h-2 w-2 rounded-full bg-[#FAD201]" aria-hidden />
                <span className="inline-block h-2 w-2 rounded-full bg-[#20603D]" aria-hidden />
              </div>
              <span className="block text-[10px] text-muted-foreground font-medium truncate">
                Menya abayobozi b&apos;aho uri
              </span>
            </div>
          </Link>

          {/* Navigation & Controls */}
          <nav className="flex items-center gap-2">
            {/* Help Button ('?') per D1 A6 */}
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Ubufasha (Help)"
              title="Ubufasha"
            >
              <HelpCircle className="h-5 w-5" aria-hidden />
            </button>

            {/* Light / Dark Mode Toggle per D1 A4 */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              aria-label={isDark ? "Isura y'urumuri" : "Isura y'umwijima"}
              title={isDark ? "Isura y'urumuri" : "Isura y'umwijima"}
            >
              {isDark ? (
                <Sun className="h-5 w-5 text-[#FAD201]" aria-hidden />
              ) : (
                <Moon className="h-5 w-5" aria-hidden />
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Modals */}
      <HelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
      <PrivacyModal isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </>
  );
}
