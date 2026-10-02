import { NextResponse } from "next/server";
import { admissionsApiBase } from "@/lib/admissions/repository";

export async function POST(request: Request) {
  const base = admissionsApiBase();
  if (!base) return NextResponse.json({ error: "API no configurada" }, { status: 503 });
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  if (!body?.email || !body?.password) return NextResponse.json({ error: "Ingresa correo y contraseña" }, { status: 400 });
  try {
    const response = await fetch(`${base}/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email, password: body.password }), cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Credenciales incorrectas" }, { status: 401 });
    const session = await response.json() as { token: string; expiresAt: string };
    const result = NextResponse.json({ ok: true });
    result.cookies.set("admissions_token", session.token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
      path: "/", expires: new Date(session.expiresAt),
    });
    return result;
  } catch {
    return NextResponse.json({ error: "No se pudo conectar con el backend" }, { status: 503 });
  }
}

export async function DELETE() {
  const result = NextResponse.json({ ok: true });
  result.cookies.set("admissions_token", "", { path: "/", maxAge: 0 });
  return result;
}
