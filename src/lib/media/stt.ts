import { SpeechClient } from "@google-cloud/speech";

export interface TranscriptionResult {
  transcription: string | null;
  language: string;
  provider: string;
}

let speechClient: SpeechClient | null = null;
function client(): SpeechClient {
  speechClient ??= new SpeechClient(); // auth via GOOGLE_APPLICATION_CREDENTIALS
  return speechClient;
}

// MediaRecorder mime type -> Speech-to-Text sync `recognize()` encoding.
// v1 sync recognize has no AAC/MP4 encoding, so Safari recordings (audio/mp4)
// can't be transcribed this way — the clip still saves, transcription stays null.
function encodingFor(mimeType: string): { encoding: "WEBM_OPUS" | "OGG_OPUS"; sampleRateHertz: number } | null {
  if (mimeType.includes("webm")) return { encoding: "WEBM_OPUS", sampleRateHertz: 48000 };
  if (mimeType.includes("ogg")) return { encoding: "OGG_OPUS", sampleRateHertz: 48000 };
  return null;
}

/**
 * Transcribe an audio clip via Google Cloud Speech-to-Text (sync `recognize`,
 * inline audio). Narrative prompts and chatbot voice messages are both short
 * (well under the ~1 minute / 10MB sync limit); if that ever changes, switch
 * to `longRunningRecognize` against the GCS object instead of inline content.
 */
export async function transcribeAudio(
  buffer: Buffer,
  mimeType: string,
  languageCode = "en-US",
): Promise<TranscriptionResult> {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { transcription: null, language: "und", provider: "stub" };
  }

  const audioConfig = encodingFor(mimeType);
  if (!audioConfig) {
    return { transcription: null, language: "und", provider: "unsupported-format" };
  }

  try {
    const [response] = await client().recognize({
      audio: { content: buffer.toString("base64") },
      config: {
        encoding: audioConfig.encoding,
        sampleRateHertz: audioConfig.sampleRateHertz,
        languageCode,
        enableAutomaticPunctuation: true,
        model: "latest_long",
      },
    });

    const transcription = (response.results ?? [])
      .map((r) => r.alternatives?.[0]?.transcript ?? "")
      .filter(Boolean)
      .join(" ")
      .trim();

    return { transcription: transcription || null, language: languageCode, provider: "google-stt" };
  } catch (error) {
    console.error("Speech-to-Text transcription failed:", error);
    return { transcription: null, language: "und", provider: "google-stt-error" };
  }
}
