"use client";

import { useEffect, useMemo, useState } from "react";
import { operation } from "@/lib/operations/client";
import { downloadWorkbookSheets, type WorkbookChart, type WorkbookSheet } from "@/lib/admissions/xlsx";
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
type PeriodEvent = { date: string; event: "Formulario recibido" | "Contrato firmado"; student: string; family: string; grade: string; detail: string };
type GradeSummary = { grade: string; total: number; active: number; signature: number; payment: number; noEnrollment: number; responses: number; signed: number };
type ActivityGranularity = "week" | "day";
type ActivityRow = { key: string; label: string; responses: number; signatures: number };

function summarizeProgress(candidates: AdmissionCandidate[], enrollments: Enrollment[]): ProgressGroup[] {
  const enrollmentByStudent = new Map(enrollments.map((item) => [item.studentId, item]));
  const students = new Map<number, { type: ProgressGroup["type"]; grade: string; status: string }>();
  for (const candidate of candidates) {
    const enrollment = enrollmentByStudent.get(candidate.id);
    if (candidate.status === "GRADUATED" && !enrollment) continue;
    students.set(candidate.id, {
      type: candidate.historicalContracts > 0 ? "REINSCRIPTION" : "NEW",
      grade: enrollment?.gradeName || candidate.proposedGrade || candidate.currentGrade || "Grado pendiente",
      status: enrollment?.status || "UNENROLLED",
    });
  }
  for (const enrollment of enrollments) {
    if (students.has(enrollment.studentId)) continue;
    students.set(enrollment.studentId, { type: "NEW", grade: enrollment.gradeName || "Grado pendiente", status: enrollment.status });
  }
  const groups = new Map<string, ProgressGroup>();
  for (const student of students.values()) {
    const key = `${student.type}\u0000${student.grade}`;
    const row = groups.get(key) ?? { type: student.type, grade: student.grade, total: 0, active: 0, pendingSignature: 0, pendingPayment: 0, unenrolled: 0 };
    row.total++;
    if (student.status === "ACTIVO") row.active++;
    else if (student.status === "PENDIENTE_FIRMA") row.pendingSignature++;
    else if (student.status === "PENDIENTE_PAGO") row.pendingPayment++;
    else if (student.status === "UNENROLLED") row.unenrolled++;
    groups.set(key, row);
  }
  return [...groups.values()].sort((a, b) => a.type.localeCompare(b.type) || a.grade.localeCompare(b.grade, "es"));
}

const PAGE_SIZE = 100;
const dayValue = (value: string) => value.slice(0, 10);
const inRange = (value: string, from: string, to: string) => {
  const date = dayValue(value);
  return (!from || date >= from) && (!to || date <= to);
};
const dateLabel = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-GT", { dateStyle: "medium" }).format(date);
};
const dateFromKey = (key: string) => new Date(`${key}T12:00:00`);
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, count: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
};
const mondayOf = (date: Date) => {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
};
const weekLabel = (key: string) => `Sem. ${new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short" }).format(dateFromKey(key))}`;
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
  const [activityGranularity, setActivityGranularity] = useState<ActivityGranularity>("day");
  const [activityPage, setActivityPage] = useState(1);
  const [enrollmentPage, setEnrollmentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [nextEnrollments, overview, nextResponses] = await Promise.all([
          loadEnrollments(),
          operation<{ candidates: AdmissionCandidate[] }>("admission-workflow/2027/overview"),
          loadResponses(),
        ]);
        if (!active) return;
        setGroups(summarizeProgress(overview.candidates ?? [], nextEnrollments));
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
      date: item.submittedAt, event: "Formulario recibido" as const,
      student: item.students.filter((student) => student.selected).map((student) => `${student.firstName} ${student.lastName}`.trim()).join(", ") || "Sin alumno seleccionado",
      family: item.familyName, grade: item.students.filter((student) => student.selected).map((student) => student.currentGrade || "Grado pendiente").join(", "),
      detail: item.wantsEnroll ? "Desea continuar" : "No continuará",
    })),
    ...periodSignatures.map((item) => ({
      date: String(item.profile?.contractSignedAt), event: "Contrato firmado" as const,
      student: `${item.studentFirstName ?? ""} ${item.studentLastName ?? ""}`.trim(), family: String(item.profile?.familyName ?? ""),
      grade: item.gradeName ?? "Grado pendiente", detail: statusLabel(item.status),
    })),
  ].sort((a, b) => a.date.localeCompare(b.date)), [periodResponses, periodSignatures]);

  const activityRows = useMemo<ActivityRow[]>(() => {
    if (!events.length) return [];
    const map = new Map<string, ActivityRow>();
    for (const event of events) {
      const eventDate = dateFromKey(dayValue(event.date));
      const key = dateKey(activityGranularity === "week" ? mondayOf(eventDate) : eventDate);
      const row = map.get(key) ?? { key, label: activityGranularity === "week" ? weekLabel(key) : new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short" }).format(eventDate), responses: 0, signatures: 0 };
      if (event.event === "Formulario recibido") row.responses++;
      else row.signatures++;
      map.set(key, row);
    }
    const start = dateFromKey(dayValue(dateFrom || events[0].date));
    const end = dateFromKey(dayValue(dateTo || events[events.length - 1].date));
    let cursor = activityGranularity === "week" ? mondayOf(start) : start;
    const last = activityGranularity === "week" ? mondayOf(end) : end;
    const rows: ActivityRow[] = [];
    while (cursor <= last) {
      const key = dateKey(cursor);
      rows.push(map.get(key) ?? {
        key,
        label: activityGranularity === "week" ? weekLabel(key) : new Intl.DateTimeFormat("es-GT", { day: "2-digit", month: "short" }).format(cursor),
        responses: 0,
        signatures: 0,
      });
      cursor = addDays(cursor, activityGranularity === "week" ? 7 : 1);
    }
    return rows;
  }, [events, activityGranularity, dateFrom, dateTo]);
  const maxActivity = Math.max(1, ...activityRows.map((row) => Math.max(row.responses, row.signatures)));
  const activityTicks = [...new Set([maxActivity, Math.ceil(maxActivity / 2), 0])];
  const activityPageSize = activityGranularity === "day" ? 14 : 8;
  const activityPageCount = Math.max(1, Math.ceil(activityRows.length / activityPageSize));
  const currentActivityPage = Math.min(activityPage, activityPageCount);
  const visibleActivityRows = activityRows.slice((currentActivityPage - 1) * activityPageSize, currentActivityPage * activityPageSize);

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
  const ENROLLMENTS_PER_PAGE = 10;
  const enrollmentPageCount = Math.max(1, Math.ceil(enrollmentRows.length / ENROLLMENTS_PER_PAGE));
  const currentEnrollmentPage = Math.min(enrollmentPage, enrollmentPageCount);
  const visibleEnrollmentRows = enrollmentRows.slice((currentEnrollmentPage - 1) * ENROLLMENTS_PER_PAGE, currentEnrollmentPage * ENROLLMENTS_PER_PAGE);

  function exportWorkbook() {
    const period = `${dateFrom || "Inicio"} — ${dateTo || "Sin límite"}`;
    const signedCount = periodSignatures.length;
    const activitySheetRows = [[activityGranularity === "week" ? "Semana desde" : "Fecha", "Formularios", "Firmas", "Actividad total"], ...activityRows.map((row) => [row.key, row.responses, row.signatures, row.responses + row.signatures])];
    const gradeSheetRows = [["Grado", "Total", "Inscritos", "Pendiente firma", "Pendiente pago", "Sin inscripción", "Formularios del periodo", "Firmas del periodo"], ...gradeRows.map((row) => [row.grade, row.total, row.active, row.signature, row.payment, row.noEnrollment, row.responses, row.signed])];
    const typeSheetRows = [["Tipo de ingreso", "Total", "Inscritos", "Pendiente firma", "Pendiente pago", "Sin inscripción", "Avance (%)"], ...typeRows.map((row) => [row.label, row.total, row.active, row.signature, row.payment, row.noEnrollment, row.completion])];
    const metricColors = ["327A5C", "173F8A", "D6A446", "A65B42", "82948B"];
    const activityCharts: WorkbookChart[] = activityRows.length ? [{
      type: "line", title: `Actividad ${activityGranularity === "week" ? "semanal" : "diaria"} · ciclo 2027`, categoryColumn: 0,
      series: [{ nameColumn: 1, valuesColumn: 1, color: metricColors[0] }, { nameColumn: 2, valuesColumn: 2, color: metricColors[2] }],
      position: { fromColumn: 5, fromRow: 1, toColumn: 14, toRow: 19 },
    }] : [];
    const gradeCharts: WorkbookChart[] = gradeRows.length ? [{
      type: "bar", title: "Inscripciones por grado y estado", categoryColumn: 0,
      series: [1, 2, 3, 4, 5].map((column, index) => ({ nameColumn: column, valuesColumn: column, color: metricColors[index] })),
      position: { fromColumn: 9, fromRow: 1, toColumn: 19, toRow: 20 },
    }] : [];
    const typeCharts: WorkbookChart[] = typeRows.length ? [{
      type: "bar", title: "Estado por tipo de ingreso", categoryColumn: 0,
      series: [1, 2, 3, 4, 5].map((column, index) => ({ nameColumn: column, valuesColumn: column, color: metricColors[index] })),
      position: { fromColumn: 8, fromRow: 1, toColumn: 18, toRow: 18 },
    }] : [];
    const reportSheets: WorkbookSheet[] = [
      { name: "Resumen", rows: [
        ["REPORTE DE INSCRIPCIONES · CICLO 2027", "Colegio Bilingüe Montessori Zacapa"], ["Periodo de actividad", period], ["Generado", new Date().toLocaleString("es-GT")], [],
        ["Indicador", "Resultado"], ["Alumnos en seguimiento", summary.total], ["Inscritos", summary.active], ["Pendientes de firma", summary.pendingSignature],
        ["Pendientes de pago", summary.pendingPayment], ["Sin inscripción", summary.unenrolled], ["Nuevo ingreso", summary.newTotal], ["Reinscripción", summary.returningTotal],
        ["Formularios recibidos en el periodo", periodResponses.length], ["Contratos firmados en el periodo", signedCount],
        ["Agrupación temporal de actividad", activityGranularity === "week" ? "Por semana" : "Por día"],
      ] },
      { name: "Actividad temporal", rows: activitySheetRows, charts: activityCharts },
      { name: "Por grado", rows: gradeSheetRows, charts: gradeCharts },
      { name: "Por tipo", rows: typeSheetRows, charts: typeCharts },
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
        <label>Actividad desde<input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setActivityPage(1); }} /></label>
        <label>Actividad hasta<input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setActivityPage(1); }} /></label>
        {(dateFrom || dateTo) && <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); setActivityPage(1); }}>Limpiar fechas</button>}
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
          <div className="admissions-stats-card-heading"><div><h2>Actividad por {activityGranularity === "week" ? "semana" : "día"}</h2><p>Formularios recibidos y contratos firmados, con escala y valores por periodo.</p></div><div className="admissions-stats-chart-tools"><div className="admissions-stats-granularity" role="group" aria-label="Agrupar actividad por"><button type="button" aria-pressed={activityGranularity === "week"} onClick={() => { setActivityGranularity("week"); setActivityPage(1); }}>Semana</button><button type="button" aria-pressed={activityGranularity === "day"} onClick={() => { setActivityGranularity("day"); setActivityPage(1); }}>Día</button></div><div className="admissions-stats-legend"><span><i className="responses"/>Formularios</span><span><i className="signatures"/>Firmas</span></div></div></div>
          {activityRows.length ? <><div className="admissions-stats-chart-layout"><div className="admissions-stats-y-axis" aria-hidden="true">{activityTicks.map((tick) => <small key={tick}>{tick}</small>)}</div><div className={`admissions-stats-activity-chart ${activityGranularity === "day" ? "daily" : "weekly"}`}>{visibleActivityRows.map((row) => {
            const responseHeight = row.responses / maxActivity * 100;
            const signatureHeight = row.signatures / maxActivity * 100;
            return <div className="admissions-stats-activity-column" key={row.key}>
              <div className="admissions-stats-bar-pair" title={`${row.label}: ${row.responses} formularios · ${row.signatures} firmas`}>
                <div className="admissions-stats-bar-column"><small className="responses-value" style={{ bottom: `calc(${responseHeight}% + 3px)` }}>{row.responses}</small><i className="responses" style={{ height: `${responseHeight}%` }}/></div>
                <div className="admissions-stats-bar-column"><small className="signatures-value" style={{ bottom: `calc(${signatureHeight}% + 3px)` }}>{row.signatures}</small><i className="signatures" style={{ height: `${signatureHeight}%` }}/></div>
              </div>
              <small className="admissions-stats-activity-label">{row.label}</small>
            </div>;
          })}</div></div><div className="admissions-stats-pagination"><span>{activityGranularity === "day" ? "Días" : "Semanas"} {(currentActivityPage - 1) * activityPageSize + 1}–{Math.min(currentActivityPage * activityPageSize, activityRows.length)} de {activityRows.length}</span><div><button type="button" disabled={currentActivityPage <= 1} onClick={() => setActivityPage(currentActivityPage - 1)}>Anterior</button><small>Página {currentActivityPage} de {activityPageCount}</small><button type="button" disabled={currentActivityPage >= activityPageCount} onClick={() => setActivityPage(currentActivityPage + 1)}>Siguiente</button></div></div></> : <p className="admissions-stats-empty">No hay formularios ni firmas con fecha dentro de este periodo.</p>}
        </section>
        <div className="admissions-stats-tables-grid">
          <section className="admissions-stats-table-card"><h2>Avance por tipo de ingreso</h2><div className="admissions-stats-table-scroll"><table><thead><tr><th>Tipo</th><th>Total</th><th>Inscritos</th><th>Pendiente firma</th><th>Pendiente pago</th><th>Sin inscripción</th><th>Avance</th></tr></thead><tbody>{typeRows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.total}</td><td>{row.active}</td><td>{row.signature}</td><td>{row.payment}</td><td>{row.noEnrollment}</td><td>{row.completion}%</td></tr>)}</tbody></table></div></section>
          <section className="admissions-stats-table-card"><h2>Actividad por {activityGranularity === "week" ? "semana" : "día"}</h2><div className="admissions-stats-table-scroll"><table><thead><tr><th>{activityGranularity === "week" ? "Semana desde" : "Fecha"}</th><th>Formularios</th><th>Firmas</th><th>Actividad total</th></tr></thead><tbody>{visibleActivityRows.map((row) => <tr key={row.key}><th scope="row">{row.label}</th><td>{row.responses}</td><td>{row.signatures}</td><td>{row.responses + row.signatures}</td></tr>)}{!activityRows.length && <tr><td colSpan={4}>Sin actividad en el periodo.</td></tr>}</tbody></table><div className="admissions-stats-pagination"><span>{activityGranularity === "day" ? "Días" : "Semanas"} {(currentActivityPage - 1) * activityPageSize + 1}–{Math.min(currentActivityPage * activityPageSize, activityRows.length)} de {activityRows.length}</span><div><button type="button" disabled={currentActivityPage <= 1} onClick={() => setActivityPage(currentActivityPage - 1)}>Anterior</button><small>Página {currentActivityPage} de {activityPageCount}</small><button type="button" disabled={currentActivityPage >= activityPageCount} onClick={() => setActivityPage(currentActivityPage + 1)}>Siguiente</button></div></div></div></section>
          <section className="admissions-stats-table-card admissions-stats-wide"><h2>Avance por grado</h2><div className="admissions-stats-table-scroll"><table><thead><tr><th>Grado</th><th>Total</th><th>Inscritos</th><th>Pendiente firma</th><th>Pendiente pago</th><th>Sin inscripción</th><th>Formularios</th><th>Firmas</th></tr></thead><tbody>{gradeRows.map((row) => <tr key={row.grade}><th scope="row">{row.grade}</th><td>{row.total}</td><td>{row.active}</td><td>{row.signature}</td><td>{row.payment}</td><td>{row.noEnrollment}</td><td>{row.responses}</td><td>{row.signed}</td></tr>)}</tbody></table></div></section>
          <section className="admissions-stats-table-card admissions-stats-wide"><h2>Inscripciones registradas</h2><div className="admissions-stats-table-scroll"><table><thead><tr><th>Alumno</th><th>Familia</th><th>Tipo</th><th>Grado</th><th>Estado</th><th>Firma</th></tr></thead><tbody>{visibleEnrollmentRows.map(({ item, candidate, type }) => <tr key={item.id}><td>{item.studentFirstName} {item.studentLastName}</td><td>{item.profile?.familyName ?? candidate?.familyName ?? "—"}</td><td>{typeLabel(type)}</td><td>{item.gradeName ?? "—"}</td><td>{statusLabel(item.status)}</td><td>{item.profile?.contractSignedAt ? dateLabel(String(item.profile.contractSignedAt)) : "Pendiente"}</td></tr>)}{!enrollmentRows.length && <tr><td colSpan={6}>Sin inscripciones registradas.</td></tr>}</tbody></table></div><div className="admissions-stats-pagination"><span>Inscripciones {enrollmentRows.length ? (currentEnrollmentPage - 1) * ENROLLMENTS_PER_PAGE + 1 : 0}–{Math.min(currentEnrollmentPage * ENROLLMENTS_PER_PAGE, enrollmentRows.length)} de {enrollmentRows.length}</span><div><button type="button" disabled={currentEnrollmentPage <= 1} onClick={() => setEnrollmentPage(currentEnrollmentPage - 1)}>Anterior</button><small>Página {currentEnrollmentPage} de {enrollmentPageCount}</small><button type="button" disabled={currentEnrollmentPage >= enrollmentPageCount} onClick={() => setEnrollmentPage(currentEnrollmentPage + 1)}>Siguiente</button></div></div><p className="admissions-stats-footnote">El Excel incluye todas las inscripciones del ciclo.</p></section>
          <section className="admissions-stats-table-card admissions-stats-wide"><h2>Actividad reciente</h2><div className="admissions-stats-table-scroll"><table><thead><tr><th>Fecha</th><th>Evento</th><th>Familia</th><th>Alumno(s)</th><th>Grado</th><th>Detalle</th></tr></thead><tbody>{events.slice().reverse().slice(0, 15).map((event, index) => <tr key={`${event.date}-${event.event}-${index}`}><td>{dateLabel(event.date)}</td><td>{event.event}</td><td>{event.family || "—"}</td><td>{event.student}</td><td>{event.grade || "—"}</td><td>{event.detail}</td></tr>)}{!events.length && <tr><td colSpan={6}>Sin eventos con fecha en el periodo seleccionado.</td></tr>}</tbody></table></div></section>
        </div>
      </>}
    </section>
  );
}
