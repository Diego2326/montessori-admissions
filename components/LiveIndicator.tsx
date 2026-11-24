"use client";
import { useLiveUpdates } from "./LiveUpdatesProvider";
export function LiveIndicator() {
  const { connected } = useLiveUpdates();
  return (
    <span
      className={`live-indicator ${connected ? "online" : ""}`}
      role="status"
      aria-label={connected ? "Conexión en tiempo real activa" : "Conectando en tiempo real"}
    >
      <i />
    </span>
  );
}
