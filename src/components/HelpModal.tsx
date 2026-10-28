"use client";

import { X, HelpCircle, Smartphone, Compass, PhoneCall } from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Ubufasha (Help sheet) per D1 section J:
 * J1: Umutwe: Ubufasha
 * J2: Uko ukoresha: 1) Kanda «Menya aho ndi». 2) Emera GPS telefone ikubajije. 3) Reba abayobozi bawe, ubahamagare.
 * J3: Uko ufungura GPS: Settings (Igenamiterere) › Location (Aho uri) › Fungura. Hanyuma ugaruke hano.
 * J4: Ubutabazi: Nimero z'ubutabazi ziri hasi hose ku rupapuro. Kanda «Hamagara 112» iyo ari ikibazo cyihutirwa.
 * J5: Funga
 */
export function HelpModal({ isOpen, onClose }: HelpModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2 text-foreground">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
              <HelpCircle className="h-5 w-5" aria-hidden />
            </div>
            <h2 id="help-modal-title" className="text-lg font-bold">
              Ubufasha
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Funga"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 text-sm text-foreground">
          {/* J2: Uko ukoresha */}
          <div className="rounded-xl border border-border bg-background p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400">
              <Compass className="h-4 w-4" />
              Uko ukoresha uru rubuga:
            </h3>
            <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside pl-1">
              <li>
                Kanda <strong className="text-foreground">«Menya aho ndi»</strong>.
              </li>
              <li>
                <strong className="text-foreground">Emera GPS</strong> telefone yawe niramuka ikubajije uruhushya.
              </li>
              <li>
                Reba abayobozi b&apos;agace kawe, ubahamagare cyangwa ubandikire kuri WhatsApp.
              </li>
            </ol>
          </div>

          {/* J3: Uko ufungura GPS */}
          <div className="rounded-xl border border-border bg-background p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-1.5 text-foreground">
              <Smartphone className="h-4 w-4 text-emerald-600" />
              Niba GPS ifunze:
            </h3>
            <p className="text-xs text-muted-foreground">
              Fungura: <strong className="text-foreground">Settings (Igenamiterere)</strong> › <strong className="text-foreground">Location (Aho uri)</strong> › Fungura. Hanyuma ugaruke hano.
            </p>
          </div>

          {/* J4: Ubutabazi */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <h3 className="font-semibold flex items-center gap-2 mb-1 text-red-600 dark:text-red-400">
              <PhoneCall className="h-4 w-4" />
              Ubutabazi bwihuse:
            </h3>
            <p className="text-xs text-muted-foreground">
              Nimero z&apos;ubutabazi ziri hasi hose ku rupapuro. Kanda <strong className="text-foreground">«Hamagara 112»</strong> iyo ari ikibazo cyihutirwa.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full min-h-[44px] rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Funga
        </button>
      </div>
    </div>
  );
}

/**
 * Amakuru yawe (Privacy sheet) per D1 section K
 */
export function PrivacyModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <h2 id="privacy-modal-title" className="text-lg font-bold text-foreground">
            Amakuru yawe (Ibanga ry’amakuru)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Funga"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3.5 text-xs text-muted-foreground leading-relaxed">
          <p>
            <strong className="text-foreground">Ntidusaba konti:</strong> Ntidusaba izina, ifoto cyangwa nimero ya telefone yawe.
          </p>
          <p>
            <strong className="text-foreground">Aho uri:</strong> Twohereza aho uri gusa kuri seriveri yacu kugira ngo tumenye umudugudu wawe. <strong className="text-foreground">Ntitubika aho wabaye.</strong>
          </p>
          <p>
            <strong className="text-foreground">Umutekano w&apos;urubuga:</strong> Mu kurinda urubuga gukoreshwa nabi, dukoresha aderesi ya interineti ya telefone yawe mu gihe gito gusa (rate limiting).
          </p>
          <p>
            <strong className="text-foreground">Nimero z&apos;abayobozi:</strong> Zigaragara kuri bose mu rwego rwo korohereza umuturage kugera ku buyobozi, hubahirijwe amategeko y&apos;uburinzi bw&apos;amakuru bwite (NCSA Law No. 058/2021).
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full min-h-[44px] rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Nabyumvise
        </button>
      </div>
    </div>
  );
}
