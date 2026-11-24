import { demoOperation, demoSave } from "./demo";

const READ_CACHE_MS = 8_000;
const readCache = new Map<string, { expiresAt: number; request: Promise<unknown> }>();

export function invalidateOperationCache() {
  readCache.clear();
}

export async function operation<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (method !== "GET") invalidateOperationCache();
  if (process.env.NEXT_PUBLIC_ADMISSIONS_DEMO_MODE === "true") {
    if (method !== "GET") {
      const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
      return demoSave<T>(path, body, method as "POST" | "PUT");
    }
    return demoOperation<T>(path);
  }
  if (method === "GET") {
    const cached = readCache.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.request as Promise<T>;
  }
  const request = (async () => {
    const response = await fetch(`/api/operations/${path.replace(/^\//, "")}`, {
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
      cache: "no-store",
    });
    if (response.status === 401) {
      window.location.assign("/login");
      throw new Error("Sesión vencida");
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
      throw new Error(body?.error || body?.message || (response.status === 403 ? "Sin permiso para esta estación" : `Error ${response.status}`));
    }
    if (response.status === 204) return undefined;
    return response.json();
  })();
  if (method === "GET") {
    readCache.set(path, { expiresAt: Date.now() + READ_CACHE_MS, request });
    void request.catch(() => { if (readCache.get(path)?.request === request) readCache.delete(path); });
  }
  return request as Promise<T>;
}

export function save<T>(path: string, body: unknown, method: "POST" | "PUT" | "PATCH" = "POST") {
  return operation<T>(path, { method, body: JSON.stringify(body) });
}
