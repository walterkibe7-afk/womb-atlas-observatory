"use client";

import Image from "next/image";
import { useState } from "react";
import type { ConstellationNodeContent } from "@/lib/observation/intelligence/v43/constellation-node-content";
import { ConstellationNodeModal } from "./constellation-node-modal";
import { useUiStrings } from "@/lib/observation/ui-strings-context";

const constellationImageSrc = "/assets/constellation-record-approved.png";

// Layout only (tap-target position); the label + all dynamic content per node
// comes from the server-computed `constellationNodes` (see
// constellation-node-content.ts), already translated for the participant's
// locale — this array never carries display text.
const NODE_LAYOUT: { nodeId: string; left: string; top: string }[] = [
  { nodeId: "bleeding", left: "14.8%", top: "27.5%" },
  { nodeId: "pain", left: "50.7%", top: "12.5%" },
  { nodeId: "hormonal", left: "88.7%", top: "29.2%" },
  { nodeId: "cycle_disruption", left: "88.8%", top: "76.2%" },
  { nodeId: "daily_life", left: "50.6%", top: "88%" },
  { nodeId: "care_access", left: "14.8%", top: "76.2%" },
];

export function AtlasConstellationMap({ nodes }: { nodes: ConstellationNodeContent[] }) {
  const strings = useUiStrings();
  const [activeNode, setActiveNode] = useState<ConstellationNodeContent | null>(null);
  const byId = new Map(nodes.map((n) => [n.nodeId, n]));

  return (
    <div className="relative">
      <p className="text-sm text-muted mb-4">{strings.constellationTapHint}</p>

      <div className="relative mx-auto w-full max-w-[420px]">
        <Image
          alt=""
          aria-hidden="true"
          className="block h-auto w-full rounded-2xl"
          height={1024}
          sizes="420px"
          src={constellationImageSrc}
          width={864}
        />

        {NODE_LAYOUT.map((layout) => {
          const node = byId.get(layout.nodeId);
          if (!node) return null;
          const isActive = activeNode?.nodeId === node.nodeId;
          return (
            <button
              aria-label={`${strings.constellationOpenPopupAriaPrefix} ${node.domainLabel}`}
              aria-pressed={isActive}
              className={`absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] ${
                isActive ? "bg-[var(--color-brand-gold)]/20" : "hover:bg-[var(--color-brand-gold)]/10"
              }`}
              key={node.nodeId}
              onClick={() => setActiveNode(node)}
              style={{ left: layout.left, top: layout.top }}
              type="button"
            >
              <span className="sr-only">{strings.constellationOpenPatternAriaPrefix} {node.domainLabel}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
        {NODE_LAYOUT.map((layout) => {
          const node = byId.get(layout.nodeId);
          if (!node) return null;
          return <span key={layout.nodeId}>{node.domainLabel}</span>;
        })}
      </div>

      {activeNode ? (
        <ConstellationNodeModal content={activeNode} onClose={() => setActiveNode(null)} />
      ) : null}
    </div>
  );
}
