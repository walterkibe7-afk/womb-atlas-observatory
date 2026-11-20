// Offline conformance check for the LOER v7.0.0 alignment overlay.
// Applies prisma/seed/loer-v7-alignment.mjs to the generated form definition,
// walks the resulting flow graph, and compares every screen's copy and option
// list against the engineering blueprints. No database required.
//
//   node scripts/verify-loer-v7.mjs
//
// Exits non-zero on any failure so it can gate a reseed.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  applyLoerV7Alignment,
  LOER_V7_ORDER,
  LOER_V7_RETIRED,
  LOER_V7_BLUEPRINTS,
  LOER_V7_SUPPLEMENTED,
  LOER_V7_DESIGN_OVERRIDDEN,
  LOER_V7_NOT_IMPLEMENTED,
} from "../prisma/seed/loer-v7-alignment.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(__dirname, "..", "prisma", "seed", "form-definition.json"), "utf-8"));

const FLOW = "first_observation";
const failures = [];
const check = (ok, msg) => { if (!ok) failures.push(msg); };

const summary = applyLoerV7Alignment(data);
console.log("Overlay applied:", summary);

const screens = data.screens.filter((s) => s.flowKey === FLOW);
const byId = new Map(screens.map((s) => [s.screenId, s]));
const routes = data.routes.filter((r) => byId.has(r.fromScreenId));

// 1. Ordering is dense and unique.
const orders = screens.map((s) => s.order).sort((a, b) => a - b);
check(new Set(orders).size === orders.length, "duplicate order values in the flow");
check(orders[0] === 0 && orders[orders.length - 1] === orders.length - 1, "order values are not dense from 0");

// 2. Every screen maps to a LOER id, or is a declared app-only carry-over.
const CARRY_OVER = ["s00-landing", "s74-review-archive"];
const unmapped = screens.filter((s) => !s.loerScreenId && !CARRY_OVER.includes(s.screenId));
check(unmapped.length === 0, `screens with no LOER id: ${unmapped.map((s) => s.screenId).join(", ")}`);

// 3. Retired screens are gone.
for (const r of LOER_V7_RETIRED) check(!byId.has(r), `retired screen still present: ${r}`);

// 4. Routing shape: every non-terminal screen has exactly one fallback, and
//    every target resolves.
const outgoing = new Map();
for (const r of routes) {
  if (!outgoing.has(r.fromScreenId)) outgoing.set(r.fromScreenId, []);
  outgoing.get(r.fromScreenId).push(r);
  check(byId.has(r.toScreenId), `route ${r.fromScreenId} -> ${r.toScreenId} targets a missing screen`);
}
const last = LOER_V7_ORDER[LOER_V7_ORDER.length - 1][0];
for (const s of screens) {
  if (s.screenId === last) continue;
  check((outgoing.get(s.screenId) ?? []).length > 0, `no outgoing route from ${s.screenId}`);
}
for (const [from, rs] of outgoing) {
  const defaults = rs.filter((r) => r.condition == null);
  check(defaults.length === 1, `${from} has ${defaults.length} default routes (expected 1)`);
}

// 5. Reachability.
const seen = new Set(["s00-landing"]);
const queue = ["s00-landing"];
while (queue.length) {
  for (const r of outgoing.get(queue.shift()) ?? []) {
    if (!seen.has(r.toScreenId)) { seen.add(r.toScreenId); queue.push(r.toScreenId); }
  }
}
const unreachable = screens.filter((s) => !seen.has(s.screenId)).map((s) => s.screenId);
check(unreachable.length === 0, `unreachable screens: ${unreachable.join(", ")}`);

// 6. Condition evaluator — mirrors src/lib/observation/conditions.ts.
function evaluate(condition, answers) {
  if (condition == null) return true;
  if ("not" in condition) return !evaluate(condition.not, answers);
  if ("all" in condition) return condition.all.every((c) => evaluate(c, answers));
  if ("any" in condition) return condition.any.some((c) => evaluate(c, answers));
  const a = answers[condition.field];
  const asArray = Array.isArray(a) ? a : a == null ? [] : [a];
  switch (condition.op) {
    case "eq": return a === condition.value;
    case "in": return !Array.isArray(a) && a != null && condition.value.includes(a);
    case "contains_any": return asArray.some((x) => condition.value.includes(x));
    default: return false;
  }
}
function walk(answers) {
  const path = [];
  let id = "s00-landing";
  const guard = new Set();
  while (id && !guard.has(id)) {
    guard.add(id);
    path.push(id);
    const rs = [...(outgoing.get(id) ?? [])].sort((x, y) => x.priority - y.priority);
    id = rs.find((r) => evaluate(r.condition, answers))?.toScreenId ?? null;
  }
  return path;
}

// 6a. No screen may render blank. A "question" or "safety_check" screen with no
// questions, or a "narrative" screen with no prompt, shows the participant an
// empty page with a Continue button — which is how S02 shipped empty.
{
  const qCount = new Map();
  for (const q of data.questions) qCount.set(q.screenId, (qCount.get(q.screenId) ?? 0) + 1);
  const pCount = new Map();
  for (const p of data.narrativePrompts) pCount.set(p.screenId, (pCount.get(p.screenId) ?? 0) + 1);
  for (const s of screens) {
    if (["question", "safety_check"].includes(s.renderKind)) {
      check((qCount.get(s.screenId) ?? 0) > 0, `${s.screenId} (${s.loerScreenId}) is a ${s.renderKind} screen with no questions`);
    }
    if (s.renderKind === "narrative") {
      check((pCount.get(s.screenId) ?? 0) > 0, `${s.screenId} (${s.loerScreenId}) is a narrative screen with no prompt`);
    }
    // A select with no options renders as a bare repeated label — which is how
    // S32 printed its question twice, once with options and once without.
    for (const q of data.questions.filter((x) => x.screenId === s.screenId)) {
      if (["single_select", "multi_select"].includes(q.fieldType)) {
        check(q.options.length > 0, `${q.fieldId} (${s.loerScreenId}) is a ${q.fieldType} with no options`);
      }
    }
    // Two questions on one screen must not share the same text.
    const texts = data.questions.filter((x) => x.screenId === s.screenId).map((x) => x.questionText.trim());
    check(new Set(texts).size === texts.length, `${s.screenId} (${s.loerScreenId}) renders the same question text twice`);

    if (["information", "landing"].includes(s.renderKind)) {
      check(Boolean((s.purpose ?? "").trim()), `${s.screenId} (${s.loerScreenId}) is an ${s.renderKind} screen with no body copy`);
    }
  }
}

// 6b. Exactly one review screen must survive — ObservationWizard resolves
// renderKind "review" to re-enter a completed observation.
const reviewCount = screens.filter((s) => s.renderKind === "review").length;
check(reviewCount === 1, `expected exactly 1 review screen, found ${reviewCount}`);

// 7. Branch behaviour, asserted against the governed option values in the
//    blueprints rather than against hand-copied strings.
const optValue = (loerId, prefix) => {
  const o = (LOER_V7_BLUEPRINTS[loerId]?.options ?? []).find((x) =>
    x.label.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!o) failures.push(`blueprint ${loerId} has no option starting "${prefix}"`);
  return o?.value;
};
const PAIN_DETAIL = ["s30-pain-response", "s31-pain-timing", "s32-pain-location", "pain-triggers", "pain-management"];
const cases = [
  ["S03 urgent flag -> S04", { safety_flags: ["severe_sudden_pain"] }, (p) => p.includes("s04-safety-alert")],
  ["S03 none-of-these -> S05", { safety_flags: ["none_of_these"] },
    (p) => !p.includes("s04-safety-alert") && p.includes("s05-context-intro")],
  ["S17 Yes -> S18", { ever_pregnant: optValue("S17", "yes") }, (p) => p.includes("s18-pregnancy-count")],
  ["S17 No -> S19 (loss still asked)", { ever_pregnant: optValue("S17", "no") },
    (p) => !p.includes("s18-pregnancy-count") && p.includes("s19-pregnancy-loss") && p.includes("s20-trying-to-conceive")],
  ["S29 No -> S35 only", { pain_present: optValue("S29", "no") },
    (p) => PAIN_DETAIL.every((s) => !p.includes(s)) && p.includes("s35-pain-progression")],
  ["S29 Yes currently -> full pain", { pain_present: optValue("S29", "yes, currently") },
    (p) => PAIN_DETAIL.every((s) => p.includes(s))],
  ["S29 Yes historical -> full pain", { pain_present: optValue("S29", "yes, but not currently") },
    (p) => p.includes("pain-triggers")],
  ["S29 Not sure -> neutral route to S30", { pain_present: optValue("S29", "i am not sure") },
    (p) => p.includes("s30-pain-response")],
  ["S39 regular -> S40A", { cycle_applicability: optValue("S39", "i currently have") },
    (p) => p.includes("s40-cycle-predictability") && !p.includes("s40b-rhythm-predictability")],
  ["S39 no cycles -> S40B", { cycle_applicability: optValue("S39", "i do not currently") },
    (p) => p.includes("s40b-rhythm-predictability") && !p.includes("s40-cycle-predictability")],
  ["S39 pregnant -> S40B", { cycle_applicability: optValue("S39", "i am pregnant") },
    (p) => p.includes("s40b-rhythm-predictability")],
  ["S39 treatment -> S40B", { cycle_applicability: optValue("S39", "i use treatment") },
    (p) => p.includes("s40b-rhythm-predictability")],
  ["S37 discharge -> S37A -> S37B", { body_changes: [optValue("S37", "changes in vaginal discharge")] },
    (p) => p.includes("s37a-vaginal-discharge") && p.includes("s37b-discharge-duration") &&
           p.indexOf("s37a-vaginal-discharge") < p.indexOf("s37b-discharge-duration") &&
           p.indexOf("s37b-discharge-duration") < p.indexOf("s39-cycles-and-body-rhythms")],
  ["S37 other change -> S38, no sub-flow", { body_changes: [optValue("S37", "increased bloating")] },
    (p) => !p.includes("s37a-vaginal-discharge") && !p.includes("s37b-discharge-duration") &&
           p.includes("s39-cycles-and-body-rhythms")],
  ["S37 unanswered -> S38", {},
    (p) => !p.includes("s37a-vaginal-discharge") && p.includes("s39-cycles-and-body-rhythms")],
  ["S58 Yes -> S59", { spoken_to_provider: optValue("S58", "yes") }, (p) => p.includes("s59-care-response")],
  ["S58 No -> S60, S61 kept", { spoken_to_provider: optValue("S58", "no") },
    (p) => !p.includes("s59-care-response") && p.includes("s60-care-dismissal") && p.includes("s61-access-to-care")],
  ["S58 tried-but-could-not -> S60", { spoken_to_provider: optValue("S58", "i tried but") },
    (p) => !p.includes("s59-care-response") && p.includes("s60-care-dismissal")],
  ["Reflection shown once, on S74", {}, (p) =>
    p.includes("reflection-review") &&
    !p.includes("s77-reflection-chamber") && !p.includes("reflection-expansion")],
  ["S76 -> S77 default", {}, (p) => p.includes("s80-constellation-record")],
  ["S76 -> S78 patterns", { record_explore_choice: "patterns" },
    (p) => !p.includes("s80-constellation-record") && p.includes("s81-observed-patterns")],
  ["S76 -> S79 privacy", { record_explore_choice: "privacy" },
    (p) => !p.includes("s80-constellation-record") && p.includes("record-privacy")],
  ["Record saved last", {}, (p) => p[p.length - 1] === "s78-atlas-record-saved"],
  ["Privacy precedes save", {}, (p) => p.indexOf("record-privacy") < p.indexOf("s78-atlas-record-saved")],
  ["S64-S69 presented on one screen", {}, (p) =>
    p.includes("s64-narrative-chamber") &&
    !["narrative-p1", "narrative-p2", "most-important-thing"].some((s) => p.includes(s))],
  ["Narrative follows the priority question", {}, (p) =>
    p.indexOf("s64-narrative-chamber") === p.indexOf("priority-question") + 1],
];
for (const [name, answers, assertion] of cases) {
  check(assertion(walk(answers)), `branch case failed: ${name}`);
}

// 8. Copy and option lists match the blueprints verbatim.
const byLoer = new Map();
for (const s of screens) {
  for (const id of s.spansLoerScreens ?? (s.loerScreenId ? [s.loerScreenId] : [])) byLoer.set(id, s);
}
const qByScreen = new Map();
for (const q of data.questions) {
  if (!qByScreen.has(q.screenId)) qByScreen.set(q.screenId, []);
  qByScreen.get(q.screenId).push(q);
}
let copyChecked = 0;
let optsChecked = 0;
for (const [loerId, bp] of Object.entries(LOER_V7_BLUEPRINTS)) {
  const s = byLoer.get(loerId) ?? byLoer.get(loerId + "A");
  if (!s) {
    check(
      Object.hasOwn(LOER_V7_NOT_IMPLEMENTED, loerId),
      `no screen for blueprint ${loerId} (${bp.canonicalName}) and it is not a declared omission`,
    );
    continue;
  }
  const qs = qByScreen.get(s.screenId) ?? [];
  if (bp.options.length && qs.length && qs[0].options.length) {
    const want = bp.options.map((o) => o.value).join("|");
    const got = qs[0].options.map((o) => o.value).join("|");
    check(want === got, `${loerId} option values differ from the blueprint`);
    optsChecked += 1;
  }
  if (s.spansLoerScreens?.length) {
    const prompts = (data.narrativePrompts ?? []).filter((p) => p.screenId === s.screenId)
      .sort((a, b) => a.order - b.order);
    const i = s.spansLoerScreens.indexOf(loerId);
    check(prompts.length === s.spansLoerScreens.length,
      `${s.screenId} spans ${s.spansLoerScreens.length} screens but has ${prompts.length} prompts`);
    check(prompts[i]?.promptText?.trim() === bp.participantTitle.trim(),
      `${loerId} prompt text differs from the blueprint`);
    copyChecked += 1;
  } else if (bp.acknowledgements?.length) {
    // Screens built from "Required Acknowledgement N" rows carry one control
    // per acknowledgement rather than a single question titled after the screen.
    const want = bp.acknowledgements.map((a) => a.trim());
    const got = qs.filter((q) => q.required === "Required").map((q) => q.questionText.trim());
    check(
      want.length === got.length && want.every((w, i) => w === got[i]),
      `${loerId} acknowledgements differ from the blueprint (want ${want.length}, got ${got.length})`,
    );
    check(
      qs.filter((q) => q.required === "Required").length >= 4,
      `${loerId} must gate Continue on every mandatory acknowledgement`,
    );
    copyChecked += want.length;
  } else if (bp.valueGroups?.length > 1) {
    // Grouped multi-select: one control per value group, each with its own
    // heading, so the screen title is not any single question text.
    check(qs.length === bp.valueGroups.length,
      `${loerId} has ${bp.valueGroups.length} value groups but ${qs.length} questions`);
    if (!LOER_V7_DESIGN_OVERRIDDEN.includes(loerId)) {
      bp.valueGroups.forEach((g, i) => {
        const want = g.options.map((o) => o.value).join("|");
        const got = (qs[i]?.options ?? []).map((o) => o.value).join("|");
        check(want === got, `${loerId} group "${g.label}" options differ from the blueprint`);
      });
    } else {
      // Approved design supersedes the sheet; assert the controls still exist.
      bp.valueGroups.forEach((g, i) =>
        check((qs[i]?.options ?? []).length > 0, `${loerId} group "${g.label}" has no options`));
    }
    copyChecked += bp.valueGroups.length;
  } else if (LOER_V7_SUPPLEMENTED.includes(loerId)) {
    // Controls hand-supplied because the sheet lists no Allowed Values; the
    // wording is provisional, so only presence is asserted.
    check(qs.length > 0, `${loerId} is supplemented but emitted no questions`);
  } else if (Object.keys(bp.variantQuestions ?? {}).length) {
    // Adaptive A/B screen: each variant carries its own wording, and the two
    // must differ — sharing the cycle-assuming title is the bug this guards.
    const texts = Object.entries(bp.variantQuestions).map(([variant, want]) => {
      const vs = byLoer.get(variant);
      const got = vs ? (qByScreen.get(vs.screenId) ?? [])[0]?.questionText?.trim() : undefined;
      check(got === want.trim(), `${variant} question text differs from the blueprint`);
      return got;
    });
    check(new Set(texts).size === texts.length, `${loerId} variants share the same question text`);
    copyChecked += texts.length;
  } else if (bp.participantTitle && qs.length) {
    check(qs[0].questionText.trim() === bp.participantTitle.trim(),
      `${loerId} question text differs from the blueprint`);
    copyChecked += 1;
  }
}

// 9. Captures present / retired, and field ids unique.
const fields = new Set(data.questions.map((q) => q.fieldId));
for (const f of ["pain_present", "pain_pattern", "pain_triggers", "pain_management", "cycle_applicability",
                 "function_impact", "information_needs", "priority_question_text",
                 // `record_privacy_controls` (S79 storage) and
                 // `record_sharing_preference` were removed at the client's
                 // request; contribution consent is the only S79 capture left.
                 "reflection_review", "record_contribution_consent", "safety_flags", "consent_acknowledged",
                 "care_access_barriers"]) {
  check(fields.has(f), `expected capture missing: ${f}`);
}
for (const f of ["pain_response", "symptom_predictability", "pain_duration", "unusual_discharge", "period_dizziness"]) {
  check(!fields.has(f), `retired capture still present: ${f}`);
}
const typeOf = new Map(data.questions.map((q) => [q.fieldId, q.fieldType]));
for (const [f, t] of [["pain_timing", "multi_select"], ["symptoms_related_to", "multi_select"], ["care_response", "multi_select"]]) {
  check(typeOf.get(f) === t, `${f} should be ${t} (is ${typeOf.get(f)})`);
}
const dupes = [...fields].filter((f) => data.questions.filter((q) => q.fieldId === f).length > 1);
check(dupes.length === 0, `duplicate fieldIds: ${dupes.join(", ")}`);
for (const q of data.questions) {
  const vals = q.options.map((o) => o.value);
  check(new Set(vals).size === vals.length, `duplicate option values in ${q.fieldId}`);
}

// The wizard's RECORD_KINDS decides which screens trigger finalize(), and it
// has to list exactly the render kinds ScreenRenderer passes `record` to. When
// the reflection screens were merged these fell out of step, no screen carried
// a listed kind, finalize never ran, and the reflection screen showed
// "Preparing your record…" indefinitely — with no error anywhere, because the
// record generated correctly one screen later.
{
  const wizard = readFileSync(join(__dirname, "..", "src", "app", "(participant)", "observation", "ObservationWizard.tsx"), "utf-8");
  const renderer = readFileSync(join(__dirname, "..", "src", "app", "(participant)", "observation", "screens", "ScreenRenderer.tsx"), "utf-8");

  const declared = new Set(
    (wizard.match(/const RECORD_KINDS = new Set\(\[([\s\S]*?)\]\)/)?.[1] ?? "")
      .split(",").map((s) => s.trim().replace(/^["']|["'].*$/g, "")).filter(Boolean),
  );
  // Every `case "x":` block in ScreenRenderer that hands `record` to a child.
  const needsRecord = new Set();
  let currentCase = null;
  for (const line of renderer.split(/\r?\n/)) {
    const c = line.match(/^\s*case\s+"([a-z_]+)":/);
    if (c) currentCase = c[1];
    if (currentCase && /record=\{record\}/.test(line)) needsRecord.add(currentCase);
  }

  const missing = [...needsRecord].filter((k) => !declared.has(k));
  check(
    missing.length === 0,
    `RECORD_KINDS is missing ${missing.join(", ")} — those screens render the record but never trigger finalize()`,
  );
  // A kind in the live flow that needs the record must also be declared.
  const live = new Set(screens.map((s) => s.renderKind));
  const stranded = [...live].filter((k) => needsRecord.has(k) && !declared.has(k));
  check(stranded.length === 0, `live screens with kind ${stranded.join(", ")} would hang on "Preparing your record…"`);
}

// The dashboard's "Your Top Signals" card groups AIKB signals by signal type.
// SIGNAL_TYPE_DOMAIN is the only place the 28-type register meets the six-domain
// participant vocabulary, and an unmapped type silently falls through to the
// narrative group — a signal filed under "Your Words" that is really a bleeding
// signal, with nothing anywhere saying so. Same failure shape as RECORD_KINDS:
// two string sets that have to agree, and don't announce it when they stop.
{
  const registry = JSON.parse(
    readFileSync(join(__dirname, "..", "src", "content", "aikb", "signals.json"), "utf-8"),
  );
  const rows = Array.isArray(registry) ? registry : Object.values(registry).find(Array.isArray) ?? [];
  const types = new Set(rows.map((s) => s.signalType).filter(Boolean));

  const src = readFileSync(join(__dirname, "..", "src", "lib", "observation", "signal-types.ts"), "utf-8");
  const body = src.match(/SIGNAL_TYPE_DOMAIN[^=]*=\s*\{([\s\S]*?)\n\};/)?.[1] ?? "";
  const mapped = new Set([...body.matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]));

  const unmapped = [...types].filter((t) => !mapped.has(t)).sort();
  check(
    unmapped.length === 0,
    `SIGNAL_TYPE_DOMAIN is missing ${unmapped.join(", ")} — those signals would be grouped as narrative`,
  );
  const stale = [...mapped].filter((t) => !types.has(t)).sort();
  check(stale.length === 0, `SIGNAL_TYPE_DOMAIN maps ${stale.join(", ")}, which no longer exist in the AIKB registry`);
  console.log(`Signal types: ${types.size} in registry, all mapped to a display domain`);
}

console.log(`\nFlow: ${screens.length} screens, ${qByScreen.size} screens with questions, ${routes.length} routes`);
console.log(`Blueprint conformance: ${copyChecked} question texts, ${optsChecked} option lists compared`);
console.log(`Default path: ${walk({}).length} screens`);

if (failures.length) {
  console.error(`\nFAILED (${failures.length}):`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log(`\nPASS — ${cases.length} branch cases and all structural checks.`);
