"use client";

import { useState, type FormEvent } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      if (!response.ok) {
        const body = await response.json() as { error?: string };
        setError(body.error ?? "No se pudo iniciar sesión");
      } else window.location.assign("/");
    } catch { setError("No se pudo conectar con el servidor"); }
    finally { setBusy(false); }
  }

  return <form className="login-form" onSubmit={submit}>
    <label>Correo electrónico<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="tu.correo@montessori.edu.gt" /></label>
    <label>Contraseña<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" /></label>
    {error && <p className="login-error" role="alert">{error}</p>}
    <button type="submit" disabled={busy}>{busy ? "Ingresando..." : "Ingresar a inscripciones"}</button>
  </form>;
}
