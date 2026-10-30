"use client";

import { cn } from "@/lib/utils";
import type { ConnectionStatus } from "@/types/realtime";

const COPY: Record<ConnectionStatus, { label: string; dot: string; text: string }> = {
  IDLE: { label: "Connecting…", dot: "bg-ink-400", text: "text-ink-400" },
  CONNECTING: { label: "Connecting…", dot: "bg-solar-500", text: "text-solar-500" },
  CONNECTED: { label: "Connected", dot: "bg-lime-500", text: "text-lime-500" },
  RECONNECTING: { label: "Reconnecting…", dot: "bg-solar-500", text: "text-solar-500" },
  CLOSED: { label: "Disconnected", dot: "bg-pulse-500", text: "text-pulse-500" },
};

export function ConnectionBadge({
  status,
  className,
}: {
  status: ConnectionStatus;
  className?: string;
}) {
  const copy = COPY[status];
  const live = status === "CONNECTED";

  return (
    <span
      className={cn("inline-flex items-center gap-2 text-xs font-medium", copy.text, className)}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex size-2">
        {!live ? (
          <span className={cn("absolute inline-flex size-2 rounded-full opacity-75 animate-ping", copy.dot)} />
        ) : null}
        <span className={cn("relative inline-flex size-2 rounded-full", copy.dot)} />
      </span>
      {copy.label}
    </span>
  );
}
