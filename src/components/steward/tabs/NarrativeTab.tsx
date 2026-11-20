"use client";

import { Mic, MessageSquareText, Volume2 } from "lucide-react";
import type { NarrativeItem } from "../types";

/** Narrative tab: the participant's own words — typed text + voice transcripts. */
export function NarrativeTab({ narratives }: { narratives: NarrativeItem[] }) {
  if (narratives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20">
        <MessageSquareText className="w-7 h-7 text-faint mb-2" />
        <p className="text-sm text-secondary">No narrative was captured</p>
        <p className="text-[11px] text-faint mt-1">This contributor didn’t add written or spoken reflections.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-faint uppercase tracking-wider">
        Raw narrative — preserved verbatim, not editable
      </p>
      {narratives.map((n) => (
        <div
          key={n.promptId}
          className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-4"
        >
          <div className="flex items-start justify-between mb-2 gap-3">
            <p className="text-sm text-[var(--color-brand-gold)]">
              {n.promptText || n.promptId}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              {n.hasAudio && (
                <span className="flex items-center gap-1 text-[10px] text-[var(--color-brand-purple-light)] border border-[var(--color-border)] px-2 py-0.5 rounded-full">
                  <Mic size={11} /> Audio
                </span>
              )}
              {n.language && (
                <span className="text-[10px] text-muted border border-[var(--color-border)] px-2 py-0.5 rounded-full uppercase">
                  {n.language}
                </span>
              )}
            </div>
          </div>

          {n.text ? (
            <p className="text-sm text-secondary leading-relaxed whitespace-pre-line">{n.text}</p>
          ) : (
            <p className="text-xs text-faint italic">No written response.</p>
          )}

          {n.audioUrl && (
            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-[10px] text-faint uppercase tracking-wider mb-1.5">
                <Volume2 size={12} /> Voice recording
              </p>
              <audio controls preload="none" src={n.audioUrl} className="w-full h-9">
                Your browser does not support audio playback.
              </audio>
            </div>
          )}

          {n.transcription && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
              <p className="flex items-center gap-1.5 text-[10px] text-faint uppercase tracking-wider mb-1">
                <Volume2 size={12} /> Voice transcript
              </p>
              <p className="text-sm text-secondary leading-relaxed whitespace-pre-line">{n.transcription}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
