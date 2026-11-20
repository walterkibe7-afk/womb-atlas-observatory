"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { ConstellationNodeContent } from "@/lib/observation/intelligence/v43/constellation-node-content";
import { useUiStrings } from "@/lib/observation/ui-strings-context";
import type { UiStrings } from "@/lib/observation/ui-strings";

function confidenceLabelFor(
  level: ConstellationNodeContent["confidenceLevel"],
  strings: UiStrings,
): string {
  switch (level) {
    case "light_baseline":
      return strings.constellationConfidenceLightBaseline;
    case "emerging":
      return strings.confidenceEmerging;
    case "strong":
      return strings.confidenceStrong;
  }
}

// Shared "what Atlas observed for this signal" popup — opened from a
// constellation node on both the My Records page (AtlasConstellationMap) and
// the dashboard's Living Constellation preview, so the two stay in sync.
export function ConstellationNodeModal({
  content,
  onClose,
}: {
  content: ConstellationNodeContent;
  onClose: () => void;
}) {
  const strings = useUiStrings();
  // Portalled straight to <body> — rendered as a descendant of a hover-lifting
  // Card (see src/components/ui/Card.tsx's hover:-translate-y-1), a CSS
  // transform on an ancestor becomes the containing block for `fixed`
  // descendants, which trapped this inside the card's box instead of the
  // viewport and made it jump the moment the hover transform cleared.
  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/60 p-4 sm:items-center"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-brand-gold)]">
              {strings.constellationPatternPrefix} &middot; {confidenceLabelFor(content.confidenceLevel, strings)}
            </p>
            <h2 className="mt-1 text-2xl font-serif text-fg">{content.patternTitle}</h2>
          </div>
          <button
            aria-label={strings.constellationClosePopupAria}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[var(--color-border)] text-[var(--color-brand-gold)] hover:border-[var(--color-brand-gold)]"
            onClick={onClose}
            type="button"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-brand-gold)]">{strings.constellationSectionObserved}</h3>
            <p className="mt-1 text-sm leading-relaxed text-fg">{content.whatAtlasObserved}</p>
          </section>

          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-brand-gold)]">
              {strings.constellationSectionWhyConnected}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{content.whyAtlasConnected}</p>
          </section>

          <section>
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-brand-gold)]">
              {strings.constellationSectionWillObserve}
            </h3>
            <p className="mt-1 text-xs italic leading-relaxed text-muted">{content.whatAtlasWillObserve}</p>
          </section>

          <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] px-4 py-3">
            <h3 className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-brand-gold)]">{strings.constellationSectionNote}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{content.atlasNote}</p>
          </section>

          {content.relatedPatterns.length > 0 && (
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-brand-gold)]">{strings.constellationSectionRelatedPatterns}</h3>
              <div className="mt-1 space-y-1">
                {content.relatedPatterns.map((name, i) => (
                  <p className="text-sm text-fg" key={`related-${i}-${name}`}>
                    {name}
                  </p>
                ))}
              </div>
            </section>
          )}

          {content.supportingObservations.length > 0 && (
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-brand-gold)]">
                {strings.constellationSectionSupportingObservations}
              </h3>
              <ul className="mt-1 list-disc list-inside space-y-1 text-sm text-muted">
                {content.supportingObservations.map((obs, i) => (
                  <li key={i}>{obs}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
