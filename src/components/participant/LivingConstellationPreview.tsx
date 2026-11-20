"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { DOMAIN_ICON, DOMAIN_TO_NODE_ID } from "./signal-domains";
import { Badge } from "@/components/ui";
import { ConstellationNodeModal } from "@/components/observation/constellation-node-modal";
import type { ConstellationNodeContent } from "@/lib/observation/intelligence/v43/constellation-node-content";
import { useUiStrings } from "@/lib/observation/ui-strings-context";
import { useLocale } from "@/lib/observation/use-locale";
import { v43Text } from "@/lib/observation/intelligence/v43/v43-i18n";

// Node offsets are percentages of the orbit area's own box (not fixed pixels),
// so the circle scales down safely in a narrow column instead of clipping.
// X stays well under 50 because the side pills are centred on their point and
// the widest ("Care Journey") would otherwise hang off the card edge.
const RADIUS_X_PCT = 34;
const RADIUS_Y_PCT = 39;

// Six nodes evenly spaced around the circle (60° apart), starting at the top
// and going clockwise — matches the reference layout (Pain at 12 o'clock,
// Hormonal at 2, Cycle at 4, Daily Life at 6, Care Journey at 8, Bleeding at 10).
// `domain` is a matching key into DOMAIN_ICON/DOMAIN_TO_NODE_ID — never
// translate it. `previewId` is this widget's own translation id: its
// label/sub deliberately differ from the generic domain label elsewhere
// ("Care Journey" here, "Care Access" everywhere else), so they can't reuse
// domainLabel() and need their own v43Text entries.
const NODE_DEFINITIONS: { domain: string; previewId: string; label: string; sub: string; angleDeg: number }[] = [
  { domain: "Pain", previewId: "preview_pain", label: "Pain", sub: "Explore pain patterns", angleDeg: -90 },
  { domain: "Hormonal", previewId: "preview_hormonal", label: "Hormonal", sub: "Explore hormonal patterns", angleDeg: -30 },
  { domain: "Cycle", previewId: "preview_cycle", label: "Cycle", sub: "Explore cycle patterns", angleDeg: 30 },
  { domain: "Daily Life", previewId: "preview_daily_life", label: "Daily Life", sub: "Explore daily life patterns", angleDeg: 90 },
  { domain: "Care Access", previewId: "preview_care_access", label: "Care Journey", sub: "Explore your care experience", angleDeg: 150 },
  { domain: "Bleeding", previewId: "preview_bleeding", label: "Bleeding", sub: "Explore bleeding patterns", angleDeg: 210 },
];

const NODE_POSITIONS = NODE_DEFINITIONS.map((node) => {
  const rad = (node.angleDeg * Math.PI) / 180;
  return {
    ...node,
    xPct: RADIUS_X_PCT * Math.cos(rad),
    yPct: RADIUS_Y_PCT * Math.sin(rad),
  };
});

const FIGURE_SRC = "/assets/constellation-skeleton.png";

// Fixed (not random) so server and client markup match and the twinkle pattern
// stays stable between renders.
const STARS: { left: string; top: string; delay: string; size: number }[] = [
  { left: "8%", top: "18%", delay: "0s", size: 3 },
  { left: "27%", top: "6%", delay: "0.7s", size: 2 },
  { left: "72%", top: "12%", delay: "1.4s", size: 3 },
  { left: "92%", top: "24%", delay: "0.3s", size: 2 },
  { left: "5%", top: "56%", delay: "2.1s", size: 2 },
  { left: "95%", top: "62%", delay: "1.1s", size: 3 },
  { left: "18%", top: "88%", delay: "1.8s", size: 2 },
  { left: "63%", top: "94%", delay: "0.5s", size: 3 },
  { left: "88%", top: "84%", delay: "2.4s", size: 2 },
  { left: "42%", top: "48%", delay: "1.6s", size: 2 },
];

/**
 * Dashboard teaser for the six-domain constellation (Bleeding, Pain, Hormonal,
 * Cycle, Daily Life, Care Access) — the same domains driving Signal Evolution
 * and the per-record AtlasConstellationMap. Renders its own title/badge (the
 * caller uses a plain `Card`, not `SectionCard`) so the backdrop photo can
 * sit behind the whole panel — title through button — rather than just an
 * inset sub-box. Node offsets are percentages of the orbit area's own box, so
 * the circle scales with whatever space it gets instead of overflowing.
 * Each node opens the same "what Atlas observed" popup as the My Records
 * constellation (falls back to linking to Records if there's no Atlas Record
 * yet to pull that content from).
 */
export function LivingConstellationPreview() {
  const strings = useUiStrings();
  const locale = useLocale();
  const [nodes, setNodes] = useState<ConstellationNodeContent[] | null>(null);
  const [activeNode, setActiveNode] = useState<ConstellationNodeContent | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/participant/records");
        const data = await res.json();
        const latest = data?.records?.[0];
        const payload = latest?.recordPayload as { constellationNodes?: ConstellationNodeContent[] } | undefined;
        if (active) setNodes(payload?.constellationNodes ?? []);
      } catch {
        if (active) setNodes([]);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="@container relative flex h-full flex-col overflow-hidden rounded-[var(--radius-card)]">
      {/* full-bleed backdrop photo, filling the entire card */}
      <Image
        src={FIGURE_SRC}
        alt=""
        aria-hidden="true"
        fill
        sizes="480px"
        className="object-cover object-center pointer-events-none select-none"
        priority={false}
      />
      <div className="absolute inset-0 bg-linear-to-b from-participant-ink/85 via-participant-ink/15 to-participant-ink/90" />

      {/* content sits above the backdrop */}
      <div className="relative flex h-full flex-col p-4">
        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          <h3 className="font-serif text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-gold">
            {strings.dashboardLivingConstellationTitle}
          </h3>
          <Badge variant="purple-outline">{strings.dashboardBetaBadge}</Badge>
        </div>
        <p className="mb-2 text-[15px] text-muted">{strings.dashboardPatternsAcrossKeyDomains}</p>

        <div className="relative mt-4 min-h-0 flex-1">
          {/* drifting starfield */}
          {STARS.map((star, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="animate-constellation-twinkle pointer-events-none absolute rounded-full bg-brand-gold"
              style={{
                left: star.left,
                top: star.top,
                width: star.size,
                height: star.size,
                animationDelay: star.delay,
              }}
            />
          ))}

          {/* soft pulsing core behind the figure */}
          <div
            aria-hidden="true"
            className="animate-constellation-core pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,var(--color-brand-gold),transparent)] blur-xl"
            style={{ width: `${RADIUS_X_PCT}%`, height: `${RADIUS_Y_PCT}%` }}
          />

          {/* orbit rings — dashed so the rotation actually reads on a near-circle */}
          <div
            aria-hidden="true"
            className="animate-constellation-spin pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-brand-gold/35"
            style={{ width: `${RADIUS_X_PCT * 2}%`, height: `${RADIUS_Y_PCT * 2}%` }}
          />
          <div
            aria-hidden="true"
            className="animate-constellation-spin-reverse pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-brand-gold/20"
            style={{ width: `${RADIUS_X_PCT * 1.5}%`, height: `${RADIUS_Y_PCT * 1.5}%` }}
          />

          {/* comet dots riding each rim */}
          <div
            aria-hidden="true"
            className="animate-constellation-comet pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: `${RADIUS_X_PCT * 2}%`, height: `${RADIUS_Y_PCT * 2}%` }}
          >
            <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gold shadow-[0_0_12px_4px_var(--color-brand-gold)]" />
          </div>
          <div
            aria-hidden="true"
            className="animate-constellation-comet-reverse pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: `${RADIUS_X_PCT * 1.5}%`, height: `${RADIUS_Y_PCT * 1.5}%` }}
          >
            <span className="absolute left-1/2 top-0 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-purple-light shadow-[0_0_10px_3px_var(--color-brand-purple)]" />
          </div>

          {NODE_POSITIONS.map((node, i) => {
            const Icon = DOMAIN_ICON[node.domain];
            const content = nodes?.find((n) => n.nodeId === DOMAIN_TO_NODE_ID[node.domain]) ?? null;
            // Labels only once the card itself is wide enough to hold them. A
            // side chip is centred on its orbit point at 16% of the width, so
            // "Care Journey" (~139px) needs ~470px of card before its left half
            // stops hanging off the edge; below that the chips go icon-only and
            // the orbit still reads. Container query, not a media query — this
            // card sits in a 1.55fr column, so the viewport says nothing useful.
            const chipClassName =
              "animate-constellation-chip-in inline-flex items-center gap-0 @lg:gap-2 whitespace-nowrap rounded-full bg-participant-card/55 py-1.5 px-1.5 @lg:pr-3.5 backdrop-blur-sm transition-[background-color,scale] duration-200 hover:scale-110 hover:bg-participant-card/80";
            const label = v43Text(node.previewId, "label", node.label, locale);
            const sub = v43Text(node.previewId, "sub", node.sub, locale);
            const chipContent = (
              <>
                <span className="relative grid h-8 w-8 shrink-0 place-items-center">
                  <span
                    className="animate-constellation-ping absolute inset-0 rounded-full border border-brand-gold/45"
                    style={{ animationDelay: `${i * 0.35}s` }}
                  />
                  <span
                    className="animate-constellation-glow relative grid h-8 w-8 place-items-center rounded-full border border-border-brand bg-surface-inset text-brand-gold"
                    style={{ animationDelay: `${i * 0.35}s` }}
                  >
                    <Icon size={15} strokeWidth={1.5} />
                  </span>
                </span>
                <span className="hidden @lg:inline text-fg text-[12px] font-semibold leading-tight">
                  {label}
                </span>
              </>
            );

            // Wrapper owns position; the pill inside owns the entrance pop and
            // the hover scale (kept separate so neither clobbers the other).
            return (
              <div
                key={node.domain}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${50 + node.xPct}%`,
                  top: `${50 + node.yPct}%`,
                }}
              >
                {content ? (
                  <button
                    type="button"
                    onClick={() => setActiveNode(content)}
                    className={chipClassName}
                    style={{ animationDelay: `${i * 90}ms` }}
                    title={label}
                    aria-label={sub}
                  >
                    {chipContent}
                  </button>
                ) : (
                  <Link
                    href="/records"
                    className={chipClassName}
                    style={{ animationDelay: `${i * 90}ms` }}
                    title={label}
                    aria-label={sub}
                  >
                    {chipContent}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {activeNode ? <ConstellationNodeModal content={activeNode} onClose={() => setActiveNode(null)} /> : null}
    </div>
  );
}
