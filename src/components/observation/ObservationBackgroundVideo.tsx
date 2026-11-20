"use client";

// Shared background loops (mobile-app parity, see documentations/ for the
// source pattern): one dim loop behind question screens, one brighter loop
// behind transition/processing screens. Absolutely positioned behind the
// screen content, with a gradient scrim so form fields and body text stay
// readable; if an asset fails to load the existing page gradient shows
// through since this sits on top of it, not in place of it.
//
// Both <video> elements are mounted for the wizard's entire lifetime and
// simply cross-fade opacity as the active screen's kind changes — swapping
// `src`/remounting per screen meant a fresh, un-buffered ~10-20MB video had
// to start loading from zero the moment a screen needed it (visible as a
// blank/black frame on faster-reached screens, e.g. the safety check only a
// few screens into the flow). Preloading both up front avoids that.
const QUESTION_VIDEO_SRC = "/assets/background2.mp4";
const TRANSITION_VIDEO_SRC = "/assets/video-project-11-3.mp4";

export type ObservationBackgroundKind = "question" | "transition" | null;

// Scrim reuses the same Ink/Plum page gradient (bg-page-radial → --gradient-page)
// as the rest of the participant portal, just at a lower opacity over the
// video, instead of a flat Ink-only wash — keeps the observation flow's
// backdrop consistent with the dashboard/sidebar treatment.
const SCRIM: Record<"question" | "transition", string> = {
  question: "bg-page-radial opacity-90",
  transition: "bg-page-radial opacity-75",
};

export function ObservationBackgroundVideo({ kind }: { kind: ObservationBackgroundKind }) {
  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          kind === "question" ? "opacity-35" : "opacity-0"
        }`}
        src={QUESTION_VIDEO_SRC}
      />
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
          kind === "transition" ? "opacity-60" : "opacity-0"
        }`}
        src={TRANSITION_VIDEO_SRC}
      />
      {kind ? <div className={`absolute inset-0 ${SCRIM[kind]}`} /> : null}
    </div>
  );
}
