import type { AdmissionsOverview } from "./types";

export function admissionsApiBase(): string | null {
  return (process.env.ADMISSIONS_API_URL ?? "https://notas-api-625997821641.northamerica-south1.run.app").replace(/\/$/, "");
}

export async function getAdmissionsOverview(token: string): Promise<AdmissionsOverview> {
  const base = admissionsApiBase();
  if (!base) return { connection: "not_configured", candidates: [] };
  try {
    const response = await fetch(`${base}/admission-workflow/2027/overview`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (response.status === 401) return { connection: "unauthorized", candidates: [] };
    if (response.status === 403) return { connection: "forbidden", candidates: [] };
    if (!response.ok) throw new Error("backend unavailable");
    const payload = await response.json() as { year: number; candidates: AdmissionsOverview["candidates"] };
    return { connection: "connected", candidates: payload.candidates };
  } catch {
    return { connection: "error", candidates: [], error: "No se pudo conectar con la API de admisiones." };
  }
}
