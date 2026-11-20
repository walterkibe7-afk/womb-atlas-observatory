"use client";

import { Sidebar } from "@/components/Sidebar";
import { ChatPanel } from "@/components/chat/ChatPanel";
import {
  ParticipantDataProvider,
  useParticipantData,
} from "@/components/ParticipantDataProvider";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Menu } from "lucide-react";
import { UiStringsProvider } from "@/lib/observation/ui-strings-context";
import { UI_STRINGS, type UiStrings } from "@/lib/observation/ui-strings";

export default function ParticipantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ParticipantDataProvider>
      <ParticipantShell>{children}</ParticipantShell>
    </ParticipantDataProvider>
  );
}

function ParticipantShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const { summary, loading } = useParticipantData();
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [uiStrings, setUiStrings] = useState<UiStrings>(UI_STRINGS);

  // Close the mobile drawer on every navigation, however it happened. Adjusted
  // during render (rather than an effect) per React's "resetting state when a
  // prop changes" pattern — no extra render-then-reset flash.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setSidebarOpen(false);
  }

  useEffect(() => {
    if (status === "loading") return;

    // Redirect unauthenticated users to login
    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    // Check that the user has the participant role
    const role = (session?.user as { role?: string } | undefined)?.role?.toLowerCase();
    if (role && role !== "participant") {
      switch (role) {
        case "admin":
          router.push("/admin");
          break;
        case "steward":
          router.push("/steward");
          break;
        case "analyst":
          router.push("/analyst");
          break;
        default:
          // Unknown role - sign out to break the infinite redirect loop
          import("@/lib/logout").then(({ logout }) => logout());
      }
      return;
    }

    // Language is a one-time, permanent, account-level choice made on
    // /choose-language (outside this route group, so this effect never runs
    // there). This is the ONLY enforcement point for a Google sign-in — that
    // flow redirects straight to /dashboard server-side and never passes
    // through the login page's own post-auth check.
    const locale = (session?.user as { locale?: string | null } | undefined)?.locale;
    if (!locale) {
      router.push("/choose-language");
      return;
    }

    // The observation page manages its own resume/edit flow — never gate it.
    if (pathname === "/observation") {
      setIsReady(true);
      return;
    }

    // Everywhere else, force onboarding until the first observation is complete.
    // Completion comes from the server (cross-device), with a localStorage hint as
    // an optimistic fallback so the just-completed redirect never flickers.
    if (loading) return;
    const completedHint =
      typeof window !== "undefined" &&
      localStorage.getItem("hasCompletedFirstObservation") === "true";
    const hasCompleted = summary?.hasCompletedFirstObservation || completedHint;
    if (!hasCompleted) {
      router.push("/observation");
      return;
    }
    setIsReady(true);
  }, [status, session, pathname, router, summary, loading]);

  // Shell chrome (sidebar, dashboard, etc.) in the participant's locale.
  // Degrades to the English UI_STRINGS default (the context's own default)
  // if this hasn't resolved yet or the fetch fails — never blank, never throws.
  useEffect(() => {
    const locale = (session?.user as { locale?: string | null } | undefined)?.locale;
    if (!locale || locale === "en") return;
    let cancelled = false;
    fetch("/api/ui-strings")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setUiStrings(data);
      })
      .catch(() => {
        /* stays on the English default */
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  if (!isReady) {
    return (
      <div className="theme-participant font-sans flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-[var(--color-brand-gold)] animate-spin" />
      </div>
    );
  }

  return (
    <UiStringsProvider value={uiStrings}>
    <div className="theme-participant font-sans flex h-screen overflow-hidden bg-page-radial text-fg">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Backdrop behind the mobile drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="flex-1 overflow-y-auto relative h-screen">
        {/* Mobile menu bar. Sticky, not fixed: it takes up real space at the top of
            the scroll container, so page content starts below the button instead of
            running under it — and because the bar is opaque, content scrolling past
            stays hidden behind it rather than colliding with the icon. The open
            drawer's backdrop (z-30) covers this bar, so it needs no open/closed
            state of its own. */}
        <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center px-4 bg-background/85 backdrop-blur-md lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-brand-gold shadow-lg"
          >
            <Menu size={20} />
          </button>
        </div>
        {children}
      </main>
      <ChatPanel />
    </div>
    </UiStringsProvider>
  );
}
