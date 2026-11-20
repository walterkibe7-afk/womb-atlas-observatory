"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  ChartColumnIncreasing,
  ChevronDown,
  Database,
  Globe,
  Home,
  KeyRound,
  Languages,
  LogOut,
  Plug,
  ScrollText,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/lib/logout";
import { cn } from "@/lib/cn";
import { Avatar, Badge } from "@/components/ui";

type NavEntry = { label: string; icon: LucideIcon; href: string; isNew?: boolean };

// Three groups, divided by hairlines — matching the Figma IA.
const ADMINISTRATION: NavEntry[] = [
  { label: "Overview", icon: Home, href: "/admin" },
  { label: "Contributors & Stewards", icon: Users, href: "/admin/access" },
  { label: "Atlas Records", icon: Database, href: "/admin/database" },
  { label: "Stewardship & Quality", icon: ShieldCheck, href: "/admin/status" },
];

// In-page anchors on the Overview dashboard.
const OBSERVATORY: NavEntry[] = [
  { label: "Steward Network", icon: Users, href: "/admin#steward-network", isNew: true },
  { label: "Coverage Map", icon: Globe, href: "/admin#coverage-map", isNew: true },
  { label: "Signal Governance", icon: Sparkles, href: "/admin#knowledge-governance", isNew: true },
  { label: "Observatory Growth", icon: ChartColumnIncreasing, href: "/admin#growth-dashboard", isNew: true },
];

const PLATFORM: NavEntry[] = [
  { label: "Reports & Analytics", icon: ChartColumnIncreasing, href: "/insights" },
  { label: "Translations", icon: Languages, href: "/admin/translations" },
  { label: "Integrations", icon: Plug, href: "/admin/status" },
  { label: "System Settings", icon: Settings, href: "/admin/access" },
  { label: "Security & Privacy", icon: KeyRound, href: "/admin/audit" },
  { label: "Audit Logs", icon: ScrollText, href: "/admin/audit" },
];

function NavRow({ item, active, onNavigate }: { item: NavEntry; active: boolean; onNavigate: () => void }) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-nav-active border border-[var(--color-border-active)] text-fg"
          : "border border-transparent text-secondary hover:bg-[var(--color-surface-inset)] hover:text-fg",
      )}
    >
      <item.icon size={17} className={active ? "text-brand-gold" : "text-subtle"} />
      <span className={cn("flex-1", active && "font-medium")}>{item.label}</span>
      {item.isNew && <Badge variant="new">NEW</Badge>}
    </Link>
  );
}

export function AdminSidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const name = session?.user?.name || "Administrator";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Anchor links all live on /admin, so they never light up on their own — only
  // the group's own page does.
  const isActive = (href: string) => pathname === href.split("#")[0] && !href.includes("#");

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex h-screen w-[272px] shrink-0 flex-col border-r border-[var(--color-border)] bg-page-radial transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pb-5 pt-6">
        <span className="bg-logo flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--color-border-brand)]">
          <Image src="/assets/logo-mark.png" alt="Womb Atlas" width={44} height={44} className="object-cover" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-serif text-[19px] font-bold tracking-[0.06em] text-logo">WOMB ATLAS</div>
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

      <nav className="flex-1 overflow-y-auto px-4 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-gold">
          Administration
        </p>
        <div className="flex flex-col gap-1">
          {ADMINISTRATION.map((item) => (
            <NavRow key={item.label} item={item} active={isActive(item.href)} onNavigate={onClose} />
          ))}
        </div>

        <div className="my-3 border-t border-[var(--color-border-subtle)]" />
        <div className="flex flex-col gap-1">
          {OBSERVATORY.map((item) => (
            <NavRow key={item.label} item={item} active={isActive(item.href)} onNavigate={onClose} />
          ))}
        </div>

        <div className="my-3 border-t border-[var(--color-border-subtle)]" />
        <div className="flex flex-col gap-1">
          {PLATFORM.map((item) => (
            <NavRow key={item.label} item={item} active={isActive(item.href)} onNavigate={onClose} />
          ))}
        </div>
      </nav>

      {/* User + sign out */}
      <div className="mt-auto space-y-2 p-4">
        <div className="flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-surface-card px-3 py-2.5">
          <Avatar initials={initials} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold text-fg">{name}</div>
            <div className="text-[11px] text-muted">Super Administrator</div>
          </div>
          <ChevronDown size={15} className="text-subtle" />
        </div>
        <button
          onClick={() => logout()}
          className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-brand-gold transition-colors hover:bg-[var(--color-surface-inset)]"
        >
          <LogOut size={17} />
          <span className="text-sm">Sign out</span>
        </button>
      </div>
    </aside>
  );
}
