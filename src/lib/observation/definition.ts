import { prisma } from "@/lib/prisma";
import { loadTranslationMap } from "./translations";
import { resolveUiStrings, sectionSlug } from "./ui-strings";
import type {
  Condition,
  FormDefinition,
  ReflectionRuleDef,
  Route,
  Screen,
  SignalRuleDef,
  VisibilityRule,
} from "./types";

export async function getFormDefinition(
  flowKey = "first_observation",
  locale = "en",
): Promise<FormDefinition> {
  const [screenRows, signalRows, reflectionRows] = await Promise.all([
    prisma.formScreen.findMany({
      where: { flowKey },
      orderBy: { order: "asc" },
      include: {
        questions: {
          orderBy: { order: "asc" },
          include: { options: { orderBy: { order: "asc" } } },
        },
        narrativePrompts: { orderBy: { order: "asc" } },
        routes: { orderBy: { priority: "asc" } },
      },
    }),
    prisma.signalRule.findMany(),
    prisma.reflectionRule.findMany({ orderBy: { priority: "asc" } }),
  ]);

  const screenPrefixes = screenRows.map((s) => `SCREEN.${s.screenId}.`);
  // Section headings are participant-visible on the review screen but had no
  // translation path at all, so they stayed English in every locale. Keyed on a
  // slug of the heading rather than the screen, because many screens share one.
  const sectionPrefixes = [...new Set(screenRows.map((s) => s.section))]
    .filter(Boolean)
    .map((section) => `SECTION.${sectionSlug(section)}.`);
  const questionPrefixes = screenRows.flatMap((s) =>
    s.questions.map((q) => `QUESTION.${q.fieldId}.`),
  );
  const optionPrefixes = screenRows.flatMap((s) =>
    s.questions.flatMap((q) =>
      q.options.map((o) => `OPTION.${q.fieldId}.${o.value}.`),
    ),
  );
  const promptPrefixes = screenRows.flatMap((s) =>
    s.narrativePrompts.map((p) => `PROMPT.${p.promptId}.`),
  );
  const allPrefixes = [
    ...screenPrefixes,
    ...sectionPrefixes,
    ...questionPrefixes,
    ...optionPrefixes,
    ...promptPrefixes,
  ];

  const t = await loadTranslationMap(flowKey, locale, allPrefixes);

  const screens: Screen[] = screenRows.map((s) => ({
    screenId: s.screenId,
    flowKey: s.flowKey,
    name: t[`SCREEN.${s.screenId}.name`] ?? s.name,
    section: t[`SECTION.${sectionSlug(s.section)}.label`] ?? s.section,
    purpose: t[`SCREEN.${s.screenId}.purpose`] ?? s.purpose,
    inputType: s.inputType,
    renderKind: s.renderKind as Screen["renderKind"],
    primaryActionLabel: t[`SCREEN.${s.screenId}.primaryActionLabel`] ?? s.primaryActionLabel,
    order: s.order,
    atlasDomain: s.atlasDomain,
    mvpPhase: s.mvpPhase,
    status: s.status,
    visibilityRule: (s.visibilityRule as VisibilityRule | null) ?? null,
    questions: s.questions.map((q) => ({
      fieldId: q.fieldId,
      screenId: q.screenId,
      questionText: t[`QUESTION.${q.fieldId}.questionText`] ?? q.questionText,
      fieldType: q.fieldType,
      required: q.required,
      validation: q.validation,
      notes: q.notes,
      targetTable: q.targetTable,
      targetColumn: q.targetColumn,
      order: q.order,
      options: q.options.map((o) => ({
        value: o.value,
        label: t[`OPTION.${q.fieldId}.${o.value}.label`] ?? o.label,
        order: o.order,
        isExclusive: o.isExclusive,
        signalTag: o.signalTag,
      })),
    })),
    narrativePrompts: s.narrativePrompts.map((p) => ({
      promptId: p.promptId,
      screenId: p.screenId,
      promptText: t[`PROMPT.${p.promptId}.promptText`] ?? p.promptText,
      captureType: p.captureType,
      order: p.order,
    })),
  }));

  const routes: Route[] = screenRows.flatMap((s) =>
    s.routes.map((r) => ({
      fromScreenId: r.fromScreenId,
      toScreenId: r.toScreenId,
      condition: (r.condition as Condition | null) ?? null,
      priority: r.priority,
      note: r.note,
    })),
  );

  const signals: SignalRuleDef[] = signalRows.map((r) => ({
    signalId: r.signalId,
    name: r.name,
    domain: r.domain,
    sourceScreen: r.sourceScreen,
    severity: r.severity as SignalRuleDef["severity"],
    condition: r.condition as Condition,
  }));

  const reflectionRules: ReflectionRuleDef[] = reflectionRows.map((r) => ({
    ruleId: r.ruleId,
    condition: r.condition as Condition,
    reflectionType: r.reflectionType,
    templateCopy: r.templateCopy,
    targetScreen: r.targetScreen,
    priority: r.priority,
  }));

  return { flowKey, screens, routes, signals, reflectionRules, ui: resolveUiStrings(t) };
}
