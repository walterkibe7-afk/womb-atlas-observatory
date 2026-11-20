"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { LogOut, AlertTriangle } from "lucide-react";
import LanguagePicker from "@/components/observation/language-picker";
import { LANGUAGES } from "@/lib/observation/languages";
import { UI_STRINGS, type UiStrings } from "@/lib/observation/ui-strings";
import { logout } from "@/lib/logout";

/**
 * Shown once, right after first sign-in, before any portal chrome — the
 * account-level replacement for the observation wizard's old in-flow
 * language picker. Locked in permanently by /api/user/locale, so the
 * confirmation step exists specifically because this can't be undone.
 *
 * Lives outside every route group (no Sidebar, no portal shell) — enforced
 * from two places: this page's own redirect-on-success, and
 * ParticipantShell's defensive gate for anyone who lands elsewhere first
 * (notably Google sign-in, which never passes through the login page's own
 * post-auth effect).
 */
export default function ChooseLanguagePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [pendingChoice, setPendingChoice] = useState("en");
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [strings, setStrings] = useState<UiStrings>(UI_STRINGS);

  // Not signed in at all -> back to login. Already has a locale (e.g. she
  // navigated back here, or hit this URL directly after already choosing)
  // -> nothing to do here, on to the portal. Mirrors ParticipantShell's own
  // gate rather than introducing a new enforcement shape.
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }
    if (status === "authenticated" && (session?.user as { locale?: string | null } | undefined)?.locale) {
      router.push("/dashboard");
    }
  }, [status, session, router]);

  // Render the confirmation copy in the language just tapped, before it's
  // committed to anything — that's the whole point of naming it back to her.
  useEffect(() => {
    let cancelled = false;
    if (!selected || selected === "en") {
      Promise.resolve().then(() => {
        if (!cancelled) setStrings(UI_STRINGS);
      });
      return () => {
        cancelled = true;
      };
    }
    fetch(`/api/ui-strings?locale=${selected}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setStrings(data);
      })
      .catch(() => {
        /* stays on the English default */
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const selectedLanguage = LANGUAGES.find((l) => l.code === selected);

  async function confirm() {
    if (!selected) return;
    setConfirming(true);
    setError("");
    try {
      const res = await fetch("/api/user/locale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: selected }),
      });
      if (!res.ok && res.status !== 409) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Could not save your language");
      }
      // Hard navigation, deliberately not router.push: SessionProviderWrapper
      // is mounted once at the app root, so a client-side push would keep
      // serving the pre-PATCH session (locale: null) and ParticipantShell's
      // gate would immediately bounce back here. A full navigation remounts
      // it and forces a fresh session fetch, which re-runs the jwt callback
      // and picks up the now-set locale. Same pattern src/lib/logout.ts
      // already uses for the same reason.
      window.location.href = "/dashboard";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setConfirming(false);
    }
  }

  const hasLocale = !!(session?.user as { locale?: string | null } | undefined)?.locale;
  if (status === "loading" || status === "unauthenticated" || (status === "authenticated" && hasLocale)) {
    return <div className="theme-participant font-sans min-h-screen bg-[var(--color-background)]" />;
  }

  return (
    <div className="theme-participant font-sans min-h-screen bg-[var(--color-background)] relative">
      <button
        onClick={() => {
          localStorage.clear();
          logout();
        }}
        className="absolute top-6 right-6 flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted transition-colors hover:text-fg hover:bg-[var(--color-surface-hover)]"
      >
        <LogOut size={16} />
        <span>Log Out</span>
      </button>

      <div className="p-8 pb-20 max-w-2xl mx-auto space-y-8 pt-12">
        <div className="flex items-center gap-4 justify-center">
          <span className="bg-logo w-15 h-15 shrink-0 rounded-full flex items-center justify-center overflow-hidden border-[1.5px] border-border-brand shadow-[0_0_18px_rgba(200,154,82,.25)]">
            <Image src="/assets/logo-mark.png" alt="Womb Atlas" width={60} height={60} className="object-cover" />
          </span>
          <div className="leading-tight">
            <div className="font-serif font-bold text-[22px] tracking-[0.03em] text-logo whitespace-nowrap">WOMB ATLAS</div>
            <div className="font-mono text-xs tracking-[0.28em] text-logo-sub font-medium mt-0.5">OBSERVATORY</div>
          </div>
        </div>

        {!selected && (
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-serif text-fg">Welcome</h1>
            <p className="text-muted">Please select your preferred language to begin.</p>
          </div>
        )}

        {error && <p className="text-danger text-sm text-center">{error}</p>}

        {!selected ? (
          <div className="space-y-6">
            <LanguagePicker value={pendingChoice} onChange={setPendingChoice} />
            <button
              onClick={() => setSelected(pendingChoice)}
              className="w-full bg-[var(--color-brand-gold)] text-on-gold py-3 px-6 rounded-xl text-sm font-medium transition-colors"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className="space-y-6 text-center">
            <div>
              <p className="text-lg font-medium text-fg mb-1">{selectedLanguage?.nativeName}</p>
              <p className="text-xs text-faint mb-4">{selectedLanguage?.name}</p>
              <div className="flex flex-col items-center gap-2 text-center bg-[var(--color-surface)] border border-[var(--color-border-brand)] rounded-xl p-4">
                <AlertTriangle size={18} className="text-brand-gold shrink-0" />
                <p className="text-sm text-muted">{strings.confirmLanguageBody}</p>
              </div>
            </div>
            <button
              onClick={confirm}
              disabled={confirming}
              className="bg-[var(--color-brand-gold)] text-on-gold py-3 px-6 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {confirming ? strings.saving : strings.confirmLanguageButton}
            </button>
            <button
              onClick={() => setSelected(null)}
              disabled={confirming}
              className="block mx-auto text-xs text-muted hover:underline disabled:opacity-50"
            >
              {strings.changeSelection}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
