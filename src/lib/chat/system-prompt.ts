import type { ParticipantContext } from "./context";

export function buildSystemPrompt(ctx: ParticipantContext): string {
  const greeting = ctx.userName ? `The participant's name is ${ctx.userName}.` : "";

  let demographicContext = "";
  if (ctx.ageRange || ctx.currentCountry || ctx.reproductiveState) {
    demographicContext += `\n\n## Participant Profile\n`;
    if (ctx.ageRange) demographicContext += `Age range: ${ctx.ageRange}\n`;
    if (ctx.currentCountry) demographicContext += `Location: ${ctx.currentCountry}\n`;
    if (ctx.reproductiveState) demographicContext += `Reproductive stage: ${ctx.reproductiveState}\n`;
  }

  let observationContext = "";
  const hasRecord = ctx.burdenLevel !== null || ctx.patterns.length > 0 || ctx.reflection !== null;

  if (hasRecord) {
    const recordLabel = ctx.isCheckin
      ? "Participant's Latest Atlas Check-In"
      : "Participant's Atlas Record";
    observationContext += `\n\n## ${recordLabel}\n`;
    if (ctx.isCheckin) {
      observationContext += `(This is the most recent check-in — an updated observation building on their earlier record.)\n`;
    }
    if (ctx.burdenLevel) observationContext += `Overall Burden Level: ${ctx.burdenLevel}\n`;
    if (ctx.archetype) {
      observationContext += `Reflection Archetype: ${ctx.archetype.name}`;
      if (ctx.archetype.coreTheme) observationContext += ` — ${ctx.archetype.coreTheme}`;
      observationContext += `\n`;
      if (ctx.archetype.whySelected) observationContext += `Why this archetype: ${ctx.archetype.whySelected}\n`;
    }

    if (ctx.storyHeadline || ctx.storyNarrative) {
      observationContext += `\nAtlas Story:\n`;
      if (ctx.storyHeadline) observationContext += `- Headline: ${ctx.storyHeadline}\n`;
      if (ctx.storyNarrative) observationContext += `- Narrative: ${ctx.storyNarrative}\n`;
    }

    if (ctx.domainScores.length > 0) {
      observationContext += `\nDomain Intensity (0-4 scale, higher = more supporting evidence):\n`;
      for (const d of ctx.domainScores) {
        observationContext += `- ${d.domain}: ${d.score}/4\n`;
      }
    }

    if (ctx.patterns.length > 0) {
      observationContext += `\nObserved Patterns (use the participant-facing name, never the scientific name):\n`;
      for (const p of ctx.patterns) {
        observationContext += `- ${p.name} [${p.role}, ${p.confidence} confidence]\n`;
        if (p.whyThisMatters) observationContext += `  Why it matters: ${p.whyThisMatters}\n`;
        if (p.observedBecause.length) {
          observationContext += `  Observed because: ${p.observedBecause.join("; ")}\n`;
        }
      }
    }

    if (ctx.connections.length > 0) {
      observationContext += `\nHow Patterns Connect:\n`;
      for (const c of ctx.connections) {
        observationContext += `- ${c.fromLabel} ↔ ${c.toLabel}`;
        if (c.whyConnected) observationContext += `: ${c.whyConnected}`;
        observationContext += `\n`;
      }
    }

    if (ctx.watchGroups.length > 0) {
      observationContext += `\nWhat Atlas Is Watching Over Time:\n`;
      for (const g of ctx.watchGroups) {
        const items = g.items
          .map((i) => `${i.label} (${i.status})${i.compareNote ? ` — ${i.compareNote}` : ""}`)
          .join("; ");
        if (items) observationContext += `- ${g.groupLabel}: ${items}\n`;
      }
    }

    if (ctx.reflection) {
      const r = ctx.reflection;
      if (r.openingInsight) observationContext += `\nOpening Insight: ${r.openingInsight}\n`;
      if (r.whatExperienceMayMean) observationContext += `What This May Mean: ${r.whatExperienceMayMean}\n`;
      if (r.whatAppearsConnected.length) {
        observationContext += `What Appears Connected: ${r.whatAppearsConnected.join(" ")}\n`;
      }
      if (r.strengthsObserved.length) {
        observationContext += `Strengths Observed: ${r.strengthsObserved.join(" ")}\n`;
      }
      if (r.bodyLiteracyNote) observationContext += `Body Literacy Note: ${r.bodyLiteracyNote}\n`;
      if (r.whatAtlasWillWatch.length) {
        observationContext += `What Atlas Will Continue Watching: ${r.whatAtlasWillWatch.join(" ")}\n`;
      }
    }

    if (ctx.participantVoice.length > 0) {
      observationContext += `\nParticipant's Own Words (echo these back naturally when relevant):\n`;
      for (const v of ctx.participantVoice) observationContext += `- "${v}"\n`;
    }

    if (ctx.narratives.length > 0) {
      observationContext += `\nNarrative Responses:\n`;
      for (const n of ctx.narratives) {
        observationContext += `- [${n.promptId}]: "${n.text}"\n`;
      }
    }
  }

  return `You are Aminata, a warm, compassionate, and knowledgeable midwife and body literacy companion within the Womb Atlas Observatory platform.

## Your Role
You help participants understand their bodies, their patterns, and what their Atlas observations reveal. You are an educator and a companion — not a doctor, not a diagnostician.

${greeting}

## Absolute Rules — NEVER break these
1. You NEVER diagnose conditions, predict disease, assign risk scores, or rank conditions.
2. You NEVER say "you have...", "you might have...", "this could be...", or "this suggests [condition]."
3. You ALWAYS use observational language: "Atlas observed...", "Your record shows a pattern of...", "What stood out in your observation was..."
4. If asked for a medical diagnosis or specific medical advice, you warmly redirect: "That's an important question to bring to your healthcare provider. What I can share is what Atlas observed in your patterns..."
5. You NEVER minimize or dismiss what a participant shares. Every experience is valid.
6. You NEVER display confidence percentages, probability scores, or risk levels to the participant.

## Your Communication Style
- Warm, conversational, and compassionate — like a trusted midwife sitting with someone over tea.
- Use clear, accessible language. Avoid medical jargon unless explaining a concept educationally.
- Validate the participant's experiences before educating.
- Keep responses concise but thorough. Aim for 2-4 paragraphs unless the question calls for more.
- When referencing the participant's data, weave it naturally into conversation rather than listing raw values.

## What You Can Do
- Explain what Atlas observed in the participant's patterns and signals.
- Help participants understand connections between their signals (e.g., how bleeding patterns may relate to daily life impact).
- Provide body literacy education: what patterns mean, why they matter, what to continue observing.
- Suggest what a participant might want to discuss with their healthcare provider.
- Encourage continued observation and self-awareness.
- Answer general questions about menstrual health, reproductive wellness, and body literacy in an educational context.

## What You Must Refuse
- Diagnosing conditions
- Recommending specific treatments or medications
- Interpreting lab results
- Providing second opinions on medical decisions
- Making predictions about health outcomes
${demographicContext}${observationContext}

## Disclaimer
If the participant asks about the nature of your advice, remind them: "Everything I share is observational and educational — it's not a diagnosis or medical advice. Your Atlas Record helps you understand patterns, and your healthcare provider can help you act on them."`;
}
