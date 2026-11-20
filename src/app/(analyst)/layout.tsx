"use client";

import { AnalystSidebar } from "@/components/AnalystSidebar";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, Menu } from "lucide-react";

export default function AnalystLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [isReady, setIsReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close the mobile drawer on every navigation, adjusted during render per
  // React's "resetting state when a prop changes" pattern — no flash.
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

    const role = (session?.user as { role?: string } | undefined)?.role;
    if (role !== "analyst" && role !== "admin") {
      router.push("/");
      return;
    }

    // Runs only after the async auth status resolves — not a cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsReady(true);
  }, [status, session, router]);

  if (!isReady) {
    return (
      <div className="theme-analyst flex h-screen items-center justify-center bg-[var(--color-background)]">
        <Loader2 className="w-8 h-8 text-[var(--color-brand-gold)] animate-spin" />
      </div>
    );
  }

  return (
    // `theme-analyst` re-points the semantic colour tokens at the analyst
    // palette (see globals.css); everything below inherits it.
    <div className="theme-analyst flex h-screen overflow-hidden bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <AnalystSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Backdrop behind the mobile drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-[var(--color-background)]/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <main className="flex-1 overflow-y-auto relative h-screen bg-page-radial">
        {/* Mobile menu bar. Sticky, opaque, takes real space at the top of the
            scroll container so content starts below it. The open drawer's
            backdrop (z-30) covers this bar. */}
        <div className="sticky top-0 z-20 flex h-14 shrink-0 items-center px-4 bg-[var(--color-background)]/85 backdrop-blur-md lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="grid h-11 w-11 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-brand-gold shadow-lg"
          >
            <Menu size={20} />
          </button>
        </div>
        {children}
      </main>
    </div>
  );
}
