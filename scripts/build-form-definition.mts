/**
 * Regenerates prisma/seed/form-definition.json for the `first_observation` flow
 * from the committed v5 screen-register SOURCE, preserving the existing
 * `atlas_checkin` flow. This is the observation-flow analogue of build-aikb.mjs.
 *
 * SOURCE OF TRUTH (committed, hand-authored — mirrored from the mobile app):
 *   src/lib/observation/intelligence/v43/screen-register-first-observation.ts
 *   src/lib/observation/intelligence/v43/observation-contract.ts  (field bindings)
 *   prisma/seed/form-definition.legacy.json  (atlas_checkin flow + projection targets + narrative texts)
 *
 * Run:  npm run form:build      (node --experimental-strip-types)
 * Also writes the intermediate snapshots screen-register-v5.json +
 * app-to-registry-field-map.json for inspection.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { firstObservationScreens } from "../src/lib/observation/intelligence/v43/screen-register-first-observation.ts";
import { QUESTIONNAIRE_FIELD_BINDINGS } from "../src/lib/observation/intelligence/v43/observation-contract.ts";

const seedDir = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "seed");
const legacy = JSON.parse(readFileSync(join(seedDir, "form-definition.legacy.json"), "utf8"));

// app screen-register field id -> AIKB registry field id
const app2reg: Record<string, string> = {};
for (const b of QUESTIONNAIRE_FIELD_BINDINGS) app2reg[b.appFieldId] = b.registryFieldId;

// ---- render kind: mobile kind + id/chamber -> observatory renderKind ----
function renderKind(sc: { kind: string; id: string; chamber?: string }): string {
  const chamber = (sc.chamber ?? "").toLowerCase();
  if (sc.id.includes("consent") || chamber === "consent") return "consent";
  if (chamber === "safety") return sc.kind === "question" ? "safety_check" : "safety_alert";
  const map: Record<string, string> = {
    landing: "information",
    information: "information",
    transition: "information",
    question: "question",
    narrative: "narrative",
    processing: "processing",
    review: "review",
    reflection: "reflection",
    atlas_visualization: "constellation",
    observed_patterns: "observed_patterns",
    atlas_summary: "atlas_record",
    completion: "confirmation",
  };
  return map[sc.kind] ?? "information";
}

function fieldType(field: { id: string; type: string }): string {
  if (field.id === "consent_acknowledged") return "boolean";
  const map: Record<string, string> = {
    single_select: "single_select",
    multi_select: "multi_select",
    country_search: "country",
    text: "text",
    textarea: "text",
  };
  return map[field.type] ?? "text";
}

const EXCLUSIVE = new Set(["none", "none_of_these", "not_applicable", "no_changes"]);
const isExclusive = (value: string, label: string) =>
  EXCLUSIVE.has(value) || label.trim().toLowerCase().startsWith("none");

// registryFieldId -> (table, column) reused from the legacy definition (projection targets)
const regToTarget = new Map<string, [string, string]>();
for (const q of legacy.questions) {
  regToTarget.set(q.fieldId.toLowerCase(), [q.targetTable ?? "", q.targetColumn ?? ""]);
}
const registryFieldId = (appFieldId: string) => app2reg[appFieldId] ?? appFieldId;

// ---- partition legacy: keep the atlas_checkin flow ----
const checkinScreenIds = new Set(
  legacy.screens.filter((s: { flowKey: string }) => s.flowKey === "atlas_checkin").map((s: { screenId: string }) => s.screenId),
);
const oldCheckinScreens = legacy.screens.filter((s: { flowKey: string }) => s.flowKey === "atlas_checkin");
const oldCheckinQuestions = legacy.questions.filter((q: { screenId: string }) => checkinScreenIds.has(q.screenId));
const oldCheckinRoutes = legacy.routes.filter((r: { fromScreenId: string }) => checkinScreenIds.has(r.fromScreenId));

// ---- build first_observation from the v5 register ----
const newScreens: unknown[] = [];
const newQuestions: unknown[] = [];
const newRoutes: unknown[] = [];

firstObservationScreens.forEach((sc, order) => {
  // Screen copy: the short `description` is a subtitle; the substantive body text
  // for information/intro/transition screens lives in `body[]` (paragraphs). The
  // observatory renders a single `purpose` string, so compose both — otherwise
  // section-intro screens show only a heading with no description.
  const purpose = [sc.description, ...(sc.body ?? [])]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join("\n\n");
  newScreens.push({
    screenId: sc.id,
    flowKey: "first_observation",
    name: sc.title ?? sc.id,
    section: sc.chamber ?? "",
    purpose,
    inputType: sc.kind ?? "",
    renderKind: renderKind(sc),
    primaryActionLabel: sc.primaryActionLabel ?? "Continue",
    nextScreenRaw: sc.defaultNextScreenId ?? "",
    order,
    atlasDomain: sc.chamber ?? "None",
    mvpPhase: "MVP",
    status: "Locked",
    visibilityRule: null,
  });

  (sc.fields ?? []).forEach((field, fi) => {
    if (field.type === "information") return;
    const reg = registryFieldId(field.id);
    const [table, column] = regToTarget.get(reg) ?? ["", ""];
    newQuestions.push({
      fieldId: field.id,
      registryFieldId: reg,
      screenId: sc.id,
      questionText: field.label ?? field.id,
      fieldType: fieldType(field),
      required: field.required ? "Required" : "Optional",
      validation: null,
      notes: null,
      targetTable: table,
      targetColumn: column,
      order: fi,
      options: (field.options ?? []).map((opt, oi) => ({
        value: opt.value,
        label: opt.label ?? opt.value,
        order: oi,
        isExclusive: isExclusive(opt.value, opt.label ?? ""),
        signalTag: null,
      })),
    });
  });

  let prio = 0;
  for (const rule of sc.routingRules ?? []) {
    let condition: unknown = null;
    if (rule.equals !== undefined && rule.equals !== null) {
      condition = { field: rule.fieldId, op: "eq", value: rule.equals };
    } else if (rule.includes !== undefined && rule.includes !== null) {
      condition = { field: rule.fieldId, op: "contains_any", value: [rule.includes] };
    }
    newRoutes.push({ fromScreenId: sc.id, priority: prio++, toScreenId: rule.nextScreenId, condition, note: "v5 routingRule" });
  }
  if (sc.defaultNextScreenId) {
    newRoutes.push({ fromScreenId: sc.id, priority: prio, toScreenId: sc.defaultNextScreenId, condition: null, note: "v5 default" });
  }
});

// ---- narrative prompts: reattach legacy prompt texts to the v5 narrative screens ----
const narrScreen = firstObservationScreens.find((s) => s.kind === "narrative" && !s.id.includes("sensitive"))?.id;
const sensScreen = firstObservationScreens.find((s) => s.kind === "narrative" && s.id.includes("sensitive"))?.id;
const newPrompts = legacy.narrativePrompts.map((p: { promptId: string }) => ({
  ...p,
  screenId: p.promptId.toUpperCase().startsWith("SNP") ? sensScreen : narrScreen,
}));
const oldCheckinPrompts = legacy.narrativePrompts.filter((p: { screenId: string }) => checkinScreenIds.has(p.screenId));

const out = {
  flows: legacy.flows,
  screens: [...newScreens, ...oldCheckinScreens],
  questions: [...newQuestions, ...oldCheckinQuestions],
  narrativePrompts: [...newPrompts, ...oldCheckinPrompts],
  routes: [...newRoutes, ...oldCheckinRoutes],
  // The v4.3 engine replaces the old DSL signal/reflection rules.
  signals: [],
  reflectionRules: [],
};

// write outputs + refreshed intermediate snapshots
writeFileSync(join(seedDir, "form-definition.json"), JSON.stringify(out, null, 2));
writeFileSync(
  join(seedDir, "screen-register-v5.json"),
  JSON.stringify({ screens: firstObservationScreens, start: firstObservationScreens[0].id }),
);
writeFileSync(join(seedDir, "app-to-registry-field-map.json"), JSON.stringify(app2reg));

console.log(
  `first_observation: ${newScreens.length} screens, ${newQuestions.length} questions, ${newRoutes.length} routes, ${newPrompts.length} prompts`,
);
console.log(`atlas_checkin (preserved): ${oldCheckinScreens.length} screens, ${oldCheckinQuestions.length} questions`);
console.log(`TOTAL: ${out.screens.length} screens, ${out.questions.length} questions, ${out.routes.length} routes`);
