import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { admissionsApiBase } from "@/lib/admissions/repository";

const allowedRoots = new Set(["enrollments", "school-years", "students", "admission-workflow", "admission-stations", "finance", "admissions", "admission-checkout"]);

async function forward(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const token = (await cookies()).get("admissions_token")?.value;
  if (!token) return NextResponse.json({ error: "Sesión vencida" }, { status: 401 });
  const { path } = await context.params;
  if (!path.length || !allowedRoots.has(path[0])) return NextResponse.json({ error: "Ruta no disponible" }, { status: 404 });
  const base = admissionsApiBase();
  if (!base) return NextResponse.json({ error: "API no configurada" }, { status: 503 });
  const url = `${base}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  try {
    const response = await fetch(url, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(request.method !== "GET" && request.method !== "HEAD" ? { "Content-Type": request.headers.get("content-type") || "application/json" } : {}),
      },
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      cache: "no-store",
    });
    return new NextResponse(response.body, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") || "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con la API" }, { status: 503 });
  }
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
