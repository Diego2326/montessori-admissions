"use client";
import { useLiveUpdates } from "./LiveUpdatesProvider";
export function LiveIndicator() {
  const { connected } = useLiveUpdates();
  return (
    <span className={`live-indicator ${connected ? "online" : ""}`}>
      <i />
      {connected ? "Sincronizado" : "Sincronizando"}
    </span>
  );
}
