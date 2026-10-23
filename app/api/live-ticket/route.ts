import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { admissionsApiBase } from "@/lib/admissions/repository";

export async function GET() {
  const token = (await cookies()).get("admissions_token")?.value;
  if (!token) return NextResponse.json({ error: "Sesión vencida" }, { status: 401 });
  const base = admissionsApiBase();
  if (!base) return NextResponse.json({ error: "API no configurada" }, { status: 503 });
  try {
    const response = await fetch(`${base}/admission-stations/socket-ticket`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!response.ok) return NextResponse.json({ error: "Sin acceso a actualizaciones" }, { status: response.status });
    const data = await response.json() as { ticket: string };
    const socketUrl = new URL(base);
    socketUrl.protocol = socketUrl.protocol === "https:" ? "wss:" : "ws:";
    socketUrl.pathname = "/ws/admission-stations";
    socketUrl.search = new URLSearchParams({ ticket: data.ticket }).toString();
    return NextResponse.json({ url: socketUrl.toString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Sin conexión" }, { status: 503 });
  }
}
