"use client";

import { useEffect, useMemo, useState } from "react";
import { operation } from "@/lib/operations/client";
import { downloadWorkbookSheets, type WorkbookSheet } from "@/lib/admissions/xlsx";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import type { Enrollment, PreEnrollmentSubmission, PreEnrollmentSubmissionPage } from "@/lib/operations/types";

type ProgressGroup = {
  type: "NEW" | "REINSCRIPTION";
  grade: string;
  total: number;
  active: number;
  pendingSignature: number;
  pendingPayment: number;
  unenrolled: number;
};
type PeriodEvent = { date: string; month: string; event: "Formulario recibido" | "Contrato firmado"; student: string; family: string; grade: string; detail: string };
type GradeSummary = { grade: string; total: number; active: number; signature: number; payment: number; noEnrollment: number; responses: number; signed: number };

const PAGE_SIZE = 100;
const dayValue = (value: string) => value.slice(0, 10);
const inRange = (value: string, from: string, to: string) => {
  const date = dayValue(value);
  return (!from || date >= from) && (!to || date <= to);
};
const monthName = (key: string) => new Intl.DateTimeFormat("es-GT", { month: "short", year: "2-digit" }).format(new Date(`${key}-01T12:00:00`));
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-GT", { dateStyle: "medium" }).format(date);
};
const statusLabel = (status: string) => ({ ACTIVO: "Inscrito", PENDIENTE_FIRMA: "Pendiente de firma", PENDIENTE_PAGO: "Pendiente de pago", UNENROLLED: "Sin inscripción", INACTIVO: "Inactivo", RETIRADO: "Retirado" } as Record<string, string>)[status] ?? status;
const typeLabel = (type: string) => type === "REINSCRIPTION" ? "Reinscripción" : "Nuevo ingreso";

async function loadEnrollments() {
  const rows: Enrollment[] = [];
  let offset = 0;
  while (true) {
    const batch = await operation<Enrollment[]>(`enrollments?schoolYear=2027&summary=true&limit=200&offset=${offset}`);
    rows.push(...batch);
    if (batch.length < 200) return rows;
    offset += batch.length;
  }
}

async function loadResponses() {
  const rows: PreEnrollmentSubmission[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;
  while (rows.length < total) {
    const response = await operation<PreEnrollmentSubmissionPage>(`admission-workflow/pre-enrollment-responses?page=${page}&pageSize=${PAGE_SIZE}&sort=oldest`);
    rows.push(...response.items);
    total = response.total;
    if (response.items.length === 0) break;
    page++;
  }
  return rows;
}

export function EnrollmentStatsDashboard() {
  const [groups, setGroups] = useState<ProgressGroup[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [candidates, setCandidates] = useState<AdmissionCandidate[]>([]);
  const [responses, setResponses] = useState<PreEnrollmentSubmission[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [statistics, nextEnrollments, overview, nextResponses] = await Promise.all([
          operation<{ groups: ProgressGroup[] }>("admission-workflow/2027/statistics"),
          loadEnrollments(),
          operation<{ candidates: AdmissionCandidate[] }>("admission-workflow/2027/overview"),
          loadResponses(),
        ]);
        if (!active) return;
        setGroups(statistics.groups ?? []);
        setEnrollments(nextEnrollments);
        setCandidates(overview.candidates ?? []);
        setResponses(nextResponses);
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar las estadísticas.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  const summary = useMemo(() => groups.reduce((sum, row) => ({
    total: sum.total + row.total,
    active: sum.active + row.active,
    newTotal: sum.newTotal + (row.type === "NEW" ? row.total : 0),
    returningTotal: sum.returningTotal + (row.type === "REINSCRIPTION" ? row.total : 0),
    newActive: sum.newActive + (row.type === "NEW" ? row.active : 0),
    returningActive: sum.returningActive + (row.type === "REINSCRIPTION" ? row.active : 0),
    pendingSignature: sum.pendingSignature + row.pendingSignature,
    pendingPayment: sum.pendingPayment + row.pendingPayment,
    unenrolled: sum.unenrolled + row.unenrolled,
  }), { total: 0, active: 0, newTotal: 0, returningTotal: 0, newActive: 0, returningActive: 0, pendingSignature: 0, pendingPayment: 0, unenrolled: 0 }), [groups]);

  const typeRows = useMemo(() => ([{ type: "NEW" as const, label: "Nuevo ingreso" }, { type: "REINSCRIPTION" as const, label: "Reinscripción" }]).map(({ type, label }) => {
    const matching = groups.filter((row) => row.type === type);
    const total = matching.reduce((sum, row) => sum + row.total, 0);
    const active = matching.reduce((sum, row) => sum + row.active, 0);
    return { label, total, active, signature: matching.reduce((sum, row) => sum + row.pendingSignature, 0), payment: matching.reduce((sum, row) => sum + row.pendingPayment, 0), noEnrollment: matching.reduce((sum, row) => sum + row.unenrolled, 0), completion: total ? Math.round(active / total * 100) : 0 };
  }), [groups]);

  const periodResponses = responses.filter((item) => inRange(item.submittedAt, dateFrom, dateTo));
  const periodSignatures = enrollments.filter((item) => Boolean(item.profile?.contractSignedAt) && inRange(String(item.profile?.contractSignedAt), dateFrom, dateTo));
  const candidateByStudent = useMemo(() => new Map(candidates.map((item) => [item.id, item])), [candidates]);
  const events = useMemo<PeriodEvent[]>(() => [
    ...periodResponses.map((item) => ({
      date: item.submittedAt, month: item.submittedAt.slice(0, 7), event: "Formulario recibido" as const,
      student: item.students.filter((student) => student.selected).map((student) => `${student.firstName} ${student.lastName}`.trim()).join(", ") || "Sin alumno seleccionado",
      family: item.familyName, grade: item.students.filter((student) => student.selected).map((student) => student.currentGrade || "Grado pendiente").join(", "),
      detail: item.wantsEnroll ? "Desea continuar" : "No continuará",
    })),
    ...periodSignatures.map((item) => ({
      date: String(item.profile?.contractSignedAt), month: String(item.profile?.contractSignedAt).slice(0, 7), event: "Contrato firmado" as const,
      student: `${item.studentFirstName ?? ""} ${item.studentLastName ?? ""}`.trim(), family: String(item.profile?.familyName ?? ""),
      grade: item.gradeName ?? "Grado pendiente", detail: statusLabel(item.status),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date)), [periodResponses, periodSignatures]);

  const monthly = useMemo(() => {
    const map = new Map<string, { month: string; responses: number; signatures: number }>();
    for (const event of events) {
      const row = map.get(event.month) ?? { month: event.month, responses: 0, signatures: 0 };
      if (event.event === "Formulario recibido") row.responses++;
      else row.signatures++;
      map.set(event.month, row);
    }
    return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  }, [events]);
  const maxMonthly = Math.max(1, ...monthly.map((row) => Math.max(row.responses, row.signatures)));

  const gradeRows = useMemo<GradeSummary[]>(() => {
    const map = new Map<string, GradeSummary>();
    for (const row of groups) {
      const grade = map.get(row.grade) ?? { grade: row.grade, total: 0, active: 0, signature: 0, payment: 0, noEnrollment: 0, responses: 0, signed: 0 };
      grade.total += row.total; grade.active += row.active; grade.signature += row.pendingSignature; grade.payment += row.pendingPayment; grade.noEnrollment += row.unenrolled;
      map.set(row.grade, grade);
    }
    for (const response of periodResponses) {
      const seen = new Set<string>();
      for (const student of response.students.filter((item) => item.selected)) {
        const gradeName = student.currentGrade || "Grado pendiente";
        if (seen.has(gradeName)) continue;
        seen.add(gradeName);
        const grade = map.get(gradeName) ?? { grade: gradeName, total: 0, active: 0, signature: 0, payment: 0, noEnrollment: 0, responses: 0, signed: 0 };
        grade.responses++; map.set(gradeName, grade);
      }
    }
    for (const enrollment of periodSignatures) {
      const gradeName = enrollment.gradeName || "Grado pendiente";
      const grade = map.get(gradeName) ?? { grade: gradeName, total: 0, active: 0, signature: 0, payment: 0, noEnrollment: 0, responses: 0, signed: 0 };
      grade.signed++; map.set(gradeName, grade);
    }
    return [...map.values()].sort((a, b) => a.grade.localeCompare(b.grade, "es"));
  }, [groups, periodResponses, periodSignatures]);

  const enrollmentRows = useMemo(() => enrollments.map((item) => {
    const candidate = candidateByStudent.get(item.studentId);
    return { item, candidate, type: candidate && candidate.historicalContracts > 0 ? "REINSCRIPTION" : "NEW" };
  }).sort((a, b) => `${a.item.studentLastName} ${a.item.studentFirstName}`.localeCompare(`${b.item.studentLastName} ${b.item.studentFirstName}`, "es")), [enrollments, candidateByStudent]);

  function exportWorkbook() {
    const period = `${dateFrom || "Inicio"} — ${dateTo || "Sin límite"}`;
    const signedCount = periodSignatures.length;
    const reportSheets: WorkbookSheet[] = [
      { name: "Resumen", rows: [
        ["REPORTE DE INSCRIPCIONES · CICLO 2027", "Colegio Bilingüe Montessori Zacapa"], ["Periodo de actividad", period], ["Generado", new Date().toLocaleString("es-GT")], [],
        ["Indicador", "Resultado"], ["Alumnos en seguimiento", summary.total], ["Inscritos", summary.active], ["Pendientes de firma", summary.pendingSignature],
        ["Pendientes de pago", summary.pendingPayment], ["Sin inscripción", summary.unenrolled], ["Nuevo ingreso", summary.newTotal], ["Reinscripción", summary.returningTotal],
        ["Formularios recibidos en el periodo", periodResponses.length], ["Contratos firmados en el periodo", signedCount],
      ] },
      { name: "Por grado", rows: [["Grado", "Alumnos", "Inscritos", "Pendiente firma", "Pendiente pago", "Sin inscripción", "Formularios del periodo", "Firmas del periodo"], ...gradeRows.map((row) => [row.grade, row.total, row.active, row.signature, row.payment, row.noEnrollment, row.responses, row.signed])] },
      { name: "Por tipo", rows: [["Tipo de ingreso", "Total", "Inscritos", "Pendiente firma", "Pendiente pago", "Sin inscripción", "Avance (%)"], ...typeRows.map((row) => [row.label, row.total, row.active, row.signature, row.payment, row.noEnrollment, row.completion])] },
      { name: "Inscripciones", rows: [["Alumno", "Familia", "Tipo de ingreso", "Grado 2027", "Sección", "Estado", "Contrato firmado", "Representante", "ID alumno", "ID inscripción"], ...enrollmentRows.map(({ item, candidate, type }) => [`${item.studentFirstName ?? ""} ${item.studentLastName ?? ""}`.trim(), item.profile?.familyName ?? candidate?.familyName ?? "", typeLabel(type), item.gradeName ?? "Grado pendiente", item.section ?? "", statusLabel(item.status), String(item.profile?.contractSignedAt ?? ""), candidate?.representativeName ?? item.profile?.representativeName ?? "", item.studentId, item.id])] },
      { name: "Respuestas", rows: [["Fecha y hora", "Familia", "Respondió", "Decisión", "Alumnos seleccionados", "Grados"], ...periodResponses.map((item) => [item.submittedAt, item.familyName, item.recipientName, item.wantsEnroll ? "Continuará" : "No continuará", item.students.filter((student) => student.selected).map((student) => `${student.firstName} ${student.lastName}`.trim()).join("; "), item.students.filter((student) => student.selected).map((student) => student.currentGrade ?? "Grado pendiente").join("; ")])] },
      { name: "Cronología", rows: [["Fecha", "Evento", "Alumno(s)", "Familia", "Grado", "Detalle"], ...events.map((event) => [event.date, event.event, event.student, event.family, event.grade, event.detail])] },
    ];
    downloadWorkbookSheets(`Montessori_inscripciones_2027_${new Date().toISOString().slice(0, 10)}.xlsx`, reportSheets);
  }

  return (
    <section className="admissions-stats-dashboard">
      <div className="admissions-stats-heading">
        <div><span className="eyebrow">ADMINISTRACIÓN · CICLO 2027</span><h1>Estadísticas de inscripciones</h1><p>Seguimiento de expedientes y actividad familiar, con fechas de formularios y contratos.</p></div>
        <button className="button button-primary" type="button" onClick={exportWorkbook} disabled={loading || Boolean(error)}><span aria-hidden="true">↓</span> Exportar Excel</button>
      </div>
      <div className="admissions-stats-date-filters">
        <label>Actividad desde<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label>Actividad hasta<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        {(dateFrom || dateTo) && <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); }}>Limpiar fechas</button>}
        <span>Las fechas filtran formularios recibidos y contratos firmados; los estados muestran la situación actual.</span>
      </div>
      {error && <p className="admissions-stats-error" role="alert">{error}</p>}
      {loading ? <p className="admissions-stats-loading" role="status">Cargando estadísticas y cronología…</p> : <>
        <div className="admissions-stats-grid">
          <article><small>Alumnos en seguimiento</small><strong>{summary.total}</strong></article>
          <article><small>Inscritos</small><strong>{summary.active}</strong><span className="admissions-stat-progress"><i style={{ width: `${summary.total ? summary.active / summary.total * 100 : 0}%` }} /></span></article>
          <article><small>Pendiente de firma</small><strong>{summary.pendingSignature}</strong></article>
          <article><small>Pendiente de pago</small><strong>{summary.pendingPayment}</strong></article>
          <article><small>Formularios · periodo</small><strong>{periodResponses.length}</strong></article>
          <article><small>Firmas · periodo</small><strong>{periodSignatures.length}</strong></article>
        </div>
        <section className="admissions-stats-chart-card">
          <div className="admissions-stats-card-heading"><div><h2>Actividad por mes</h2><p>Comparativo de formularios recibidos y contratos firmados en el periodo.</p></div><div className="admissions-stats-legend"><span><i className="responses"/>Formularios</span><span><i className="signatures"/>Firmas</span></div></div>
          {monthly.length ? <div className="admissions-stats-month-chart">{monthly.map((row) => <div className="admissions-stats-month" key={row.month}><div className="admissions-stats-bars" title={`${monthName(row.month)}: ${row.responses} formularios · ${row.signatures} firmas`}><i className="responses" style={{ height: `${Math.max(row.responses ? 4 : 0, row.responses / maxMonthly * 100)}%` }}/><i className="signatures" style={{ height: `${Math.max(row.signatures ? 4 : 0, row.signatures / maxMonthly * 100)}%` }}/></div><small>{monthName(row.month)}</small></div>)}</div> : <p className="admissions-stats-empty">No hay formularios ni firmas con fecha dentro de este periodo.</p>}
        </section>
        <div className="admissions-stats-tables-grid">
          <section className="admissions-stats-table-card"><h2>Avance por tipo de ingreso</h2><div className="admissions-stats-table-scroll"><table><thead><tr><th>Tipo</th><th>Total</th><th>Inscritos</th><th>Pendiente firma</th><th>Pendiente pago</th><th>Sin inscripción</th><th>Avance</th></tr></thead><tbody>{typeRows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.total}</td><td>{row.active}</td><td>{row.signature}</td><td>{row.payment}</td><td>{row.noEnrollment}</td><td>{row.completion}%</td></tr>)}</tbody></table></div></section>
          <section className="admissions-stats-table-card"><h2>Fechas por mes</h2><div className="admissions-stats-table-scroll"><table><thead><tr><th>Mes</th><th>Formularios</th><th>Firmas</th><th>Actividad</th></tr></thead><tbody>{monthly.map((row) => <tr key={row.month}><th scope="row">{monthName(row.month)}</th><td>{row.responses}</td><td>{row.signatures}</td><td>{row.responses + row.signatures}</td></tr>)}{!monthly.length && <tr><td colSpan={4}>Sin actividad en el periodo.</td></tr>}</tbody></table></div></section>
          <section className="admissions-stats-table-card admissions-stats-wide"><h2>Avance por grado</h2><div className="admissions-stats-table-scroll"><table><thead><tr><th>Grado</th><th>Total</th><th>Inscritos</th><th>Pendiente firma</th><th>Pendiente pago</th><th>Sin inscripción</th><th>Formularios</th><th>Firmas</th></tr></thead><tbody>{gradeRows.map((row) => <tr key={row.grade}><th scope="row">{row.grade}</th><td>{row.total}</td><td>{row.active}</td><td>{row.signature}</td><td>{row.payment}</td><td>{row.noEnrollment}</td><td>{row.responses}</td><td>{row.signed}</td></tr>)}</tbody></table></div></section>
          <section className="admissions-stats-table-card admissions-stats-wide"><h2>Inscripciones registradas</h2><div className="admissions-stats-table-scroll"><table><thead><tr><th>Alumno</th><th>Familia</th><th>Tipo</th><th>Grado</th><th>Estado</th><th>Firma</th></tr></thead><tbody>{enrollmentRows.slice(0, 30).map(({ item, candidate, type }) => <tr key={item.id}><td>{item.studentFirstName} {item.studentLastName}</td><td>{item.profile?.familyName ?? candidate?.familyName ?? "—"}</td><td>{typeLabel(type)}</td><td>{item.gradeName ?? "—"}</td><td>{statusLabel(item.status)}</td><td>{item.profile?.contractSignedAt ? dateLabel(String(item.profile.contractSignedAt)) : "Pendiente"}</td></tr>)}{!enrollmentRows.length && <tr><td colSpan={6}>Sin inscripciones registradas.</td></tr>}</tbody></table></div><p className="admissions-stats-footnote">Vista rápida de hasta 30 inscripciones. El Excel incluye todas las inscripciones del ciclo.</p></section>
          <section className="admissions-stats-table-card admissions-stats-wide"><h2>Actividad reciente</h2><div className="admissions-stats-table-scroll"><table><thead><tr><th>Fecha</th><th>Evento</th><th>Familia</th><th>Alumno(s)</th><th>Grado</th><th>Detalle</th></tr></thead><tbody>{events.slice().reverse().slice(0, 15).map((event, index) => <tr key={`${event.date}-${event.event}-${index}`}><td>{dateLabel(event.date)}</td><td>{event.event}</td><td>{event.family || "—"}</td><td>{event.student}</td><td>{event.grade || "—"}</td><td>{event.detail}</td></tr>)}{!events.length && <tr><td colSpan={6}>Sin eventos con fecha en el periodo seleccionado.</td></tr>}</tbody></table></div></section>
        </div>
      </>}
    </section>
  );
}
