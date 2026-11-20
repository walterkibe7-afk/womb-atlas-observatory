"use client";

import Link from "next/link";
import Image from "next/image";
import {
  Home, PlusCircle, MessageCircle, Clock, FileText,
  Heart, Lock, LogOut, X,
  MessageSquare, AudioLines, type LucideIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { logout } from "@/lib/logout";
import { useChatStore } from "@/stores/chat-store";
import { useParticipantData } from "@/components/ParticipantDataProvider";
import { cn } from "@/lib/cn";
import { Badge, CompanionAvatar } from "@/components/ui";
import { useUiStrings } from "@/lib/observation/ui-strings-context";

type NavEntry = {
  label: string;
  icon: LucideIcon;
  href?: string; // present → real route; absent → design placeholder
  isNew?: boolean;
};

function NavRow({ item, active, onNavigate }: { item: NavEntry; active: boolean; onNavigate: () => void }) {
  const inner = (
    <>
      <item.icon size={20} strokeWidth={1.7} className={active ? "text-brand-gold" : "text-subtle"} />
      <span className="flex-1 text-[15px] whitespace-nowrap">{item.label}</span>
      {/* "NEW" is a fixed badge mark, not translated content — same across every locale. */}
      {item.isNew && <Badge variant="gold-outline">NEW</Badge>}
    </>
  );

  const base = "flex items-center gap-3.5 px-4 py-3 rounded-[13px] transition-colors";

  if (active) {
    return (
      <div className={cn(base, "bg-nav-active border border-[var(--color-border-active)] font-semibold text-fg shadow-[0_0_18px_rgba(162,135,152,.2)]")}>
        {inner}
      </div>
    );
  }
  if (item.href) {
    return (
      <Link href={item.href} onClick={onNavigate} className={cn(base, "text-muted border border-transparent hover:bg-[var(--color-surface-hover)] hover:text-fg")}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={cn(base, "text-muted/70 border border-transparent cursor-default")} title="Coming soon" aria-disabled>
      {inner}
    </div>
  );
}

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { openChat } = useChatStore();
  const { summary } = useParticipantData();
  const strings = useUiStrings();

  const hasCompletedFirstObservation = summary?.hasCompletedFirstObservation ?? false;

  const navItems: NavEntry[] = [
    { label: strings.navMyObservatory, icon: Home, href: "/dashboard" },
    ...(hasCompletedFirstObservation
      ? []
      : [{ label: strings.navBeginFirstObservation, icon: PlusCircle, href: "/observation" }]),
    { label: strings.navCheckIn, icon: MessageCircle, href: "/check-in" },
    { label: strings.navTimeline, icon: Clock, href: "/timeline", isNew: true },
    { label: strings.navRecords, icon: FileText, href: "/records" },
    { label: strings.navReflections, icon: Heart, href: "/reflections" },
    // { label: "Atlas Insights", icon: Globe },
    // { label: "Companion", icon: Users },
    // { label: "Resources", icon: BookOpen },
    // { label: "Settings", icon: Settings },
  ];

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-75 shrink-0 h-screen flex flex-col gap-5 py-6 px-5 border-r border-border-subtle bg-page-radial overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none transition-transform duration-300 ease-in-out lg:static lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-4 px-1.5 pb-2">
        <span className="bg-logo w-15 h-15 shrink-0 rounded-full flex items-center justify-center overflow-hidden border-[1.5px] border-border-brand shadow-[0_0_18px_rgba(200,154,82,.25)]">
          <Image src="/assets/logo-mark.png" alt="Womb Atlas" width={60} height={60} className="object-cover" />
        </span>
        <div className="leading-tight flex-1 min-w-0">
          <div className="font-serif font-bold text-[22px] tracking-[0.03em] text-logo whitespace-nowrap">WOMB ATLAS</div>
          <div className="font-mono text-xs tracking-[0.28em] text-logo-sub font-medium mt-0.5">OBSERVATORY</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="lg:hidden grid h-9 w-9 shrink-0 place-items-center rounded-full text-subtle hover:text-fg hover:bg-(--color-surface-hover) transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = !!item.href && (pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href)));
          return <NavRow key={item.label} item={item} active={isActive} onNavigate={onClose} />;
        })}
      </nav>

      {/* Companion mini card */}
      <div className="mt-1 rounded-2xl border border-[var(--color-border)] bg-surface-plum overflow-hidden">
        <div className="flex gap-3.5 p-4 items-center">
          <CompanionAvatar size={72} rounded="rounded-2xl" />
          <div className="leading-tight">
            <p className="font-mono text-[11px] text-brand-gold tracking-wide">{strings.sidebarYourCompanion}</p>
            <p className="font-serif text-xl font-semibold text-fg my-0.5">Aminata</p>
            <p className="text-[13px] text-muted leading-snug">
              {strings.sidebarCompanionRoleLine1}
              <br />
              {strings.sidebarCompanionRoleLine2}
            </p>
          </div>
        </div>
        <button
          onClick={openChat}
          className="mx-3.5 mb-3.5 flex w-[calc(100%-1.75rem)] items-center gap-2.5 rounded-[11px] border border-[var(--color-border-brand)] px-3.5 py-2.5 text-[14px] font-medium text-brand-gold transition-colors hover:bg-[var(--color-surface-hover)]"
        >
          <MessageSquare size={17} strokeWidth={1.7} />
          <span>{strings.sidebarMessageCompanion}</span>
          <AudioLines size={17} strokeWidth={1.7} className="ml-auto opacity-80" />
        </button>
      </div>

      {/* Privacy card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 flex gap-3.5 items-start">
        <Lock size={22} strokeWidth={1.5} className="text-brand-gold shrink-0 mt-0.5" />
        <div>
          <p className="text-brand-gold font-semibold text-[14px]">{strings.sidebarPrivacyTitle}</p>
          <p className="text-muted text-[13px] mt-0.5">{strings.sidebarPrivacyBody}</p>
        </div>
      </div>

      {/* Sign out */}
      <button
        onClick={() => {
          localStorage.clear();
          logout();
        }}
        className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm text-muted transition-colors hover:text-fg hover:bg-[var(--color-surface-hover)]"
      >
        <LogOut size={16} />
        <span>{strings.logOut}</span>
      </button>
    </aside>
  );
}
