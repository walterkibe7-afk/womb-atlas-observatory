"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { logout } from "@/lib/logout";
import {
  Home, Network, TrendingUp, Compass, Languages, Layers, HeartPulse,
  ScanSearch, FileText, Settings, LogOut, ChevronDown, X, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar, Badge } from "@/components/ui";

// Only the Overview dashboard is implemented; every other destination is shown
// (for the full IA) but disabled until its page exists — `href` present means
// it's a real, navigable route.
type NavEntry = { label: string; icon: LucideIcon; href?: string; isNew?: boolean };

const NAV_ITEMS: NavEntry[] = [
  { label: "Overview", icon: Home, href: "/analyst" },
  { label: "Pattern Intelligence", icon: Network, isNew: true },
  { label: "Trajectory Intelligence", icon: TrendingUp, isNew: true },
  { label: "Meaning Explorer", icon: Compass },
  { label: "Language Insights", icon: Languages, isNew: true },
  { label: "Life Stages Intelligence", icon: Layers },
  { label: "Care Systems Insights", icon: HeartPulse },
  { label: "Observatory Questions", icon: ScanSearch, isNew: true },
  { label: "Reports & Exports", icon: FileText },
];

function NavRow({ item, active, onNavigate }: { item: NavEntry; active: boolean; onNavigate: () => void }) {
  const inner = (
    <>
      <item.icon size={17} className={active ? "text-brand-gold" : "text-subtle"} />
      <span className={cn("flex-1 text-sm", active && "font-medium")}>{item.label}</span>
      {item.isNew && <Badge variant="new">NEW</Badge>}
    </>
  );
  const base = "flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-colors";

  if (active) {
    return (
      <div className={cn(base, "bg-nav-active border border-[var(--color-border-active)] text-fg")}>
        {inner}
      </div>
    );
  }
  if (item.href) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(base, "text-secondary hover:bg-[var(--color-surface-inset)] hover:text-fg border border-transparent")}
      >
        {inner}
      </Link>
    );
  }
  // Not implemented yet — visible but non-interactive.
  return (
    <div
      className={cn(base, "text-faint cursor-not-allowed border border-transparent opacity-60")}
      title="Coming soon"
      aria-disabled
    >
      {inner}
    </div>
  );
}

export function AnalystSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const name = session?.user?.name || "Analyst";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 shrink-0 h-screen flex flex-col bg-[var(--color-background)] border-r border-[var(--color-border)] transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <span className="bg-logo w-13 h-13 shrink-0 rounded-full flex items-center justify-center overflow-hidden border border-border-brand">
          <Image src="/assets/logo-mark.png" alt="Womb Atlas" width={52} height={52} className="object-cover" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-serif font-bold text-[19px] tracking-[0.06em] text-logo">WOMB ATLAS</div>
          <div className="text-[10px] tracking-[0.34em] text-logo-sub">OBSERVATORY</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="lg:hidden grid h-9 w-9 shrink-0 place-items-center rounded-full text-subtle hover:text-fg hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-4 pb-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        <div className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavRow key={item.label} item={item} active={!!item.href && pathname === item.href} onNavigate={onClose} />
          ))}
        </div>
      </nav>

      {/* User + settings + sign out */}
      <div className="mt-auto p-4 space-y-2">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-surface-card border border-[var(--color-border)]">
          <Avatar initials={initials} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-fg truncate">{name}</div>
            <div className="text-[11px] text-muted">Analyst</div>
          </div>
          <ChevronDown size={15} className="text-subtle" />
        </div>
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-faint opacity-60 cursor-not-allowed w-full"
          title="Coming soon"
          aria-disabled
        >
          <Settings size={17} />
          <span className="text-sm">Settings</span>
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-brand-gold hover:bg-[var(--color-surface-inset)] transition-colors w-full"
        >
          <LogOut size={17} />
          <span className="text-sm">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
