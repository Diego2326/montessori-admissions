"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type LiveState = { version: number; area: string | null; connected: boolean };
const LiveContext = createContext<LiveState>({ version: 0, area: null, connected: false });

export function LiveUpdatesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveState>({ version: 0, area: null, connected: false });

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;
    let retry = 1000;
    const fallback = setInterval(() => { if (active) setState((old) => ({ ...old, version: old.version + 1, area: null })); }, 45000);
    async function connect() {
      try {
        const response = await fetch("/api/live-ticket", { cache: "no-store" });
        if (!active) return;
        if (!response.ok) { if (response.status >= 500) reconnect = setTimeout(connect, retry); return; }
        const { url } = await response.json() as { url: string };
        socket = new WebSocket(url);
        socket.onopen = () => { retry = 1000; if (active) setState((old) => ({ ...old, connected: true })); };
        socket.onmessage = (message) => {
          try {
            const event = JSON.parse(message.data) as { area: string };
            if (active && event.area) setState((old) => ({ version: old.version + 1, area: event.area, connected: true }));
          } catch { /* ignore unknown event */ }
        };
        socket.onclose = () => {
          if (!active) return;
          setState((old) => ({ ...old, connected: false }));
          reconnect = setTimeout(connect, retry);
          retry = Math.min(retry * 2, 30000);
        };
      } catch {
        if (active) reconnect = setTimeout(connect, retry);
      }
    }
    void connect();
    return () => { active = false; clearInterval(fallback); if (reconnect) clearTimeout(reconnect); socket?.close(); };
  }, []);

  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
}

export function useLiveUpdates() { return useContext(LiveContext); }
