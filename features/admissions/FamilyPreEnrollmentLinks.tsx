"use client";

import { useCallback, useEffect, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { operation, save } from "@/lib/operations/client";
import type { CreatedPreEnrollmentLink, PreEnrollmentLink } from "@/lib/operations/types";

const recipientLabels: Record<string, string> = { MOTHER: "Madre", FATHER: "Padre", OTHER: "Representante", FAMILY: "Familia" };
const statusLabels: Record<string, string> = { ACTIVE: "Disponible", OPENED: "Abierto", ANSWERED: "Respondido", RESPONDED: "Respondido", EXPIRED: "Vencido", REVOKED: "Revocado" };

function dateLabel(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-GT", { dateStyle: "medium", timeStyle: "short" });
}

export function FamilyPreEnrollmentLinks({ familyId, onError }: { familyId: number; onError: (message: string) => void }) {
  const [links, setLinks] = useState<PreEnrollmentLink[]>([]);
  const [recipientType, setRecipientType] = useState("FAMILY");
  const [created, setCreated] = useState<CreatedPreEnrollmentLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setLinks(await operation<PreEnrollmentLink[]>(`admission-workflow/families/${familyId}/pre-enrollment-links`));
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "No se pudieron cargar los enlaces de preinscripción.");
    } finally { setLoading(false); }
  }, [familyId, onError]);

  useEffect(() => { void reload(); }, [reload]);

  async function createLink() {
    setBusy(true); setMessage(""); setCreated(null);
    try {
      const link = await save<CreatedPreEnrollmentLink>("admission-workflow/pre-enrollment-links", { familyId, recipientType });
      setCreated(link);
      await reload();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "No se pudo crear el enlace."); }
    finally { setBusy(false); }
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Enlace copiado. Ya puedes compartirlo con la familia.");
    } catch { setMessage("No se pudo copiar automáticamente. Selecciona y copia el enlace manualmente."); }
  }

  async function revoke(linkId: number) {
    setBusy(true); setMessage("");
    try {
      await save(`admission-workflow/pre-enrollment-links/${linkId}/revoke`, {});
      if (created?.id === linkId) setCreated(null);
      await reload();
    } catch (cause) { onError(cause instanceof Error ? cause.message : "No se pudo revocar el enlace."); }
    finally { setBusy(false); }
  }

  return <section className="family-panel pre-enrollment-link-panel">
    <div className="section-row"><div><span className="eyebrow">CAPTURA DESDE CASA</span><h3>Enlace de preinscripción familiar</h3><p>Genera un enlace para que la familia revise sus datos y seleccione qué alumnos continuarán el proceso.</p></div><span className="stat-icon blue"><AppIcon name="link" /></span></div>
    <div className="link-create-row">
      <label className="field-label">¿A quién se enviará?
        <select value={recipientType} onChange={(event) => setRecipientType(event.target.value)}>
          <option value="FAMILY">A la familia</option><option value="MOTHER">A la madre</option><option value="FATHER">Al padre</option><option value="OTHER">Al representante</option>
        </select>
      </label>
      <button className="button button-primary" type="button" disabled={busy} onClick={() => void createLink()}><AppIcon name="plus" size={18} />{busy ? "Generando…" : "Generar enlace"}</button>
    </div>
    <p className="muted link-note">El enlace vence en 7 días. Esta acción lo genera para que el personal lo comparta; no envía correo automáticamente.</p>
    {created && <div className="created-link"><label className="field-label">Enlace generado<input readOnly value={created.url} onFocus={(event) => event.currentTarget.select()} /></label><button className="button button-soft" type="button" onClick={() => void copyLink(created.url)}><AppIcon name="copy" size={17} />Copiar enlace</button></div>}
    {message && <p className="link-message" role="status">{message}</p>}
    <div className="family-links-list">
      <h4>Historial de enlaces</h4>
      {loading ? <p className="muted">Cargando enlaces…</p> : links.length === 0 ? <p className="muted">Todavía no se ha creado un enlace para esta familia.</p> : links.map((link) => <article className="family-link-row" key={link.id}>
        <div><strong>{recipientLabels[link.recipientType] || link.recipientType}{link.recipientName ? ` · ${link.recipientName}` : ""}</strong><small>Creado {dateLabel(link.createdAt)} · vence {dateLabel(link.expiresAt)}</small><small>{link.responseSubmittedAt ? `Respondido ${dateLabel(link.responseSubmittedAt)}${link.wantsEnroll === false ? " · No continuará" : " · Continuará"}` : link.lastAccessAt ? `Abierto ${dateLabel(link.lastAccessAt)}` : "Aún no abierto"}</small></div>
        <span className={`status-pill ${link.status === "ANSWERED" && link.wantsEnroll ? "success" : link.status === "ACTIVE" || link.status === "OPENED" ? "waiting" : "muted-pill"}`}>{statusLabels[link.status] || link.status}</span>
        {link.status !== "REVOKED" && link.status !== "EXPIRED" && !link.responseSubmittedAt && <button className="text-button" type="button" disabled={busy} onClick={() => void revoke(link.id)}>Revocar</button>}
      </article>)}
    </div>
  </section>;
}
