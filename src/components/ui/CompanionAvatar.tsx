import Image from "next/image";
import { cn } from "@/lib/cn";

const SRC = "/assets/atlas-companion.png";

// The source art is a square half-body portrait on a constellation backdrop, so
// at avatar sizes her face is far too small to read. The wrapper clips a zoomed
// copy: scaling about this origin lands her face in the middle of the tile.
const ZOOM = 2.1;
const ORIGIN = "42% 12%";

/**
 * Aminata's portrait, cropped to head-and-shoulders.
 *
 * Decorative by default — every placement sits beside her name in text, so the
 * image is hidden from screen readers rather than announcing "Aminata" twice.
 */
export function CompanionAvatar({
  size,
  className,
  rounded = "rounded-2xl",
}: {
  /** Rendered width/height in px; the tile is always square. */
  size: number;
  className?: string;
  rounded?: string;
}) {
  return (
    <span
      className={cn("relative block overflow-hidden bg-avatar shrink-0", rounded, className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={SRC}
        alt=""
        aria-hidden="true"
        fill
        sizes={`${Math.ceil(size * ZOOM)}px`}
        className="object-cover select-none"
        style={{ transform: `scale(${ZOOM})`, transformOrigin: ORIGIN }}
      />
    </span>
  );
}

/**
 * Full-figure portrait that fills whatever box the caller gives it — the large
 * dashboard treatment, where she bleeds off the card's bottom and left edges.
 *
 * Unzoomed, so the framing is the source art's own head-to-torso composition.
 * The right edge is masked to a soft fade so the portrait's dark backdrop melts
 * into the card instead of ending on a visible seam; masking (rather than an
 * overlay in the card's colour) keeps it correct under any portal theme.
 */
export function CompanionPortrait({ className }: { className?: string }) {
  // Two fades intersected: one across the right edge, one down from the top —
  // without the second, the portrait's backdrop meets the card on a visible
  // horizontal seam just under the section title.
  const fade = [
    "linear-gradient(to right, #000 68%, transparent 100%)",
    "linear-gradient(to bottom, transparent 0%, #000 16%)",
  ].join(", ");
  return (
    <span
      className={cn("relative block overflow-hidden", className)}
      style={{
        maskImage: fade,
        WebkitMaskImage: fade,
        maskComposite: "intersect",
        WebkitMaskComposite: "source-in",
      }}
    >
      <Image
        src={SRC}
        alt=""
        aria-hidden="true"
        fill
        sizes="(max-width: 1024px) 45vw, 280px"
        className="object-cover select-none"
        style={{ objectPosition: "46% 50%" }}
      />
    </span>
  );
}
