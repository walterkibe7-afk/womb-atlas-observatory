import { prisma } from "@/lib/prisma";
import { UI_TRANSLATION_PREFIX } from "./ui-strings";

export interface TranslationMap {
  [key: string]: string;
}

export async function loadTranslationMap(
  flowKey: string,
  locale: string,
  prefixes?: string[],
): Promise<TranslationMap> {
  if (locale === "en") return {};

  let allPrefixes: string[];

  if (prefixes) {
    allPrefixes = prefixes;
  } else {
    const screenIds = await prisma.formScreen.findMany({
      where: { flowKey },
      select: { screenId: true },
    });
    const screenIdSet = new Set(screenIds.map((s) => s.screenId));

    const questions = await prisma.formQuestion.findMany({
      where: { screenId: { in: [...screenIdSet] } },
      select: { fieldId: true },
    });
    const fieldIds = questions.map((q) => q.fieldId);

    const screenPrefixes = [...screenIdSet].map((id) => `SCREEN.${id}.`);
    const questionPrefixes = fieldIds.map((id) => `QUESTION.${id}.`);
    const optionPrefixes = fieldIds.map((id) => `OPTION.${id}.`);

    const prompts = await prisma.narrativePrompt.findMany({
      where: { screenId: { in: [...screenIdSet] } },
      select: { promptId: true },
    });
    const promptPrefixes = prompts.map((p) => `PROMPT.${p.promptId}.`);

    allPrefixes = [...screenPrefixes, ...questionPrefixes, ...optionPrefixes, ...promptPrefixes];
  }

  // Wizard chrome (nav buttons, safety banner) is flow-independent, so it is
  // always fetched — callers pass screen/question prefixes and shouldn't have
  // to know about it.
  allPrefixes = [...allPrefixes, UI_TRANSLATION_PREFIX];

  if (allPrefixes.length === 0) return {};

  const keyConditions = allPrefixes.map((p) => ({ key: { startsWith: p } }));

  const translations = await prisma.formTranslationData.findMany({
    where: {
      locale,
      translation: {
        OR: keyConditions,
      },
    },
    include: {
      translation: { select: { key: true } },
    },
  });

  const map: TranslationMap = {};
  for (const t of translations) {
    if (!t.translation?.key) continue;
    map[t.translation.key] = t.value;
  }
  return map;
}
