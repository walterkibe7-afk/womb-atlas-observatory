// Data-driven routing + life-stage visibility (sheets 03 + 04).
import { evaluate } from "./conditions";
import type { EvalContext, FormDefinition, Route, Screen } from "./types";

/**
 * Life stage adapts wording, it does not remove screens.
 *
 * The mobile register skipped the whole bleeding section for anyone who
 * answered "pregnant" or "postmenopausal" (its `shouldSkipBleedingSection`),
 * and that behaviour was mirrored here. LOER v7.0.0 takes the opposite
 * position and states it repeatedly — S07 "without excluding non-cycling
 * participants", S16 "adapt and do not exclude", S21 "across cycling and
 * non-cycling life stages", S25 "neutral wording for non-cycling
 * participants", S41 "across cycling and non-cycling contexts".
 *
 * The screens are therefore always visible, and the adaptation lives in the
 * seeded copy (CR §3.3) plus the S39 cycle-applicability answer. The
 * `visibilityRule` DSL below is retained — it is still the mechanism for any
 * genuinely conditional screen.
 */
export function isScreenVisible(screen: Screen, ctx: EvalContext): boolean {
  // The field id is lowercase `reproductive_state`. This previously read
  // "REPRODUCTIVE_STATE" (the legacy id), so it never matched and every
  // hideForReproductiveState rule silently passed through as visible.
  const reproductiveState = ctx.answers["reproductive_state"];

  const rule = screen.visibilityRule;
  if (!rule) return true;
  if (rule.hideForReproductiveState) {
    if (
      typeof reproductiveState === "string" &&
      rule.hideForReproductiveState.includes(reproductiveState)
    ) {
      return false;
    }
  }
  if (rule.hideIf && evaluate(rule.hideIf, ctx)) return false;
  if (rule.showIf && !evaluate(rule.showIf, ctx)) return false;
  return true;
}

// First matching outgoing route (ordered by priority); null condition is fallback.
function nextRouteTarget(screenId: string, routes: Route[], ctx: EvalContext): string | null {
  const outgoing = routes
    .filter((r) => r.fromScreenId === screenId)
    .sort((a, b) => a.priority - b.priority);
  for (const r of outgoing) {
    if (evaluate(r.condition, ctx)) return r.toScreenId;
  }
  return null; // terminal screen
}

// Resolve the next *visible* screen, skipping any suppressed by visibility rules.
export function resolveNextScreen(
  currentScreenId: string,
  def: FormDefinition,
  ctx: EvalContext,
): string | null {
  const byId = new Map(def.screens.map((s) => [s.screenId, s]));
  let target = nextRouteTarget(currentScreenId, def.routes, ctx);
  const guard = new Set<string>();
  while (target) {
    if (guard.has(target)) return null; // cycle guard
    guard.add(target);
    const screen = byId.get(target);
    if (!screen) return target; // unknown id -> let caller handle
    if (isScreenVisible(screen, ctx)) return target;
    target = nextRouteTarget(target, def.routes, ctx);
  }
  return null;
}

export function getScreen(def: FormDefinition, screenId: string): Screen | undefined {
  return def.screens.find((s) => s.screenId === screenId);
}

export function firstScreen(def: FormDefinition): Screen {
  return [...def.screens].sort((a, b) => a.order - b.order)[0];
}

// ---- Section helpers (for "Skip section") --------------------------------

function sectionScreens(def: FormDefinition, section: string): Screen[] {
  return def.screens.filter((s) => s.section === section).sort((a, b) => a.order - b.order);
}

// First (lowest-order) screen of a named section — the landing point when
// editing a whole section from the review screen.
export function firstScreenOfSection(def: FormDefinition, section: string): Screen | undefined {
  return sectionScreens(def, section)[0];
}

// Is this the first (lowest-order) screen of its section?
export function isSectionStart(screen: Screen, def: FormDefinition): boolean {
  const inSection = sectionScreens(def, screen.section);
  return inSection.length > 0 && inSection[0].screenId === screen.screenId;
}

// Consent must be given explicitly, and the safety check drives escalation for
// someone at risk — neither may be skipped past. Matched on renderKind rather
// than section name so it survives a rename or translation of the section label.
const UNSKIPPABLE_RENDER_KINDS = new Set(["consent", "safety_check", "safety_alert"]);

/**
 * A section can be skipped from its intro when:
 *  - this screen is the start of its section and has no questions of its own
 *    (the skip button lives on a section intro, so leaving costs no answers), and
 *  - the section contains at least one screen with questions, and
 *  - the section is not consent or safety.
 *
 * Sections holding Required questions ARE skippable. "Required" gates whether
 * Continue is enabled on a screen you are actually answering; it does not mean
 * a participant must be forced through the whole section. Skipping is safe for
 * routing because it clears the section's answers and then advances by document
 * order (nextSectionStart) — never through a route condition that one of those
 * cleared fields would have decided.
 */
export function isSectionSkippable(screen: Screen, def: FormDefinition): boolean {
  if (!isSectionStart(screen, def)) return false;
  if (screen.questions.length > 0) return false;
  const inSection = sectionScreens(def, screen.section);
  const hasQuestions = inSection.some((s) => s.questions.length > 0);
  if (!hasQuestions) return false;
  return !inSection.some((s) => UNSKIPPABLE_RENDER_KINDS.has(s.renderKind));
}

// First visible screen of the section immediately following this screen's section.
export function nextSectionStart(
  screen: Screen,
  def: FormDefinition,
  ctx: EvalContext,
): string | null {
  const candidates = def.screens
    .filter((s) => s.order > screen.order && s.section !== screen.section)
    .sort((a, b) => a.order - b.order);
  for (const c of candidates) {
    if (isScreenVisible(c, ctx)) return c.screenId;
  }
  return null;
}

// ---- Section progress ----------------------------------------------------

/**
 * Ordered sections that actually ask the participant for something — a question
 * or a narrative prompt. Pure intros (Landing, Onboarding, "In Your Own Words")
 * and everything after submission (Atlas Record, Review, Reflection) are not
 * progress the participant makes, so they don't count toward the total.
 */
export function inputSections(def: FormDefinition): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const s of [...def.screens].sort((a, b) => a.order - b.order)) {
    if (s.questions.length === 0 && s.narrativePrompts.length === 0) continue;
    if (seen.has(s.section)) continue;
    seen.add(s.section);
    ordered.push(s.section);
  }
  return ordered;
}

/**
 * 1-based position of this screen's section among the input sections, for the
 * "Section n / total" progress indicator. Null on screens outside those sections
 * (the landing screen, the record and reflection screens) — they have no
 * meaningful position, so the indicator hides rather than showing a stalled bar.
 *
 * A section's intro screen carries no questions of its own but still resolves,
 * because the lookup is by section name and a later screen in that section has
 * the questions.
 */
export function sectionProgress(
  screen: Screen,
  def: FormDefinition,
): { index: number; total: number } | null {
  const sections = inputSections(def);
  const i = sections.indexOf(screen.section);
  if (i === -1) return null;
  return { index: i + 1, total: sections.length };
}

// All field ids captured within a section (used to clear answers on skip).
export function sectionFieldIds(def: FormDefinition, section: string): string[] {
  return sectionScreens(def, section).flatMap((s) => s.questions.map((q) => q.fieldId));
}
