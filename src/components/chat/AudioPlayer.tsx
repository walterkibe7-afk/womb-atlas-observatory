"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2, AlertCircle } from "lucide-react";
import { useUiStrings } from "@/lib/observation/ui-strings-context";

// Static waveform bar heights (px) — decorative, gives the pill its shape.
const BAR_HEIGHTS = [
  7, 12, 18, 10, 15, 22, 9, 14, 20, 12, 8, 17, 24, 11, 16, 10, 19, 13, 7, 16,
  21, 11, 15, 18, 9, 13, 20, 12, 8, 14,
];

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Compact voice-note player (play/pause · waveform · time). Used for both the
 * composer preview of a just-recorded clip and for sent/received voice
 * messages in the transcript. Shows a spinner in place of the play button
 * until the browser has actually loaded the clip's metadata — `src` for a
 * sent/received message points at the authenticated /api/chat/audio route
 * (GCS-backed), so the first play can take a moment. Also handles the
 * WebM/MediaRecorder quirk where `duration` reads `Infinity` until the
 * browser is nudged to compute it.
 */
export function AudioPlayer({ src }: { src: string }) {
  const strings = useUiStrings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    setReady(false);
    setFailed(false);
    setPlaying(false);
    setCurrent(0);
    setDuration(0);

    let fixingDuration = false;

    const onLoaded = () => {
      if (audio.duration === Infinity || Number.isNaN(audio.duration)) {
        // Force the browser to resolve the real duration for WebM blobs.
        fixingDuration = true;
        audio.currentTime = 1e101;
      } else {
        setDuration(audio.duration);
        setReady(true);
      }
    };
    const onTimeUpdate = () => {
      if (fixingDuration) {
        fixingDuration = false;
        setDuration(audio.duration);
        audio.currentTime = 0;
        setReady(true);
        return;
      }
      setCurrent(audio.currentTime);
    };
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
      audio.currentTime = 0;
    };
    const onError = () => setFailed(true);

    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio || !ready) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play();
      setPlaying(true);
    }
  };

  const fraction = duration > 0 ? current / duration : 0;
  const timeLabel = !ready ? "" : playing || current > 0 ? fmt(current) : fmt(duration);

  return (
    <div className="flex items-center gap-2 rounded-full bg-background/25 border border-participant-sand/10 px-3 py-2 min-w-[190px] max-w-[240px]">
      <button
        type="button"
        onClick={toggle}
        disabled={!ready || failed}
        title={failed ? strings.audioCouldNotLoad : ready ? (playing ? strings.audioPause : strings.audioPlay) : strings.audioLoading}
        className="flex-shrink-0 w-7 h-7 rounded-full bg-participant-sand text-on-gold flex items-center justify-center hover:bg-participant-sand/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {failed ? (
          <AlertCircle size={13} className="text-danger" />
        ) : !ready ? (
          <Loader2 size={13} className="animate-spin" />
        ) : playing ? (
          <Pause size={13} />
        ) : (
          <Play size={13} className="translate-x-[1px]" />
        )}
      </button>
      <span
        className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${
          failed ? "bg-danger" : ready ? "bg-[var(--color-brand-green)]" : "bg-faint animate-pulse"
        }`}
      />
      <div className="flex items-center gap-[2px] flex-1 h-6 overflow-hidden">
        {BAR_HEIGHTS.map((h, i) => {
          const active = ready && i / BAR_HEIGHTS.length <= fraction;
          return (
            <span
              key={i}
              style={{ height: `${h}px` }}
              className={`w-[2px] rounded-full transition-colors ${
                active ? "bg-[var(--color-brand-gold)]" : "bg-participant-sand/30"
              }`}
            />
          );
        })}
      </div>
      <span className="flex-shrink-0 text-[10px] tabular-nums text-muted min-w-[26px] text-right">
        {failed ? "—" : timeLabel}
      </span>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  );
}
