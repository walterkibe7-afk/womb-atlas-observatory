import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Storage } from "@google-cloud/storage";

// Private local upload dirs (NOT under /public). Used only when GCS_BUCKET is
// unset (local dev without cloud credentials) — served only through the
// authenticated audio routes so health-related audio is never world-readable.
const NARRATIVE_DIR = path.join(process.cwd(), "uploads", "narratives");
const CHAT_DIR = path.join(process.cwd(), "uploads", "chat");
const BUCKET_NAME = process.env.GCS_BUCKET;

let storageClient: Storage | null = null;
function bucket() {
  storageClient ??= new Storage(); // auth via GOOGLE_APPLICATION_CREDENTIALS
  return storageClient.bucket(BUCKET_NAME!);
}

export interface StoredAudio {
  audioUrl: string; // app URL the client uses to play it back
  storageKey: string; // GCS object name (or local file name when GCS is unset)
}

function extFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  if (mimeType.includes("mp3") || mimeType.includes("mpeg")) return "mp3";
  return "webm";
}

/** Persist a buffer under `key` — to the GCS bucket when configured, else a local private folder. */
async function persist(localDir: string, key: string, buffer: Buffer, mimeType: string): Promise<void> {
  if (BUCKET_NAME) {
    await bucket().file(key).save(buffer, { contentType: mimeType, resumable: false });
  } else {
    await mkdir(localDir, { recursive: true });
    await writeFile(path.join(localDir, key), buffer);
  }
}

async function retrieve(localDir: string, key: string): Promise<Buffer> {
  if (BUCKET_NAME) {
    const [data] = await bucket().file(key).download();
    return data;
  }
  return readFile(path.join(localDir, key));
}

// ─── Narrative audio (observation flow) ─────────────────────────────

/**
 * Persist a narrative audio clip and return a URL the app can serve/play.
 *
 * Uploads to the private GCS bucket when GCS_BUCKET is configured; otherwise
 * falls back to a local private folder so the feature still works without
 * cloud credentials in dev. Either way the object is never public — playback
 * always goes through the authenticated /api/observation/narrative/audio route.
 */
export async function saveAudio(
  observationId: string,
  promptId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<StoredAudio> {
  const fileName = `${observationId}__${promptId}.${extFor(mimeType)}`;
  await persist(NARRATIVE_DIR, fileName, buffer, mimeType);
  return { audioUrl: `/api/observation/narrative/audio/${fileName}`, storageKey: fileName };
}

/** Read back a previously saved narrative audio clip by its storage key (file name). */
export async function readAudio(fileName: string): Promise<Buffer> {
  return retrieve(NARRATIVE_DIR, fileName);
}

// ─── Chat voice messages (Aminata) ───────────────────────────────────

/**
 * Persist a chat voice clip — a participant's recorded message or a
 * synthesized voice reply — keyed by the owning ChatMessage id. Same
 * GCS-or-local behavior as narrative audio; always served through the
 * authenticated /api/chat/audio route.
 */
export async function saveChatAudio(
  messageId: string,
  buffer: Buffer,
  mimeType: string,
): Promise<StoredAudio> {
  const fileName = `${messageId}.${extFor(mimeType)}`;
  await persist(CHAT_DIR, fileName, buffer, mimeType);
  return { audioUrl: `/api/chat/audio/${fileName}`, storageKey: fileName };
}

/** Read back a previously saved chat voice clip by its storage key (file name). */
export async function readChatAudio(fileName: string): Promise<Buffer> {
  return retrieve(CHAT_DIR, fileName);
}
