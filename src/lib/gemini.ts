import { GoogleGenAI } from "@google/genai";
import type { GenerateContentParameters, GenerateContentResponse } from "@google/genai";

// The chatbot LLM runs EXCLUSIVELY on Vertex AI. Auth is Application Default
// Credentials — the GOOGLE_APPLICATION_CREDENTIALS service account, which must
// hold the "Vertex AI User" IAM role — against the project + location below.
//
// There is deliberately NO Gemini Developer API (generativelanguage) fallback:
// every call goes through Vertex or fails loudly. Env:
//   GOOGLE_CLOUD_PROJECT   (required)  e.g. womb-atlas-observatory
//   GOOGLE_CLOUD_LOCATION  (optional)  defaults to us-central1
//   GOOGLE_APPLICATION_CREDENTIALS     the service-account key for ADC
const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || "us-central1";

/** True when Vertex AI is configured enough to construct the client. */
export function isVertexConfigured(): boolean {
  return !!project;
}

let cachedClient: GoogleGenAI | null = null;

/**
 * The Vertex AI client, constructed lazily on first use. Lazy so that merely
 * importing this module (e.g. from a code path that gracefully degrades when
 * the LLM is unavailable) never throws — only an actual call does.
 */
export function getAi(): GoogleGenAI {
  if (!project) {
    throw new Error(
      "Vertex AI not configured: set GOOGLE_CLOUD_PROJECT (and optionally " +
        "GOOGLE_CLOUD_LOCATION) plus GOOGLE_APPLICATION_CREDENTIALS.",
    );
  }
  cachedClient ??= new GoogleGenAI({ vertexai: true, project, location });
  return cachedClient;
}

/** `generateContent` against Vertex AI. Throws if Vertex isn't configured. */
export function generateContent(
  params: GenerateContentParameters,
): Promise<GenerateContentResponse> {
  return getAi().models.generateContent(params);
}

/** `generateContentStream` against Vertex AI. Throws if Vertex isn't configured. */
export async function* generateContentStream(
  params: GenerateContentParameters,
): AsyncGenerator<GenerateContentResponse> {
  const stream = await getAi().models.generateContentStream(params);
  for await (const chunk of stream) yield chunk;
}
