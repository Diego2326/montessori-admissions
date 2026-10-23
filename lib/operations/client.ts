import { demoOperation, demoSave } from "./demo";

export async function operation<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (process.env.NEXT_PUBLIC_ADMISSIONS_DEMO_MODE === "true") {
    const method = (options.method ?? "GET").toUpperCase();
    if (method !== "GET") {
      const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
      return demoSave<T>(path, body, method as "POST" | "PUT");
    }
    return demoOperation<T>(path);
  }
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
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function save<T>(path: string, body: unknown, method: "POST" | "PUT" | "PATCH" = "POST") {
  return operation<T>(path, { method, body: JSON.stringify(body) });
}
