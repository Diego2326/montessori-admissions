"use client";

import { useEffect, useMemo, useState } from "react";
import { operation } from "@/lib/operations/client";

type ProgressGroup = {
  type: "NEW" | "REINSCRIPTION";
  grade: string;
  total: number;
  active: number;
  pendingSignature: number;
  pendingPayment: number;
  unenrolled: number;
};

export function EnrollmentStatsDashboard() {
  const [groups, setGroups] = useState<ProgressGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const statistics = await operation<{ groups: ProgressGroup[] }>("admission-workflow/2027/statistics");
        if (!active) return;
        setGroups(statistics.groups ?? []);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar las estadísticas.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const summary = useMemo(() => {
    const totals = groups.reduce((sum, row) => ({
      total: sum.total + row.total,
      active: sum.active + row.active,
      newTotal: sum.newTotal + (row.type === "NEW" ? row.total : 0),
      returningTotal: sum.returningTotal + (row.type === "REINSCRIPTION" ? row.total : 0),
      newActive: sum.newActive + (row.type === "NEW" ? row.active : 0),
      returningActive: sum.returningActive + (row.type === "REINSCRIPTION" ? row.active : 0),
      pendingSignature: sum.pendingSignature + row.pendingSignature,
      pendingPayment: sum.pendingPayment + row.pendingPayment,
      unenrolled: sum.unenrolled + row.unenrolled,
    }), { total: 0, active: 0, newTotal: 0, returningTotal: 0, newActive: 0, returningActive: 0, pendingSignature: 0, pendingPayment: 0, unenrolled: 0 });
    return { ...totals, completion: totals.total ? Math.round((totals.active / totals.total) * 100) : 0 };
  }, [groups]);

  const typeRows = useMemo(() => ([
    { type: "NEW" as const, label: "Nuevo ingreso" },
    { type: "REINSCRIPTION" as const, label: "Reinscripción" },
  ]).map(({ type, label }) => {
    const matching = groups.filter((row) => row.type === type);
    const total = matching.reduce((sum, row) => sum + row.total, 0);
    const active = matching.reduce((sum, row) => sum + row.active, 0);
    return {
      label,
      total,
      active,
      signature: matching.reduce((sum, row) => sum + row.pendingSignature, 0),
      payment: matching.reduce((sum, row) => sum + row.pendingPayment, 0),
      noEnrollment: matching.reduce((sum, row) => sum + row.unenrolled, 0),
      completion: total ? Math.round((active / total) * 100) : 0,
    };
  }), [groups]);

  const gradeRows = useMemo(() => {
    const map = new Map<string, { grade: string; active: number; signature: number; payment: number; noEnrollment: number; total: number }>();
    for (const row of groups) {
      const group = map.get(row.grade) ?? { grade: row.grade, active: 0, signature: 0, payment: 0, noEnrollment: 0, total: 0 };
      group.total += row.total;
      group.active += row.active;
      group.signature += row.pendingSignature;
      group.payment += row.pendingPayment;
      group.noEnrollment += row.unenrolled;
      map.set(row.grade, group);
    }
    return [...map.values()].sort((a, b) => a.grade.localeCompare(b.grade, "es"));
  }, [groups]);

  return (
    <section className="admissions-stats-dashboard">
      <div className="admissions-stats-heading">
        <div><span className="eyebrow">ADMINISTRACIÓN · CICLO 2027</span><h1>Estadísticas de inscripciones</h1><p>Resumen del avance de nuevos ingresos y reinscripciones.</p></div>
      </div>
      {error && <p className="admissions-stats-error" role="alert">{error}</p>}
      {loading ? <p className="admissions-stats-loading" role="status">Cargando estadísticas…</p> : <>
        <div className="admissions-stats-grid">
          <article><small>Alumnos en seguimiento</small><strong>{summary.total}</strong></article>
          <article><small>Avance completado</small><strong>{summary.completion}%</strong><span className="admissions-stat-progress"><i style={{ width: `${summary.completion}%` }} /></span></article>
          <article><small>Nuevo ingreso · total</small><strong>{summary.newTotal}</strong></article>
          <article><small>Reinscripción · total</small><strong>{summary.returningTotal}</strong></article>
          <article><small>Inscritos</small><strong>{summary.active}</strong></article>
          <article><small>Nuevo ingreso inscrito</small><strong>{summary.newActive}</strong></article>
          <article><small>Reinscripción inscrita</small><strong>{summary.returningActive}</strong></article>
          <article><small>Pendiente de firma</small><strong>{summary.pendingSignature}</strong></article>
          <article><small>Pendiente de pago</small><strong>{summary.pendingPayment}</strong></article>
          <article><small>Sin inscripción</small><strong>{summary.unenrolled}</strong></article>
        </div>
        <section className="admissions-stats-table-card">
          <h2>Avance por tipo de ingreso</h2>
          <div className="admissions-stats-table-scroll"><table><thead><tr><th>Tipo</th><th>Total</th><th>Inscritos</th><th>Pendiente de firma</th><th>Pendiente de pago</th><th>Sin inscripción</th><th>Avance</th></tr></thead><tbody>{typeRows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.total}</td><td>{row.active}</td><td>{row.signature}</td><td>{row.payment}</td><td>{row.noEnrollment}</td><td>{row.completion}%</td></tr>)}</tbody></table></div>
        </section>
        <section className="admissions-stats-table-card">
          <h2>Avance por grado</h2>
          {gradeRows.length ? <div className="admissions-stats-table-scroll"><table><thead><tr><th>Grado</th><th>Total</th><th>Inscritos</th><th>Pendiente de firma</th><th>Pendiente de pago</th><th>Sin inscripción</th></tr></thead><tbody>{gradeRows.map((row) => <tr key={row.grade}><th scope="row">{row.grade}</th><td>{row.total}</td><td>{row.active}</td><td>{row.signature}</td><td>{row.payment}</td><td>{row.noEnrollment}</td></tr>)}</tbody></table></div> : <p>No hay registros para mostrar.</p>}
        </section>
      </>}
    </section>
  );
}
