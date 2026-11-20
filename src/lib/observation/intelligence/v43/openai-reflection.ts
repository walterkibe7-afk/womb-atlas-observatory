import type { AtlasReflectionContent } from "./atlas-intelligence-v43";
import type {
  AtlasPatternRecord,
  KnowledgeContext,
  ReflectionPlan
} from "./types";
import { generateContent, isVertexConfigured } from "@/lib/gemini";
import { languageInstruction as sharedLanguageInstruction, targetLanguage } from "@/lib/ai/language-instruction";

// Literal phrases that are always diagnostic/clinical and must never appear.
const blockedTerms = [
  "diagnosis",
  "diagnose",
  "likely condition",
  "disease probability",
  "risk score"
];

// Diagnostic *constructions* — e.g. "you have a condition", "you may have PCOS",
// "diagnosed with ...". Deliberately NOT the bare phrase "you have", which also
// matches benign observational prose ("you have been noticing", "you have
// experienced", "you have developed ways to cope") and previously blocked every
// LLM reflection. We only block "you (have|may have|likely have|might have) <a
// clinical noun>".
const blockedPatterns = [
  /\byou (?:have|may have|might have|likely have|probably have) (?:a |an |the )?(?:condition|disorder|disease|syndrome|infection|deficiency|imbalance|diagnosis|endometriosis|pcos|fibroids?|adenomyosis)\b/,
  /\bdiagnosed with\b/,
  /\byou (?:have|are) (?:likely|probably) /
];

// `blockedTerms`/`blockedPatterns` above are ASCII English — a `.toLowerCase()`
// substring/regex check against them cannot ever match Arabic-script text, the
// same way "hello".includes("你好") is always false. That made this governance
// layer a complete no-op for Urdu specifically, not just weaker coverage: an
// Urdu reflection could state a diagnosis outright and nothing would catch it.
// Same rigor tier as the English list (a substring blocklist, not a semantic
// filter) — keep in lockstep with it: any English term/pattern added above
// should get an Urdu equivalent added here too. This list needs a native
// speaker's sign-off before relying on it in production; it closes the
// zero-coverage gap, it does not claim to be complete (paraphrase and
// code-switching into English mid-sentence still slip through, same caveat
// that already applies to the English list above).
const BLOCKED_TERMS_BY_LOCALE: Record<string, string[]> = {
  ur: [
    "تشخیص", // diagnosis
    "بیماری", // disease
    "کا امکان", // "...likelihood of" construction
    "خطرے کا اسکور", // risk score
  ],
};

type OpenAiReflectionInput = {
  plan: ReflectionPlan;
  knowledgeContext: KnowledgeContext;
  patterns: AtlasPatternRecord[];
  baseline: AtlasReflectionContent;
  /** Participant's chosen locale, so the reflection is written in it. */
  locale?: string;
};

type OpenAiReflectionResponse = Partial<AtlasReflectionContent>;

type LlmConfig =
  | { provider: "openai"; apiKey: string; model: string }
  | { provider: "gemini"; model: string };

// Provider selection. OpenAI wins if its key is present; otherwise Gemini runs
// on Vertex AI (never the Developer API).
// - OpenAI:  OPENAI_API_KEY  (+ optional OPENAI_MODEL, default gpt-4o-mini)
// - Gemini:  Vertex AI via ADC (see src/lib/gemini.ts) — no API key. Requires
//            GOOGLE_CLOUD_PROJECT etc.; model from GEMINI_MODEL, default
//            gemini-2.5-flash.
function getLlmConfig(): LlmConfig | null {
  const openAiKey = process.env.OPENAI_API_KEY?.trim();
  if (openAiKey) {
    return {
      provider: "openai",
      apiKey: openAiKey,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
    };
  }

  if (isVertexConfigured()) {
    return {
      provider: "gemini",
      model: process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash",
    };
  }

  return null;
}

function validateReflectionOutput(content: OpenAiReflectionResponse, locale?: string) {
  const corpus = JSON.stringify(content).toLowerCase();

  for (const term of blockedTerms) {
    if (corpus.includes(term)) {
      throw new Error(`LLM reflection output blocked by governance: "${term}"`);
    }
  }
  for (const pattern of blockedPatterns) {
    const match = corpus.match(pattern);
    if (match) {
      throw new Error(`LLM reflection output blocked by governance: "${match[0]}"`);
    }
  }

  // Arabic script has no case concept, so this checks the raw (non-lowercased)
  // output rather than `corpus` above.
  const localizedTerms = locale ? BLOCKED_TERMS_BY_LOCALE[locale] ?? [] : [];
  if (localizedTerms.length > 0) {
    const rawCorpus = JSON.stringify(content);
    for (const term of localizedTerms) {
      if (rawCorpus.includes(term)) {
        throw new Error(`LLM reflection output blocked by governance (${locale}): "${term}"`);
      }
    }
  }
}

function mergeReflection(
  from: OpenAiReflectionResponse,
  fallback: AtlasReflectionContent,
): AtlasReflectionContent {
  return {
    openingInsight: from.openingInsight ?? fallback.openingInsight,
    dominantPattern: from.dominantPattern ?? fallback.dominantPattern,
    dominantPatternSummary:
      from.dominantPatternSummary ?? fallback.dominantPatternSummary,
    supportingPatterns: from.supportingPatterns ?? fallback.supportingPatterns,
    whatAppearsConnected:
      from.whatAppearsConnected ?? fallback.whatAppearsConnected,
    whatExperienceMayMean:
      from.whatExperienceMayMean ?? fallback.whatExperienceMayMean,
    whatExperienceAsks: from.whatExperienceAsks ?? fallback.whatExperienceAsks,
    strengthsObserved: from.strengthsObserved ?? fallback.strengthsObserved,
    bodyLiteracyNote: from.bodyLiteracyNote ?? fallback.bodyLiteracyNote,
    whatAtlasWillWatch: from.whatAtlasWillWatch ?? fallback.whatAtlasWillWatch,
    supportingObservations: fallback.supportingObservations
  };
}

/**
 * The language directive, placed FIRST in the system prompt.
 *
 * Position matters: the user turn carries `baselineReflection`, a complete
 * English reflection, and a directive appended after the other rules competes
 * with that exemplar. Stated first, and repeated in the payload beside the
 * English it must not copy.
 *
 * Wraps the shared, generic `languageInstruction` (also used by Aminata's
 * chat prompt) with the two things specific to this JSON-structured pipeline:
 * not copying the English `baselineReflection` exemplar, and preserving the
 * JSON keys in English.
 */
function languageInstruction(locale: string | undefined): string {
  const base = sharedLanguageInstruction(locale);
  if (!base) return "";
  const lang = targetLanguage(locale)!;
  return `${base.trimEnd()}
The input you are given is in English. It is source material, NOT a template to copy: read it, then write your response in ${lang.name}.
Keep the JSON keys exactly as given, in English.

`;
}

// Locales written in a script other than Latin. For these, "did the model
// actually answer in the target language?" is answerable from the characters
// alone. Spanish, French, Dholuo and Kikuyu are all Latin-script, so an English
// response is indistinguishable from a real one without a language detector —
// this check deliberately covers only what it can prove.
const NON_LATIN_SCRIPT: Record<string, RegExp> = {
  ur: /[؀-ۿ]/,
};

/**
 * Warn when a non-English reflection came back in English anyway.
 *
 * Silent language failures are the expensive kind: the participant gets English
 * prose under an "AI-assisted" label and nothing in the system says the
 * instruction was ignored.
 */
function warnIfNotTranslated(content: OpenAiReflectionResponse, locale: string | undefined) {
  const lang = targetLanguage(locale);
  if (!lang) return;
  const script = NON_LATIN_SCRIPT[lang.code];
  if (!script) return;
  const corpus = JSON.stringify(content);
  if (!script.test(corpus)) {
    console.warn(
      `Reflection requested in ${lang.name} (${lang.code}) came back with no ${lang.name} characters — ` +
        `the model ignored the language requirement. Participant will read English prose.`,
    );
  }
}

function buildPrompt(input: OpenAiReflectionInput) {
  const dominantPattern = input.patterns.find((pattern) => pattern.role === "dominant");
  const supportingPatterns = input.patterns
    .filter((pattern) => pattern.id !== dominantPattern?.id)
    .slice(0, 3);

  return {
    system: `${languageInstruction(input.locale)}You are Atlas Reflection Assembly for Womb Atlas Observatory.
Write observational, non-diagnostic reflection copy for a participant-facing health observatory.
Never diagnose, score disease probability, name conditions, or give medical advice.
Interpret lived experience first. Do not repeat raw questionnaire answers.
Return JSON only.`,
    user: JSON.stringify(
      {
        reflectionPlan: {
          archetype: input.plan.archetypeName,
          tone: input.plan.tone,
          dominantPatternIds: input.plan.dominantPatternIds,
          supportingPatternIds: input.plan.supportingPatternIds,
          protectiveStrengths: input.plan.protectiveStrengths,
          futureWatchAreas: input.plan.futureWatchAreas,
          reflectionQuestions: input.plan.reflectionQuestions
        },
        knowledgeContext: {
          educationNotes: input.knowledgeContext.educationNotes,
          strengthNotes: input.knowledgeContext.strengthNotes,
          trajectoryNotes: input.knowledgeContext.trajectoryNotes,
          careContextNotes: input.knowledgeContext.careContextNotes
        },
        patterns: {
          dominant: dominantPattern
            ? {
                id: dominantPattern.id,
                name: dominantPattern.name,
                meaning: dominantPattern.meaning,
                watchOverTime: dominantPattern.watchOverTime
              }
            : null,
          supporting: supportingPatterns.map((pattern) => ({
            id: pattern.id,
            name: pattern.name,
            meaning: pattern.meaning
          }))
        },
        // Repeated here on purpose: it sits next to the English baseline, which
        // is what the model otherwise imitates.
        outputLanguage: targetLanguage(input.locale)
          ? `${targetLanguage(input.locale)!.name} (${targetLanguage(input.locale)!.nativeName}) — every string value below must be written in this language`
          : "English",
        baselineReflection: input.baseline,
        requiredJsonShape: {
          openingInsight: "string",
          dominantPattern: "string",
          dominantPatternSummary: "string",
          supportingPatterns: ["string"],
          whatAppearsConnected: ["string"],
          whatExperienceMayMean: "string",
          whatExperienceAsks: ["string"],
          strengthsObserved: ["string"],
          bodyLiteracyNote: "string",
          whatAtlasWillWatch: ["string"]
        }
      },
      null,
      2
    )
  };
}

type LlmPrompt = { system: string; user: string };

/** OpenAI chat-completions transport. Returns the raw JSON content string. */
async function callOpenAi(
  prompt: LlmPrompt,
  config: Extract<LlmConfig, { provider: "openai" }>,
  locale?: string
): Promise<string> {
  const controller = new AbortController();
  // Same reasoning as the Gemini path: eleven prose fields do not fit in a
  // few seconds, and a non-English response needs more tokens still.
  const translating = Boolean(locale) && locale !== "en";
  const timeoutId = setTimeout(() => controller.abort(), translating ? 45000 : 30000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned an empty reflection response.");
    }

    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Google Gemini transport via Vertex AI (the shared @/lib/gemini client — ADC
 * auth, never the Developer API). Uses the same system/user prompt and JSON-only
 * output. Returns the raw JSON content string.
 */
async function callGemini(prompt: LlmPrompt, model: string, locale?: string): Promise<string> {
  // A non-English response needs materially more output tokens for the same
  // text — Urdu, Dholuo and Kikuyu all tokenize far less efficiently than
  // English — and more tokens means more wall-clock time.
  const translating = Boolean(locale) && locale !== "en";

  const res = await generateContent({
    model,
    config: {
      systemInstruction: prompt.system,
      temperature: 0.4,
      responseMimeType: "application/json",
      maxOutputTokens: translating ? 6144 : 3072,
      // gemini-2.5-flash reasons before answering by default. This call rewrites
      // prose for a plan that is already decided, so the thinking budget buys
      // nothing and costs seconds.
      thinkingConfig: { thinkingBudget: 0 },
      // 12s was not enough for eleven prose fields and produced a
      // DEADLINE_EXCEEDED on every generation, so the participant always got the
      // deterministic baseline. The check-in companion, which works, sets no
      // timeout at all; this keeps a bound so a hung call cannot hold the
      // observation open, but a realistic one.
      httpOptions: { timeout: translating ? 45000 : 30000 }
    },
    contents: [{ role: "user", parts: [{ text: prompt.user }] }]
  });

  const content = (res.text ?? "").trim();
  if (!content) {
    throw new Error("Gemini returned an empty reflection response.");
  }

  return content;
}

/**
 * Rewrite the deterministic baseline reflection prose with an LLM (OpenAI or
 * Gemini, whichever key is configured). Returns null when no key is set; throws
 * on transport/governance failure so the caller falls back to the baseline.
 */
export async function enhanceReflectionWithLlm(
  input: OpenAiReflectionInput
): Promise<AtlasReflectionContent | null> {
  const config = getLlmConfig();

  if (!config) {
    return null;
  }

  // Log the locale the call actually received. A silently-undefined locale is
  // indistinguishable from a model that ignored the language, and the two need
  // completely different fixes.
  const lang = targetLanguage(input.locale);
  console.log(
    `[Reflection] provider=${config.provider} locale=${input.locale ?? "(none)"} ` +
      `${lang ? `generating in ${lang.name}` : "generating in English"}`,
  );

  const prompt = buildPrompt(input);
  const content =
    config.provider === "openai"
      ? await callOpenAi(prompt, config, input.locale)
      : await callGemini(prompt, config.model, input.locale);

  const parsed = JSON.parse(content) as OpenAiReflectionResponse;
  validateReflectionOutput(parsed, input.locale);

  warnIfNotTranslated(parsed, input.locale);

  return mergeReflection(parsed, input.baseline);
}
