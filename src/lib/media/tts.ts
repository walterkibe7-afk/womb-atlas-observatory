import { TextToSpeechClient } from "@google-cloud/text-to-speech";

export interface SynthesisResult {
  audio: Buffer | null;
  mimeType: string;
  provider: string;
}

let client: TextToSpeechClient | null = null;
function getClient(): TextToSpeechClient {
  if (!client) client = new TextToSpeechClient();
  return client;
}

/**
 * Synthesize speech via Google Cloud Text-to-Speech. Returns MP3 audio.
 * Returns `audio: null` (caller should treat as unavailable) if credentials
 * are missing or the API call fails.
 */
export async function synthesizeSpeech(
  text: string,
  languageCode = "en-US",
  voiceName = "en-US-Neural2-F",
): Promise<SynthesisResult> {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return { audio: null, mimeType: "audio/mpeg", provider: "stub" };
  }

  try {
    const [response] = await getClient().synthesizeSpeech({
      input: { text },
      voice: { languageCode, name: voiceName },
      audioConfig: { audioEncoding: "MP3" },
    });

    const audioContent = response.audioContent;
    if (!audioContent) {
      return { audio: null, mimeType: "audio/mpeg", provider: "google-tts-empty" };
    }

    const audio = Buffer.isBuffer(audioContent) ? audioContent : Buffer.from(audioContent);
    return { audio, mimeType: "audio/mpeg", provider: "google-tts" };
  } catch (err) {
    console.error("Text-to-Speech failed:", err);
    return { audio: null, mimeType: "audio/mpeg", provider: "google-tts-error" };
  }
}
