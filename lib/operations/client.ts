export async function operation<T>(path: string, options: RequestInit = {}): Promise<T> {
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

export function save<T>(path: string, body: unknown, method: "POST" | "PUT" = "POST") {
  return operation<T>(path, { method, body: JSON.stringify(body) });
}
