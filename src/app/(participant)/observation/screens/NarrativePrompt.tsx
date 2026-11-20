"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Loader2, AudioLines } from "lucide-react";
import type { NarrativePrompt as Prompt, NarrativeAnswer } from "@/lib/observation/types";
import { useUiStrings } from "@/lib/observation/ui-strings-context";

interface Props {
  prompt: Prompt;
  value: NarrativeAnswer;
  onChange: (promptId: string, value: NarrativeAnswer) => void;
  ensureObservationId: () => Promise<string | undefined>;
  index: number;
  total: number;
}

const CANDIDATE_MIME = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return CANDIDATE_MIME.find((m) => MediaRecorder.isTypeSupported(m));
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function NarrativePromptCard({ prompt, value, onChange, ensureObservationId, index, total }: Props) {
  const ui = useUiStrings();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const playbackSrc = localUrl ?? value.audioUrl ?? null;
  const hasAudio = !!playbackSrc;

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Clean up on unmount.
    return () => {
      stopTracks();
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = useCallback(
    async (blob: Blob) => {
      setUploading(true);
      setError(null);
      try {
        const obsId = await ensureObservationId();
        if (!obsId) {
          setError(ui.narrativeAnswerFirst);
          return;
        }
        const fd = new FormData();
        fd.append("observationId", obsId);
        fd.append("promptId", prompt.promptId);
        fd.append("audio", blob, `${prompt.promptId}.webm`);
        const res = await fetch("/api/observation/narrative", { method: "POST", body: fd });
        const data = await res.json();
        if (data.audioUrl) {
          onChange(prompt.promptId, {
            ...value,
            audioUrl: data.audioUrl,
            transcription: data.transcription ?? undefined,
            language: data.language,
          });
        } else {
          setError(data.error || "Upload failed.");
        }
      } catch {
        setError(ui.narrativeUploadFailed);
      } finally {
        setUploading(false);
      }
    },
    [ensureObservationId, prompt.promptId, onChange, value, ui.narrativeAnswerFirst, ui.narrativeUploadFailed],
  );

  const handleStop = useCallback(() => {
    const type = recorderRef.current?.mimeType || "audio/webm";
    const blob = new Blob(chunksRef.current, { type });
    stopTracks();
    if (localUrl) URL.revokeObjectURL(localUrl);
    setLocalUrl(URL.createObjectURL(blob));
    void upload(blob);
  }, [stopTracks, localUrl, upload]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = handleStop;
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setError(ui.narrativeMicDenied);
    }
  }, [handleStop, ui.narrativeMicDenied]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    setRecording(false);
  }, []);

  const removeAudio = useCallback(() => {
    if (localUrl) {
      URL.revokeObjectURL(localUrl);
      setLocalUrl(null);
    }
    onChange(prompt.promptId, { ...value, audioUrl: undefined, transcription: undefined, language: undefined });
  }, [localUrl, onChange, prompt.promptId, value]);

  return (
    <div className="space-y-4 rounded-[20px] border border-[var(--color-border)] bg-surface-inset px-5 py-4 shadow-[inset_0_1px_0_rgba(216,201,181,0.08)]">
      {total > 1 && (
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-brand-gold">
          {ui.narrativePromptCounter} {index + 1} / {total}
        </p>
      )}
      <label className="block font-serif text-xl font-light leading-snug text-fg">{prompt.promptText}</label>

      <textarea
        rows={4}
        value={value.text ?? ""}
        onChange={(e) => onChange(prompt.promptId, { ...value, text: e.target.value })}
        placeholder={ui.narrativePlaceholder}
        className="w-full resize-none bg-participant-form-paper border border-participant-sand/60 rounded-[14px] p-4 text-participant-plum placeholder:text-participant-plum/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] focus:outline-none focus:border-participant-copper"
      />

      {/* Audio capture */}
      <div className="flex flex-col gap-3">
        {!recording && !hasAudio && (
          <button
            type="button"
            onClick={startRecording}
            disabled={uploading}
            className="flex w-full items-center justify-between gap-2 rounded-[14px] border border-participant-sand/60 bg-participant-form-paper px-4 py-3.5 text-sm text-participant-plum shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] hover:border-participant-copper transition-colors disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <Mic size={16} className="text-participant-copper" />
              {ui.narrativeRecord}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-participant-plum/60">{ui.narrativeTapToStart}</span>
          </button>
        )}

        {recording && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex w-full items-center justify-between gap-2 rounded-[14px] border border-danger/50 bg-danger/20 px-4 py-3.5 text-sm text-fg hover:bg-danger/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-danger animate-pulse" />
              <Square size={14} /> {ui.narrativeStopRecording}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em]">{fmt(elapsed)}</span>
          </button>
        )}

        {uploading && (
          <span className="flex items-center gap-2 text-sm text-muted">
            <Loader2 size={16} className="animate-spin" /> {ui.narrativeSavingTranscribing}
          </span>
        )}

        {hasAudio && !recording && (
          <div className="flex items-center gap-3 flex-wrap">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={playbackSrc ?? undefined} className="h-9 max-w-[14rem]" />
            <button
              type="button"
              onClick={removeAudio}
              className="flex items-center gap-1 text-xs text-muted hover:text-danger transition-colors"
            >
              <Trash2 size={14} /> {ui.narrativeRemoveAudio}
            </button>
          </div>
        )}
      </div>

      {/* Transcription / pending state */}
      {hasAudio && (
        <div className="flex items-start gap-2 text-xs bg-background border border-[var(--color-border)] rounded-[14px] p-3">
          <AudioLines size={14} className="text-[var(--color-brand-purple)] mt-0.5 shrink-0" />
          {value.transcription ? (
            <p className="text-muted">{value.transcription}</p>
          ) : (
            <p className="text-faint">
              {ui.narrativeAudioSaved}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
