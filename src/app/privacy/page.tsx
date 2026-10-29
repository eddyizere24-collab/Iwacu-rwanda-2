import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { RwandanSun } from "@/components/RwandanSun";

export const metadata = {
  title: "Uburinzi bw'amakuru | IWACU RWANDA",
  description: "Ibisobanuro ku makuru akoreshwa na IWACU RWANDA.",
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/"
        className="mb-7 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Subira ku rubuga
      </Link>

      <header className="rounded-3xl border border-sky-200/70 bg-card p-6 text-center shadow-sm sm:p-9">
        <div className="mb-3 flex justify-center"><RwandanSun size={54} glow /></div>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-700 dark:text-sky-300">
          <ShieldCheck className="h-4 w-4" aria-hidden />
          Ibisobanuro by'uburenganzira bwawe
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          Uburinzi bw'amakuru bwite
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">Byavuguruwe: 29 Ukwakira 2026</p>
      </header>

      <section className="mt-6 space-y-6 rounded-3xl border border-border bg-card p-5 sm:p-8">
        <div className="rounded-2xl border border-amber-300/70 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
          <strong>Icyitonderwa:</strong> Iyi ni inyandiko y'ibanze isobanura uko verisiyo iriho ikora. Si icyemezo cy'uko urubuga rwemejwe n'urwego rushinzwe amategeko. Isuzuma ry'inzobere mu mategeko no mu kurinda amakuru, hamwe no gushyiraho uburyo bwo kutwandikira, bigomba kurangira mbere yo gutangira gukoresha urubuga ku rwego rusange.
        </div>

        <section>
          <h2 className="text-lg font-bold">1. Ni ayahe makuru akoreshwa?</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Iyo uhisemo <strong>“Menya aho ndi”</strong> ukemera gukoresha GPS, telefone yohereza aho iri n'urwego GPS ishobora kwibeshyaho kugira ngo IWACU igaragaze ahantu hashoboka. Ushobora no gushaka ahantu wanditse izina ry'akarere, umurenge cyangwa umudugudu. Gukoresha serivisi z'ibanze ntibisaba konti.
          </p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Iyo wohereje raporo ivuga ko nimero itagikora, amakuru wanditse muri iyo raporo abikwa kugira ngo asuzumwe. Irinde kwandika amakuru bwite atari ngombwa mu gice cy'ibitekerezo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">2. Ayo makuru anyura he?</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Amakuru y'aho uri anyura kuri seriveri ya IWACU kugira ngo ahuzwe n'ikarita y'inzego z'ubuyobozi. Mu gihe uburyo busanzwe bwo gushaka ahantu butabonetse, urubuga rushobora kohereza agace k'ikarita kajyanye n'aho GPS igaragaza kuri serivisi rusange y'amakarita y'ibarurishamibare (NISR) kugira ngo rushakishe umudugudu. Iyo ukoresheje gushaka ahantu wanditse, inyandiko y'icyo ushaka ishobora koherezwa kuri iyo serivisi.
          </p>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Verisiyo iriho ntabwo ihuza ibiganiro na Groq cyangwa indi AI/LLM. Serivisi z'ububiko, hosting n'itumanaho zishobora kandi gutunganya amakuru ya tekiniki y'ibisabwa kuri internet hakurikijwe uko ziteguye n'amabwiriza yazo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">3. Nimero z'abayobozi</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Uru rubuga rugenewe kugaragaza amakuru y'inzego z'ubuyobozi n'abayobozi bemejwe. Nimero zitelefone zigomba guhishwa ku bantu bose, kandi uburyo bwo kuzireba bwuzuye bugahabwa gusa abayobozi bemejwe bafite uburenganzira. Kugeza ku itariki iri hejuru, ububiko bw'amakuru bw'iyi verisiyo ntiburimo inyandiko z'abayobozi zigaragara nk'izemejwe; ntukishingikirize kuri uru rubuga nk'urutonde rwuzuye rw'abayobozi.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">4. Ibyo ugomba kumenya no guhitamo</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Ushobora kwanga uburenganzira bwa GPS kuri telefone yawe, cyangwa ugakomeza utayikoresheje maze ugashaka ahantu wanditse aho bishoboka. Ijanisha ry'icyizere ni igereranya rishingiye ku gipimo cya GPS n'ikarita; si gihamya ntakuka y'aho umuntu aherereye. Urashobora no kubaza niba amakuru y'ahantu ari yo cyangwa gutanga raporo ku makuru atari yo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold">5. Ibitari byarangira mbere yo gutangira ku mugaragaro</h2>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Igihe amakuru abikwa, uburyo bwo gusaba ko akosorwa cyangwa asibwa, n'aho umuntu yandikira ku bibazo by'ubuzima bwite bigomba gusobanurwa neza no gushyirwaho n'abashinzwe umushinga nyuma y'isuzuma ry'amategeko. Iyi nyandiko ntihisha ko ibyo bikiri mu mirimo itararangira.
          </p>
        </section>

        <div className="border-t border-border pt-5 text-sm leading-7 text-muted-foreground">
          <h2 className="text-lg font-bold text-foreground">English summary</h2>
          <p className="mt-2">
            IWACU uses GPS coordinates and reported accuracy when a user chooses location lookup. If its usual lookup cannot complete, it may send the corresponding accuracy-area geometry to the public NISR boundary service. Manual place-search terms may also be sent to NISR. The current route does not call an AI/LLM. User-submitted inactive-number reports are stored for review. The live leaders table currently has no active leader records, so the directory is not yet complete. Retention periods, a privacy contact, and formal legal review remain launch requirements; this page is an operational notice, not a legal-compliance certification.
          </p>
        </div>
      </section>
    </main>
  );
}
