"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Plus, Loader2, Mic, Square, Volume2, Trash2, PanelLeft, X } from "lucide-react";
import { useChatStore } from "@/stores/chat-store";
import { AudioPlayer } from "./AudioPlayer";
import { useUiStrings } from "@/lib/observation/ui-strings-context";

const CANDIDATE_MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATE_MIME.find((m) => MediaRecorder.isTypeSupported(m));
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  /** Object URL of a voice clip — the recorded message (user) or TTS reply (assistant). */
  audioUrl?: string;
  /** Render this message as an audio player instead of text. */
  isVoice?: boolean;
}

interface Conversation {
  id: string;
  title: string | null;
  updatedAt: string;
}

interface ChatInterfaceProps {
  compact?: boolean;
  showHistory?: boolean;
}

export function ChatInterface({ compact = false, showHistory = true }: ChatInterfaceProps) {
  const strings = useUiStrings();
  const { activeConversationId, setActiveConversation } = useChatStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // Below lg the conversation list is an off-canvas drawer; at lg+ it is always
  // visible as a column and this flag is ignored.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingSpeechId, setLoadingSpeechId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  // When a message creates a new conversation mid-stream we adopt its id, but
  // must NOT reload from the DB — the DB only has text (voice clips live in
  // memory), so reloading would clobber the live audio-player bubbles.
  const suppressLoadRef = useRef<string | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConversationId) {
      if (suppressLoadRef.current === activeConversationId) {
        // We just created this conversation ourselves — keep the live messages
        // (audio players included) instead of reloading text from the DB.
        suppressLoadRef.current = null;
        return;
      }
      loadConversation(activeConversationId);
    } else {
      setMessages([]);
    }
  }, [activeConversationId]);

  async function fetchConversations() {
    try {
      const res = await fetch("/api/chat");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } catch {
      // silently fail
    }
  }

  async function loadConversation(id: string) {
    try {
      const res = await fetch(`/api/chat/${id}`);
      if (res.ok) {
        const data = await res.json();
        const loaded: Array<Message & { audioUrl?: string | null }> = data.conversation?.messages ?? [];
        setMessages(loaded.map((m) => ({ ...m, isVoice: !!m.audioUrl, audioUrl: m.audioUrl ?? undefined })));
      }
    } catch {
      // silently fail
    }
  }

  function startNewConversation() {
    setActiveConversation(null);
    setMessages([]);
    inputRef.current?.focus();
  }

  // Plain functions (not useCallback) so `rec.onstop` — reassigned fresh each
  // time recording starts — always closes over the latest state rather than a
  // memoized snapshot from an earlier render.
  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => {
    return () => {
      stopTracks();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recording stops -> stage a preview (the pill in the composer). Nothing is
  // sent until the participant presses publish.
  function handleRecordingStop() {
    const type = recorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type });
    stopTracks();
    if (blob.size === 0) return;
    setRecordedBlob(blob);
    setRecordedUrl(URL.createObjectURL(blob));
  }

  function discardRecording() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
  }

  async function startRecording() {
    setVoiceError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = handleRecordingStop;
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      setVoiceError(strings.chatMicUnavailable);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  const playReply = useCallback(
    async (message: Message) => {
      if (speakingId === message.id) {
        audioPlayerRef.current?.pause();
        setSpeakingId(null);
        return;
      }
      setLoadingSpeechId(message.id);
      setVoiceError(null);
      try {
        const res = await fetch("/api/chat/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: message.content }),
        });
        if (!res.ok) {
          setVoiceError(strings.chatCouldNotPlayReply);
          return;
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (!audioPlayerRef.current) audioPlayerRef.current = new Audio();
        const player = audioPlayerRef.current;
        player.src = url;
        player.onended = () => {
          setSpeakingId(null);
          URL.revokeObjectURL(url);
        };
        await player.play();
        setSpeakingId(message.id);
      } catch {
        setVoiceError(strings.chatCouldNotPlayReply);
      } finally {
        setLoadingSpeechId(null);
      }
    },
    [speakingId, strings.chatCouldNotPlayReply],
  );

  /**
   * Posts to /api/chat — JSON for typed text, multipart for a voice message —
   * and streams Aminata's reply into a new assistant message.
   *
   * For a voice turn (`isVoice`), the transcript is never shown: the reply text
   * accumulates off-screen (the bubble shows a "generating" state) while the
   * server synthesizes + persists the voice reply and pushes its URL over SSE
   * (`parsed.audioUrl`), rendered as an audio player — same design as the sent
   * clip, and it does NOT autoplay. If server-side TTS fails, the message
   * falls back to showing the reply text so nothing is lost.
   */
  async function sendToServer(opts: {
    body: BodyInit;
    headers?: Record<string, string>;
    isVoice?: boolean;
  }) {
    setIsStreaming(true);

    const assistantId = `temp-assistant-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      isVoice: opts.isVoice,
    };
    setMessages((prev) => [...prev, assistantMsg]);
    const patchAssistant = (patch: Partial<Message>) =>
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: opts.headers,
        body: opts.body,
      });

      if (!res.ok || !res.body) {
        let errorText = strings.chatSomethingWentWrong;
        try {
          const errJson = await res.json();
          if (errJson?.error) errorText = errJson.error;
        } catch {
          // non-JSON error body — keep the generic message
        }
        patchAssistant({ content: errorText, isVoice: false });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";
      let receivedAudioUrl = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.replace(/^data: /, "");
          if (!trimmed || trimmed === "[DONE]") continue;

          try {
            const parsed = JSON.parse(trimmed);

            if (parsed.error) {
              patchAssistant({ content: strings.chatSomethingWentWrong, isVoice: false });
              break;
            }

            if (parsed.conversationId && !activeConversationId) {
              suppressLoadRef.current = parsed.conversationId;
              setActiveConversation(parsed.conversationId);
            }

            if (parsed.audioUrl) {
              // Server already synthesized + persisted the voice reply (see
              // /api/chat's voice-turn branch) — no client-side TTS call needed.
              receivedAudioUrl = true;
              patchAssistant({ audioUrl: parsed.audioUrl });
            }

            if (parsed.text) {
              fullResponse += parsed.text;
              const acc = fullResponse;
              // For a voice turn the text stays off-screen; keep it stored so
              // it can still fall back to text if server-side TTS failed.
              patchAssistant({ content: acc });
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      fetchConversations();

      if (opts.isVoice && !receivedAudioUrl) {
        // Server-side synthesis failed or produced nothing — reveal the text fallback.
        patchAssistant({ isVoice: false });
      }
    } catch {
      patchAssistant({ content: strings.chatCouldNotConnect, isVoice: false });
    } finally {
      setIsStreaming(false);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = { id: `temp-${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    await sendToServer({
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, conversationId: activeConversationId }),
    });
  }

  // Publish the staged recording: show it as an audio-only bubble, transcribe +
  // answer on the server, reply comes back as audio (see sendToServer).
  async function publishRecording() {
    if (!recordedBlob || isStreaming) return;
    const blob = recordedBlob;
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);

    const userMsg: Message = {
      id: `temp-voice-${Date.now()}`,
      role: "user",
      content: "",
      audioUrl: URL.createObjectURL(blob),
      isVoice: true,
    };
    setMessages((prev) => [...prev, userMsg]);

    const fd = new FormData();
    fd.append("audio", blob, "voice-message.webm");
    if (activeConversationId) fd.append("conversationId", activeConversationId);

    await sendToServer({ body: fd, isVoice: true });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const showSidebar = showHistory && !compact && conversations.length > 0;

  return (
    <div className="relative flex h-full overflow-hidden bg-[var(--color-background)]">
      {/* History drawer backdrop — only ever visible below lg, where the drawer
          floats over the thread instead of sitting beside it. */}
      {showSidebar && historyOpen && (
        <div
          className="absolute inset-0 z-20 bg-background/60 lg:hidden"
          onClick={() => setHistoryOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Conversation history sidebar */}
      {showSidebar && (
        <div
          className={`absolute inset-y-0 left-0 z-30 flex w-64 max-w-[80%] flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:max-w-none lg:translate-x-0 ${
            historyOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center gap-2 p-4 border-b border-[var(--color-border)]">
            <button
              onClick={() => {
                startNewConversation();
                setHistoryOpen(false);
              }}
              className="flex-1 min-w-0 flex items-center justify-center space-x-2 py-2 px-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-brand-gold)] text-sm text-muted hover:text-[var(--color-brand-gold)] transition-colors"
            >
              <Plus size={16} />
              <span className="truncate">{strings.chatNewConversation}</span>
            </button>
            <button
              onClick={() => setHistoryOpen(false)}
              aria-label={strings.chatCloseConversationsAria}
              className="lg:hidden shrink-0 p-1.5 rounded-lg text-muted hover:text-fg hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setActiveConversation(c.id);
                  setHistoryOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors truncate ${
                  activeConversationId === c.id
                    ? "bg-[var(--color-brand-purple-dark)] text-fg"
                    : "text-muted hover:text-fg hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                {c.title || strings.chatUntitledConversation}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className={`flex items-center space-x-3 border-b border-[var(--color-border)] ${compact ? "px-4 py-3" : "px-4 py-4 sm:px-6"}`}>
          {showSidebar && (
            <button
              onClick={() => setHistoryOpen(true)}
              aria-label={strings.chatShowConversationsAria}
              className="lg:hidden shrink-0 -ml-1 p-1.5 rounded-lg text-muted hover:text-[var(--color-brand-gold)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              <PanelLeft size={18} />
            </button>
          )}
          <div className="w-9 h-9 rounded-full bg-[var(--color-brand-purple-dark)] border-2 border-[var(--color-brand-gold)] flex-shrink-0 overflow-hidden">
            <div className="w-full h-full bg-gradient-to-t from-[var(--color-brand-purple-dark)] to-[var(--color-brand-purple)]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-fg">Aminata</h2>
            <p className="text-[10px] text-muted truncate">{strings.chatCompanionRole}</p>
          </div>
          {compact && (
            <button
              onClick={startNewConversation}
              className="ml-auto p-1.5 rounded-lg hover:bg-[var(--color-surface-hover)] text-muted hover:text-[var(--color-brand-gold)] transition-colors"
              title={strings.chatUntitledConversation}
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[var(--color-brand-purple-dark)] border-2 border-[var(--color-brand-gold)] overflow-hidden">
                <div className="w-full h-full bg-gradient-to-t from-[var(--color-brand-purple-dark)] to-[var(--color-brand-purple)]" />
              </div>
              <div>
                <h3 className="text-lg font-serif text-fg mb-2">{strings.chatEmptyGreeting}</h3>
                <p className="text-sm text-muted max-w-md leading-relaxed">{strings.chatEmptyIntro}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-md">
                {[
                  strings.chatSuggestion1,
                  strings.chatSuggestion2,
                  strings.chatSuggestion3,
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="px-3 py-1.5 rounded-full border border-[var(--color-border)] text-xs text-muted hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold)] transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`flex items-start space-x-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-[var(--color-brand-purple-dark)] border border-[var(--color-brand-gold)] flex-shrink-0 overflow-hidden mt-0.5">
                    <div className="w-full h-full bg-gradient-to-t from-[var(--color-brand-purple-dark)] to-[var(--color-brand-purple)]" />
                  </div>
                )}
                <div
                  className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[var(--color-brand-purple-dark)] text-fg rounded-br-md"
                      : "bg-[var(--color-surface)] text-fg border border-[var(--color-border)] rounded-bl-md"
                  }`}
                >
                  {msg.isVoice && msg.audioUrl ? (
                    // Voice message — audio player only, no transcript shown.
                    <AudioPlayer src={msg.audioUrl} />
                  ) : msg.role === "assistant" && msg.isVoice && !msg.audioUrl ? (
                    // Voice reply still being generated / synthesized.
                    <span className="inline-flex space-x-1 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-gold)] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-gold)] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-gold)] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  ) : (
                    <>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      {msg.role === "assistant" && isStreaming && msg.content === "" && (
                        <span className="inline-flex space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-gold)] animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-gold)] animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-gold)] animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                      )}
                      {msg.role === "assistant" && msg.content !== "" && (
                        <button
                          onClick={() => playReply(msg)}
                          title={speakingId === msg.id ? strings.chatStopListening : strings.chatListen}
                          className="mt-2 flex items-center gap-1 text-[10px] text-faint hover:text-[var(--color-brand-gold)] transition-colors"
                        >
                          {loadingSpeechId === msg.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Volume2 size={12} className={speakingId === msg.id ? "text-[var(--color-brand-gold)]" : ""} />
                          )}
                          <span>{speakingId === msg.id ? strings.chatStopListening : strings.chatListen}</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="border-t border-[var(--color-border)] p-4">
          {recordedBlob && recordedUrl ? (
            // Recorded-clip preview: play it back, then discard or publish it.
            <div className="flex items-center space-x-3">
              <button
                onClick={discardRecording}
                disabled={isStreaming}
                title={strings.chatDiscardRecordingTitle}
                className="flex-shrink-0 w-10 h-10 rounded-xl border border-[var(--color-border)] text-muted flex items-center justify-center hover:border-danger hover:text-danger transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={18} />
              </button>
              <div className="flex-1 flex justify-center">
                <AudioPlayer src={recordedUrl} />
              </div>
              <button
                onClick={publishRecording}
                disabled={isStreaming}
                title={strings.chatSendVoiceTitle}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--color-brand-gold)] text-on-gold flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
              >
                {isStreaming ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex-1 min-w-0 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={recording ? strings.chatRecordingPlaceholder : strings.chatMessagePlaceholder}
                  rows={1}
                  disabled={recording}
                  className="w-full resize-none rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-fg placeholder-faint focus:outline-none focus:border-[var(--color-brand-gold)] transition-colors disabled:opacity-60"
                  style={{ maxHeight: "120px" }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = "auto";
                    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                  }}
                />
              </div>
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={isStreaming && !recording}
                title={recording ? strings.chatStopRecordingTitle : strings.chatRecordVoiceTitle}
                className={`flex-shrink-0 w-10 h-10 rounded-xl border flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  recording
                    ? "bg-danger/20 border-danger text-danger"
                    : "border-[var(--color-border)] text-muted hover:border-[var(--color-brand-gold)] hover:text-[var(--color-brand-gold)]"
                }`}
              >
                {recording ? (
                  <Square size={16} />
                ) : isStreaming ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Mic size={18} />
                )}
              </button>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isStreaming}
                className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--color-brand-gold)] text-on-gold flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
              >
                {isStreaming ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          )}
          {recording && (
            <p className="text-[10px] text-danger mt-2 text-center animate-pulse">● {strings.chatRecordingBanner}</p>
          )}
          {voiceError && <p className="text-[10px] text-danger mt-2 text-center">{voiceError}</p>}
          <p className="text-[10px] text-faint mt-2 text-center">{strings.chatDisclaimer}</p>
        </div>
      </div>
    </div>
  );
}
