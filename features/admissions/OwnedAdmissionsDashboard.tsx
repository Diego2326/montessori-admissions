"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { useLiveUpdates } from "@/components/LiveUpdatesProvider";
import { operation } from "@/lib/operations/client";
import type { Bootstrap } from "@/lib/operations/types";
import "./owned-admissions-dashboard.css";

type Enrollment = {
  id: string;
  familyId: string | null;
  familyName: string | null;
  studentUuid: string;
  contractNumber: string | null;
  firstName: string;
  lastName: string;
  schoolYear: number;
  gradeId: number;
  birthDate: string | null;
  status: string;
  signedAt: string | null;
  feePaidAt: string | null;
};

type Filter = "all" | "attention" | "active";

export function OwnedAdmissionsDashboard() {
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { version, area } = useLiveUpdates();

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [catalog, all] = await Promise.all([
        operation<Bootstrap>("enrollments/bootstrap"),
        (async () => {
          const result: Enrollment[] = [];
          for (let offset = 0; ; offset += 100) {
            const page = await operation<Enrollment[]>(`v2/enrollments?schoolYear=2027&limit=100&offset=${offset}`);
            result.push(...page);
            if (page.length < 100) break;
          }
          return result;
        })(),
      ]);
      setBootstrap(catalog);
      setRows(all);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las inscripciones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    if (!version || (area && !["ENROLLMENTS", "FINANCE"].includes(area))) return;
    void reload();
  }, [version, area, reload]);

  const visible = useMemo(() => rows.filter((row) => {
    const haystack = `${row.firstName} ${row.lastName} ${row.familyName ?? ""}`.toLocaleLowerCase("es");
    if (!haystack.includes(search.toLocaleLowerCase("es"))) return false;
    if (filter === "active") return row.status === "ACTIVO";
    if (filter === "attention") return row.status !== "ACTIVO" || !row.contractNumber;
    return true;
  }), [rows, search, filter]);
  const active = rows.filter((row) => row.status === "ACTIVO").length;
  const needsSignature = rows.filter((row) => !row.signedAt).length;
  const needsPayment = rows.filter((row) => !row.feePaidAt).length;
  const gradeNames = new Map(bootstrap?.gradeLevels.map((grade) => [grade.id, grade.name]) ?? []);

  return <WorkspaceShell current="Inscripciones">
    <div className="owned-dashboard">
      <section className="owned-dashboard-hero">
        <div>
          <span className="eyebrow">MOSTRADOR · CICLO 2027</span>
          <h1>Inscripciones</h1>
          <p>Busca el expediente y continúa con contrato, firma o compra de materiales, alumno por alumno.</p>
        </div>
        <div className="owned-dashboard-hero-actions"><Link className="button" href="/inscripciones/familias">Administrar familias importadas</Link><Link className="button button-primary" href="/inscripciones/nueva">Nueva inscripción</Link></div>
      </section>

      <section className="owned-dashboard-stats" aria-label="Resumen de inscripciones">
        <article><span>Total de alumnos</span><strong>{rows.length}</strong></article>
        <article><span>Activos</span><strong>{active}</strong></article>
        <article><span>Contratos por firmar</span><strong>{needsSignature}</strong></article>
        <article><span>Pagos pendientes</span><strong>{needsPayment}</strong></article>
      </section>

      <section className="owned-dashboard-list">
        <div className="owned-dashboard-tools">
          <div>
            <span className="eyebrow">EXPEDIENTES</span>
            <h2>Alumnos inscritos</h2>
          </div>
          <input aria-label="Buscar alumno o familia" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar alumno o familia" />
        </div>
        <div className="owned-dashboard-tabs" role="tablist" aria-label="Filtrar expedientes">
          {([ ["all", "Todos"], ["attention", "Pendientes"], ["active", "Activos"] ] as const).map(([value, label]) =>
            <button type="button" role="tab" aria-selected={filter === value} key={value} onClick={() => setFilter(value)}>{label}</button>
          )}
        </div>
        {error && <p className="alert-error" role="alert">{error}</p>}
        {loading && rows.length === 0 && <p className="owned-dashboard-empty">Cargando expedientes…</p>}
        {!loading && visible.length === 0 && <p className="owned-dashboard-empty">No hay alumnos para mostrar con estos filtros.</p>}
        <div className="owned-enrollment-list">
          {visible.map((row) => {
            const detail = `/inscripciones/nueva?enrollmentId=${encodeURIComponent(row.id)}`;
            const stationEnabled = row.status === "ACTIVO";
            return <article className="owned-enrollment-row" key={row.id}>
              <div className="owned-enrollment-main">
                <div>
                  <h3>{row.firstName} {row.lastName}</h3>
                  <p>{row.familyName || "Familia sin nombre"} · {gradeNames.get(row.gradeId) ?? `Grado ${row.gradeId}`} · {row.schoolYear}</p>
                </div>
                <span className={`owned-status ${row.status === "ACTIVO" ? "is-active" : "is-pending"}`}>{row.status.replaceAll("_", " ")}</span>
              </div>
              <div className="owned-enrollment-actions">
                <Link className="button" href={detail}>{row.contractNumber ? "Editar datos" : "Completar datos y contrato"}</Link>
                {row.contractNumber && <a className="button" href={`/api/operations/v2/enrollments/${row.id}/contract.pdf`} target="_blank" rel="noreferrer">Imprimir contrato</a>}
                {!row.signedAt && row.contractNumber && <Link className="button button-primary" href={`${detail}&action=sign`}>Marcar firmado</Link>}
                {stationEnabled ? <>
                  <Link className="button" href={`/libros?studentUuid=${encodeURIComponent(row.studentUuid)}`}>Ticket de libros</Link>
                  <Link className="button" href={`/uniformes?studentUuid=${encodeURIComponent(row.studentUuid)}`}>Ticket de uniformes</Link>
                </> : <span className="owned-actions-hint">Libros y uniformes disponibles al completar firma y pago.</span>}
              </div>
            </article>;
          })}
        </div>
      </section>
    </div>
  </WorkspaceShell>;
}
