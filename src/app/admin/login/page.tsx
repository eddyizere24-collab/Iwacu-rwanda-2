"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Mail, Loader2, ShieldCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";

type Status = "idle" | "sending" | "sent" | "error";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setStatus("sending");

    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg("Shyiramo aderesi ya email yemewe.");
      setStatus("error");
      return;
    }

    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/admin/dashboard`,
          shouldCreateUser: false, // only pre-provisioned admins
        },
      });

      if (error) {
        // Common cases: user not found, rate limit
        if (error.message.toLowerCase().includes("signups not allowed")) {
          setErrorMsg(
            "Iyi email ntabwo yanditswe nk’umuyobozi. Vugana na super-admin."
          );
        } else if (error.status === 429) {
          setErrorMsg(
            "Wakoze ibisabwa byinshi. Tegereza gato hanyuma ugerageze."
          );
        } else {
          setErrorMsg(error.message || "Ikibazo cyabaye. Ongera ugerageze.");
        }
        setStatus("error");
        return;
      }

      setStatus("sent");
    } catch {
      setErrorMsg("Ikibazo cy’urukurikirane. Ongera ugerageze.");
      setStatus("error");
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Back link */}
        <Link
          href="/"
          className="mb-8 inline-flex min-h-[44px] items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Subira ku mbuga
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600/10 text-blue-600">
              <ShieldCheck className="h-7 w-7" aria-hidden />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Injira nk’umuyobozi
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Koresha Magic Link / Email OTP. Nta password isabwa.
            </p>
          </div>

          {status === "sent" ? (
            <div
              role="status"
              className="rounded-xl border border-green-600/30 bg-green-600/10 p-5 text-center"
            >
              <Mail className="mx-auto mb-3 h-8 w-8 text-green-600" aria-hidden />
              <p className="font-medium text-foreground">
                Reba imeri yawe
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Twohereje link yo kwinjira kuri{" "}
                <strong className="text-foreground">{email}</strong>.
                Fungura imeri hanyuma ukande ku link.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle");
                  setEmail("");
                }}
                className="mt-4 inline-flex min-h-[44px] items-center justify-center text-sm font-medium text-blue-600 hover:underline"
              >
                Koresha indi email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-sm font-medium text-foreground"
                >
                  Aderesi ya email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "sending"}
                  placeholder="umuyobozi@example.rw"
                  className="w-full min-h-[44px] rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-60"
                />
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={status === "sending"}
                className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Turimo kohereza...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" aria-hidden />
                    Ohereza Magic Link
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Gusa abayobozi banditswe bakemera kwinjira.  
          Serivisi ihuje na NCSA Law No. 058/2021.
        </p>
      </div>
    </div>
  );
}
