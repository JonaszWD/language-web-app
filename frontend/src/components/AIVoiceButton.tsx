"use client";

/**
 * Animated hands-free mic control (spinner + level bars + elapsed timer).
 * Adapted from @kokonutui's AI Voice component — purely presentational here:
 * `active`/`onToggle` are driven by the caller's real SpeechRecognition state
 * (see useSpeechInput in FreeChat.tsx), not managed internally, and the
 * original's self-looping demo animation has been dropped.
 */

import { Mic } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Pseudo-random but deterministic bar heights (20-100%), so server and client
// markup match and render stays pure.
const BAR_HEIGHTS = Array.from({ length: 48 }, (_, i) => 20 + Math.abs(Math.sin(i * 12.9898) * 43758.5453 % 1) * 80);

export default function AIVoiceButton({
  active,
  onToggle,
  activeLabel = "Listening… pause when you're done",
  idleLabel = "Tap to talk",
}: {
  active: boolean;
  onToggle: () => void;
  activeLabel?: string;
  idleLabel?: string;
}) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTime((t) => t + 1), 1000);
    return () => { clearInterval(id); setTime(0); };
  }, [active]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        className={cn(
          "group flex h-[120px] w-[120px] items-center justify-center rounded-2xl border-2 border-black dark:border-white transition-colors",
          active ? "bg-none" : "bg-none hover:bg-black/5 dark:hover:bg-white/5"
        )}
        onClick={onToggle}
        aria-label={active ? "Stop hands-free chat" : "Start hands-free chat"}
        title={active ? "Stop — mic stays hands-free until you tap this" : "Speak — pause to auto-send, no need to tap Send"}
      >
        {active ? (
          <div
            className="pointer-events-none h-[45px] w-[45px] animate-spin rounded-sm bg-black dark:bg-white"
            style={{ animationDuration: "3s" }}
          />
        ) : (
          <Mic className="h-[45px] w-[45px] text-black/90 dark:text-white/90" />
        )}
      </button>

      <span
        className={cn(
          "font-mono text-sm transition-opacity duration-300",
          active ? "text-black/70 dark:text-white/70" : "text-black/30 dark:text-white/30"
        )}
      >
        {formatTime(time)}
      </span>

      <div className="flex h-4 w-64 items-center justify-center gap-0.5">
        {[...Array(48)].map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-0.5 rounded-full transition-all duration-300",
              active ? "animate-pulse bg-black/50 dark:bg-white/50" : "h-1 bg-black/10 dark:bg-white/10"
            )}
            style={
              active
                ? { height: `${BAR_HEIGHTS[i]}%`, animationDelay: `${i * 0.05}s` }
                : undefined
            }
          />
        ))}
      </div>

      <p className="h-4 text-black/70 text-xs dark:text-white/70">
        {active ? activeLabel : idleLabel}
      </p>
    </div>
  );
}
