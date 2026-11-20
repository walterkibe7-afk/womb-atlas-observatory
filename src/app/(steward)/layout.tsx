"use client";

import { StewardSidebar } from "@/components/StewardSidebar";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Menu } from "lucide-react";

export default function StewardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

    if (status === "unauthenticated") {
      router.push("/");
      return;
    }

    const role = (session?.user as { role?: string } | undefined)?.role?.toLowerCase();
    if (role !== "steward") {
      // Not a steward — redirect to login
      router.push("/");
      return;
    }

    // Runs only after the async auth status resolves — not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReady(true);
  }, [status, session, router]);

  if (!isReady) {
    return (
      <div className="theme-steward flex h-screen items-center justify-center bg-[var(--color-background)]">
        <Loader2 className="w-8 h-8 text-[var(--color-brand-gold)] animate-spin" />
      </div>
    );
  }

  return (
    // `theme-steward` re-points the semantic colour tokens at the steward
    // palette (see globals.css); everything below inherits it.
    <div className="theme-steward flex h-screen overflow-hidden bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <StewardSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Backdrop behind the mobile drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="flex-1 overflow-y-auto relative h-screen bg-page-radial">
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
    </div>
  );
}
