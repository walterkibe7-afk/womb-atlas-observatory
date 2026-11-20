import { NextResponse } from "next/server";
import { ActionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { logAuditEvent } from "@/lib/audit-logger";
import { generateContent, generateContentStream } from "@/lib/gemini";
import { buildParticipantContext } from "@/lib/chat/context";
import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import { languageInstruction } from "@/lib/ai/language-instruction";
import { transcribeAudio } from "@/lib/media/stt";
import { synthesizeSpeech } from "@/lib/media/tts";
import { saveChatAudio } from "@/lib/media/storage";
import { v43Text } from "@/lib/observation/intelligence/v43/v43-i18n";

export const runtime = "nodejs";

async function resolveUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** AI-generated short chat title (falls back to a truncated first message on failure). */
async function generateConversationTitle(firstMessage: string): Promise<string> {
  const fallback = firstMessage.slice(0, 80);
  try {
    const res = await generateContent({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      config: { temperature: 0.3, maxOutputTokens: 20 },
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Write a concise 3-6 word title (no quotes, no trailing punctuation) summarizing the topic of this chat message:\n\n"${firstMessage}"`,
            },
          ],
        },
      ],
    });
    const title = res.text?.trim().replace(/^["']+|["']+$/g, "");
    return title ? title.slice(0, 80) : fallback;
  } catch (err) {
    console.error("Chat title generation failed:", err);
    return fallback;
  }
}

/**
 * GET /api/chat — list the participant's conversations.
 */
export async function GET() {
  const userId = await resolveUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const conversations = await prisma.chatConversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true, createdAt: true },
  });

  return NextResponse.json({ conversations });
}

/**
 * POST /api/chat — send a message and stream Aminata's response.
 *
 * Two input modes:
 *   - JSON: { message: string, conversationId?: string } — typed text.
 *   - multipart/form-data: { audio: Blob, conversationId?: string } — a voice
 *     message. Transcribed server-side (never sent to the client as text);
 *     the transcript is emitted as the first SSE event so the UI can show
 *     what was heard, then the pipeline continues exactly as the text path.
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const locale = session?.user?.locale ?? "en";

  const contentType = req.headers.get("content-type") ?? "";
  let message: string;
  let conversationId: string | undefined;
  let transcript: string | undefined;
  let userMessageId: string | undefined;
  let userAudioUrl: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const audio = form.get("audio");
    const convId = form.get("conversationId");
    conversationId = typeof convId === "string" && convId ? convId : undefined;

    if (!(audio instanceof Blob)) {
      return NextResponse.json({ error: "audio is required" }, { status: 400 });
    }
    if (audio.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: v43Text("_template", "voiceMessageTooLarge", "Voice message is too large (max 10MB).", locale) },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await audio.arrayBuffer());
    const { transcription } = await transcribeAudio(buffer, audio.type || "audio/webm");
    if (!transcription?.trim()) {
      return NextResponse.json(
        {
          error: v43Text(
            "_template",
            "couldNotMakeOutVoice",
            "Couldn't make out that voice message — please try again or type instead.",
            locale,
          ),
        },
        { status: 422 },
      );
    }
    message = transcription.trim();
    transcript = message;

    // Persist the participant's recorded clip (GCS when GCS_BUCKET is set,
    // else a local private folder) — the message row below stores its URL.
    userMessageId = crypto.randomUUID();
    try {
      const stored = await saveChatAudio(userMessageId, buffer, audio.type || "audio/webm");
      userAudioUrl = stored.audioUrl;
    } catch (err) {
      console.error("Failed to store voice message audio (message still saved as text):", err);
    }
  } else {
    const body = (await req.json()) as { message: string; conversationId?: string };
    message = body.message;
    conversationId = body.conversationId;
  }

  if (!message?.trim()) {
    return NextResponse.json(
      { error: v43Text("_template", "messageRequired", "Message is required", locale) },
      { status: 400 },
    );
  }

  let isNewConversation = false;

  if (!conversationId) {
    const conversation = await prisma.chatConversation.create({
      data: {
        userId,
        title: message.slice(0, 80),
      },
    });
    conversationId = conversation.id;
    isNewConversation = true;

    // Audit the conversation's creation only. Individual chat messages are
    // high-frequency and intentionally NOT logged (they'd swamp the trail).
    await logAuditEvent({
      entityId: conversation.id,
      entityType: "ChatConversation",
      actionType: ActionType.CREATE,
      dataAfter: { title: conversation.title },
      userId,
    });
  } else {
    const existing = await prisma.chatConversation.findFirst({
      where: { id: conversationId, userId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: v43Text("_template", "conversationNotFound", "Conversation not found", locale) },
        { status: 404 },
      );
    }
  }

  await prisma.chatMessage.create({
    data: {
      ...(userMessageId ? { id: userMessageId } : {}),
      conversationId,
      role: "user",
      content: message,
      audioUrl: userAudioUrl,
    },
  });

  const history = await prisma.chatMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 40,
    select: { role: true, content: true },
  });

  const participantCtx = await buildParticipantContext(userId);
  // Placed first, same rule as the reflection pipeline's prompt: a language
  // directive appended after other instructions competes with them instead
  // of overriding.
  const systemPrompt = languageInstruction(locale) + buildSystemPrompt(participantCtx);

  const contents = history.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.content }],
  }));

  // Kick off in parallel with the main reply stream so it doesn't add latency.
  const titlePromise = isNewConversation ? generateConversationTitle(message) : null;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullResponse = "";

      try {
        if (transcript) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ transcript, conversationId, isNewConversation })}\n\n`),
          );
        }

        const response = generateContentStream({
          model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
            maxOutputTokens: 1024,
          },
          contents,
        });

        for await (const chunk of response) {
          const text = chunk.text ?? "";
          if (text) {
            fullResponse += text;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text, conversationId, isNewConversation })}\n\n`),
            );
            isNewConversation = false;
          }
        }

        // Voice-originated turn -> synthesize the reply and persist it the
        // same way as the participant's clip, so it survives a reload.
        let assistantMessageId: string | undefined;
        let assistantAudioUrl: string | undefined;
        if (transcript && fullResponse.trim()) {
          try {
            const { audio, mimeType } = await synthesizeSpeech(fullResponse);
            if (audio) {
              assistantMessageId = crypto.randomUUID();
              const stored = await saveChatAudio(assistantMessageId, audio, mimeType);
              assistantAudioUrl = stored.audioUrl;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ audioUrl: assistantAudioUrl, conversationId })}\n\n`),
              );
            }
          } catch (err) {
            console.error("Voice reply synthesis/storage failed (reply still saved as text):", err);
          }
        }

        await prisma.chatMessage.create({
          data: {
            ...(assistantMessageId ? { id: assistantMessageId } : {}),
            conversationId: conversationId!,
            role: "assistant",
            content: fullResponse,
            audioUrl: assistantAudioUrl,
          },
        });

        const title = titlePromise ? await titlePromise : undefined;
        await prisma.chatConversation.update({
          where: { id: conversationId! },
          data: { updatedAt: new Date(), ...(title ? { title } : {}) },
        });

        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
        console.error("Gemini stream error:", err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
