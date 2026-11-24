"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { operation, save } from "@/lib/operations/client";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import type { Bootstrap, CreatedPreEnrollmentLink, Enrollment } from "@/lib/operations/types";
import { isDeviceUsePolicyApplicable } from "@/features/admissions/device-use-policy";
import { isEnglishTimeApplicable } from "@/features/admissions/english-time";

const FALLBACK_GRADE_ORDER = [
  "Kinder",
  "Preparatoria",
  "Primero primaria",
  "Segundo primaria",
  "Tercero primaria",
  "Cuarto primaria",
  "Quinto primaria",
  "Sexto primaria",
  "Primero básico",
  "Segundo básico",
  "Tercero básico",
  "Cuarto bachillerato",
  "Quinto bachillerato",
];
const TABLE_PAGE_SIZE = 5;
type EnrollmentStatusFilter = "all" | "unregistered" | "ACTIVO" | "PENDIENTE_FIRMA" | "PENDIENTE_PAGO" | "INACTIVO" | "RETIRADO";

const enrollmentStatusOptions: { value: EnrollmentStatusFilter; label: string }[] = [
  { value: "all", label: "Todos los estados" },
  { value: "unregistered", label: "Sin inscripción 2027" },
  { value: "PENDIENTE_FIRMA", label: "Pendiente de firma" },
  { value: "PENDIENTE_PAGO", label: "Pendiente de pago" },
  { value: "ACTIVO", label: "Inscrito" },
  { value: "INACTIVO", label: "Inactivo" },
  { value: "RETIRADO", label: "Retirado" },
];

function isFinalBachilleratoGrade(grade: string | null) {
  const normalized = (grade ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[°º.]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return /^(?:quinto|5to|5o|5)\s+(?:de\s+)?(?:bachillerato|bach)\b/.test(normalized);
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .trim();
}

function transitionKey(from: string, to: string) {
  return `${from} → ${to}`;
}

function enrollmentStatusLabel(status?: string) {
  if (status === "ACTIVO") return "Inscrito";
  if (status === "PENDIENTE_FIRMA") return "Pendiente de firma";
  if (status === "PENDIENTE_PAGO") return "Pendiente de pago";
  if (status === "INACTIVO") return "Inactivo";
  if (status === "RETIRADO") return "Retirado";
  return "No inscrito";
}

function enrollmentStatusClassName(status?: string) {
  if (status === "ACTIVO") return "complete";
  if (status === "PENDIENTE_FIRMA" || status === "PENDIENTE_PAGO") return "pending";
  return "unlinked";
}

function reinscriptionHref(student: AdmissionCandidate) {
  return `/inscripciones/reinscripcion/alumno/${student.id}`;
}

async function loadSubmittedFamilyIds() {
  const familyIds = await operation<number[]>("admission-workflow/pre-enrollment-family-status");
  return new Set(familyIds);
}

type GradeBatchTarget = { familyId: number; familyName: string; studentNames: string[]; gradeStudentCount: number };
type GradeBatchLink = { link: CreatedPreEnrollmentLink; studentNames: string[] };

function localDateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("es-GT", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

async function downloadGradePreEnrollmentPdf(grade: string, rows: GradeBatchLink[], generatedAt: string) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 42;
  const contentWidth = pageWidth - margin * 2;
  const studentCount = rows.reduce((count, row) => count + row.studentNames.length, 0);

  function drawHeader() {
    pdf.setTextColor(23, 63, 138);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("COLEGIO BILINGÜE MONTESSORI ZACAPA", margin, 36);
    pdf.setFontSize(18);
    pdf.text("Enlaces de preinscripción 2027", margin, 62);
    pdf.setFontSize(13);
    pdf.text(`Grado: ${grade}`, margin, 82);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(83, 103, 143);
    pdf.text(`${rows.length} familias · ${studentCount} alumnos · Generado ${localDateLabel(generatedAt)}`, margin, 101);
    pdf.setDrawColor(203, 213, 225);
    pdf.line(margin, 114, pageWidth - margin, 114);
    pdf.setTextColor(90, 100, 115);
    pdf.setFontSize(8);
    pdf.text("Cada enlace es familiar; comparte solo con la familia indicada.", margin, 128);
  }

  const safeGrade = grade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "grado";
  pdf.setProperties({ title: `Preinscripción 2027 · ${grade}`, subject: `Enlaces por familia de ${grade}`, creator: "Montessori Admissions" });
  drawHeader();
  let y = 150;

  for (const { link, studentNames } of rows) {
    const studentLabel = studentNames.length === 1
      ? `Alumno: ${studentNames[0]}`
      : studentNames.length === 2
        ? `Para ambos alumnos: ${studentNames.join(" y ")}`
        : `Para los ${studentNames.length} alumnos: ${studentNames.join(" y ")}`;
    const studentLines = pdf.splitTextToSize(studentLabel, contentWidth) as string[];
    const familyLines = pdf.splitTextToSize(`Familia: ${link.familyName}`, contentWidth) as string[];
    const expiryLines = pdf.splitTextToSize(`Vence: ${localDateLabel(link.expiresAt)}`, contentWidth) as string[];
    const urlLines = pdf.splitTextToSize(link.url, contentWidth - 12) as string[];
    const rowHeight = studentLines.length * 14 + familyLines.length * 12 + expiryLines.length * 12 + urlLines.length * 11 + 42;
    if (y + rowHeight > pageHeight - margin) {
      pdf.addPage();
      drawHeader();
      y = 150;
    }

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10.5);
    pdf.setTextColor(31, 41, 55);
    pdf.text(studentLines, margin, y);
    y += studentLines.length * 14 + 2;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(71, 85, 105);
    pdf.text(familyLines, margin, y);
    y += familyLines.length * 12;
    pdf.text(expiryLines, margin, y);
    y += expiryLines.length * 12 + 3;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(23, 63, 138);
    pdf.text("Enlace:", margin, y);
    y += 11;
    pdf.setFont("courier", "normal");
    pdf.setFontSize(8);
    pdf.text(urlLines, margin + 8, y);
    y += urlLines.length * 11 + 12;
    pdf.setDrawColor(226, 232, 240);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 14;
  }

  pdf.save(`preinscripcion-2027-${safeGrade}.pdf`);
}

export function GradeBatchPreEnrollmentLinks({
  candidates,
  enrollments,
  submittedFamilyIds,
  preEnrollmentStatusReady,
  gradeOrder,
}: {
  candidates: AdmissionCandidate[];
  enrollments: Enrollment[];
  submittedFamilyIds: Set<number> | null;
  preEnrollmentStatusReady: boolean;
  gradeOrder: string[];
}) {
  const [grade, setGrade] = useState("");
  const [generatedRows, setGeneratedRows] = useState<GradeBatchLink[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const enrollmentStudentIds = useMemo(() => new Set(enrollments.map((enrollment) => enrollment.studentId)), [enrollments]);

  const gradeOptions = useMemo(() => {
    const grades = new Set<string>();
    for (const student of candidates) {
      const currentGrade = student.currentGrade?.trim();
      if (currentGrade && !isFinalBachilleratoGrade(currentGrade)) grades.add(currentGrade);
    }
    const rank = new Map(gradeOrder.map((item, index) => [item.toLocaleLowerCase("es"), index]));
    return [...grades].sort((left, right) =>
      (rank.get(left.toLocaleLowerCase("es")) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.toLocaleLowerCase("es")) ?? Number.MAX_SAFE_INTEGER)
      || left.localeCompare(right, "es"),
    );
  }, [candidates, gradeOrder]);

  const targets = useMemo(() => {
    if (!grade || !preEnrollmentStatusReady || !submittedFamilyIds) return [];
    const studentsByFamily = new Map<number, AdmissionCandidate[]>();
    for (const student of candidates) {
      if (student.familyId == null || !student.familyName) continue;
      const students = studentsByFamily.get(student.familyId) ?? [];
      students.push(student);
      studentsByFamily.set(student.familyId, students);
    }
    const grouped = new Map<number, GradeBatchTarget>();
    for (const [familyId, familyStudents] of studentsByFamily) {
      if (submittedFamilyIds.has(familyId)) continue;
      const eligibleStudents = familyStudents.filter((student) =>
        !enrollmentStudentIds.has(student.id) && !isFinalBachilleratoGrade(student.currentGrade),
      );
      const gradeStudents = eligibleStudents.filter((student) => student.currentGrade?.trim() === grade);
      if (!gradeStudents.length) continue;
      const target = grouped.get(familyId) ?? {
        familyId,
        familyName: familyStudents[0].familyName!,
        studentNames: [],
        gradeStudentCount: 0,
      };
      for (const student of eligibleStudents) {
        const name = `${student.firstName} ${student.lastName}`.trim();
        if (name && !target.studentNames.includes(name)) target.studentNames.push(name);
      }
      target.gradeStudentCount += gradeStudents.length;
      grouped.set(familyId, target);
    }
    return [...grouped.values()]
      .map((target) => ({ ...target, studentNames: target.studentNames.sort((left, right) => left.localeCompare(right, "es")) }))
      .sort((left, right) => left.familyName.localeCompare(right.familyName, "es") || left.familyId - right.familyId);
  }, [candidates, enrollmentStudentIds, grade, preEnrollmentStatusReady, submittedFamilyIds]);

  async function generateBatch() {
    if (!grade || !targets.length) return;
    setBusy(true);
    setError("");
    setNotice("");
    setGeneratedRows([]);
    setGeneratedAt("");
    try {
      const links: CreatedPreEnrollmentLink[] = [];
      const familyIds = targets.map((target) => target.familyId);
      for (let start = 0; start < familyIds.length; start += 200) {
        links.push(...await save<CreatedPreEnrollmentLink[]>("admission-workflow/pre-enrollment-links/batch", {
          familyIds: familyIds.slice(start, start + 200),
        }));
      }
      const linkByFamily = new Map(links.map((link) => [link.familyId, link]));
      const rows = targets.flatMap((target) => {
        const link = linkByFamily.get(target.familyId);
        return link ? [{ link, studentNames: target.studentNames }] : [];
      });
      const now = new Date().toISOString();
      setGeneratedRows(rows);
      setGeneratedAt(now);
      setNotice(`Se generaron ${rows.length} enlaces, uno por familia. Se omitieron alumnos ya inscritos y familias que ya respondieron.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron generar los enlaces del grado.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadPdf() {
    if (!generatedRows.length || !grade) return;
    setPdfBusy(true);
    setError("");
    try {
      await downloadGradePreEnrollmentPdf(grade, generatedRows, generatedAt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo preparar el PDF del grado.");
    } finally {
      setPdfBusy(false);
    }
  }

  return <section className="grade-batch-links" aria-labelledby="grade-batch-links-title">
    <div className="grade-batch-links-copy">
      <span>GENERACIÓN POR GRADO</span>
      <h2 id="grade-batch-links-title">Crear enlaces y descargar PDF</h2>
      <p>Se genera un enlace por familia pendiente. Las familias con respuesta y los alumnos con inscripción 2027 se excluyen.</p>
    </div>
    <div className="grade-batch-links-controls">
      <label className="grade-table-filter">
        <span>Grado actual</span>
        <select value={grade} onChange={(event) => { setGrade(event.target.value); setGeneratedRows([]); setGeneratedAt(""); setError(""); setNotice(""); }} disabled={!preEnrollmentStatusReady || busy}>
          <option value="">Selecciona un grado</option>
          {gradeOptions.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
      </label>
      <p className="grade-batch-links-count">
        {!preEnrollmentStatusReady ? "Cargando el estado de preinscripción…" : `${targets.length} familias · ${targets.reduce((sum, target) => sum + target.gradeStudentCount, 0)} alumnos pendientes en el grado`}
      </p>
      <button className="grade-batch-button" type="button" disabled={!grade || !targets.length || busy || !preEnrollmentStatusReady} onClick={() => void generateBatch()}>
        {busy ? "Generando enlaces…" : `Generar ${targets.length} enlaces`}
      </button>
    </div>
    {error && <p className="grade-batch-error" role="alert">{error}</p>}
    {notice && <div className="grade-batch-result" aria-live="polite">
      <span>{notice}</span>
      <button className="grade-batch-button secondary" type="button" disabled={pdfBusy} onClick={() => void downloadPdf()}>
        {pdfBusy ? "Preparando PDF…" : `Descargar PDF · ${grade}`}
      </button>
    </div>}
  </section>;
}

function GeneratePreEnrollmentLink({ familyId }: { familyId: number }) {
  const [link, setLink] = useState<CreatedPreEnrollmentLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  async function generate() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      setLink(await save<CreatedPreEnrollmentLink>("admission-workflow/pre-enrollment-links", { familyId, recipientType: "FAMILY" }));
      setOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo generar el enlace de preinscripción.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setMessage("Enlace copiado.");
    } catch {
      setMessage("No se pudo copiar automáticamente; selecciona el enlace para copiarlo.");
    }
  }

  return <>
    <button className="grade-row-action secondary" type="button" disabled={busy} onClick={() => void generate()}>
      {busy ? "Generando enlace…" : link ? "Generar otro link" : "Generar link de preinscripción"}
    </button>
    {open && link && typeof document !== "undefined" && createPortal(
      <section className="pre-enrollment-floating-card" aria-labelledby="pre-enrollment-floating-title" aria-live="polite">
        <header>
          <div><span>PREINSCRIPCIÓN FAMILIAR</span><h2 id="pre-enrollment-floating-title">Link generado</h2></div>
          <button type="button" aria-label="Cerrar tarjeta del link" onClick={() => setOpen(false)}>×</button>
        </header>
        <label htmlFor={`pre-enrollment-link-${link.id}`}>Comparte este link con la familia</label>
        <input id={`pre-enrollment-link-${link.id}`} readOnly value={link.url} onFocus={(event) => event.currentTarget.select()} />
        <button className="pre-enrollment-floating-copy" type="button" onClick={() => void copy()}>{message === "Enlace copiado." ? "Copiado" : "Copiar link"}</button>
        <p>Este link vencerá en 7 días.</p>
        {message && <small role="status">{message}</small>}
      </section>,
      document.body,
    )}
    {error && <small className="grade-pre-enrollment-error" role="alert">{error}</small>}
  </>;
}

function familyPreEnrollmentStatus(
  familyId: number | null,
  loaded: boolean,
  available: boolean,
  submittedFamilyIds: Set<number> | null,
) {
  if (familyId == null) return { label: "Sin familia", className: "unlinked" };
  if (!loaded) return { label: "Consultando…", className: "loading" };
  if (!available || !submittedFamilyIds) return { label: "No disponible", className: "unavailable" };
  return submittedFamilyIds.has(familyId)
    ? { label: "Completada", className: "complete" }
    : { label: "Pendiente", className: "pending" };
}

function GradeTransitionTable({
  from,
  to,
  rows,
  enrollments,
  submittedFamilyIds,
  preEnrollmentStatusLoaded,
  preEnrollmentStatusAvailable,
}: {
  from: string;
  to: string;
  rows: AdmissionCandidate[];
  enrollments: Enrollment[];
  submittedFamilyIds: Set<number> | null;
  preEnrollmentStatusLoaded: boolean;
  preEnrollmentStatusAvailable: boolean;
}) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(rows.length / TABLE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * TABLE_PAGE_SIZE;
  const visibleRows = rows.slice(startIndex, startIndex + TABLE_PAGE_SIZE);

  return (
    <article className="grade-table-card">
      <header className="grade-table-heading">
        <div>
          <span>Familias</span>
          <h2>{from} <b aria-hidden="true">→</b> {to}</h2>
        </div>
        <small>{rows.length} alumno{rows.length === 1 ? "" : "s"}</small>
      </header>
      <div className="grade-table-scroll">
        <table>
          <thead>
            <tr><th>Familia</th><th>Alumno</th><th>Preinscripción</th><th>Inscripción 2027</th><th>Acción</th></tr>
          </thead>
          <tbody>
            {visibleRows.map((student) => {
              const status = familyPreEnrollmentStatus(
                student.familyId,
                preEnrollmentStatusLoaded,
                preEnrollmentStatusAvailable,
                submittedFamilyIds,
              );
              const enrollment = enrollments.find((item) => item.studentId === student.id);
              const enrollmentStatus = enrollmentStatusLabel(enrollment?.status);
              return (
                <tr key={student.id}>
                  <td>{student.familyName || "Familia sin vincular"}</td>
                  <td>{`${student.firstName} ${student.lastName}`.trim()}</td>
                  <td><span className={`pre-enrollment-status ${status.className}`}>{status.label}</span></td>
                  <td><span className={`pre-enrollment-status ${enrollmentStatusClassName(enrollment?.status)}`}>{enrollmentStatus}</span></td>
                  <td>
                    <div className="grade-table-actions">
                      {!enrollment && <Link className="grade-row-action" href={reinscriptionHref(student)}>Iniciar reinscripción</Link>}
                      {student.familyId && <a className="grade-row-action secondary" href={`/inscripciones/familias/${student.familyId}`}>Ficha de datos</a>}
                      {student.familyId && status.className === "pending" && !enrollment && <GeneratePreEnrollmentLink familyId={student.familyId} />}
                      {enrollment && <details className="grade-row-downloads">
                        <summary className="grade-row-action secondary">Descargas e impresiones</summary>
                        <div className="grade-row-downloads-menu">
                          <a href={`/api/operations/enrollments/${enrollment.id}/contract.pdf`} target="_blank" rel="noreferrer">Imprimir contrato</a>
                          {isDeviceUsePolicyApplicable(enrollment.gradeName, enrollment.schoolYear) && <a href={`/api/operations/enrollments/${enrollment.id}/device-use-policy.pdf`} target="_blank" rel="noreferrer">Imprimir reglamento</a>}
                          {isEnglishTimeApplicable(enrollment.gradeName, enrollment.schoolYear) && <a href={`/api/operations/enrollments/${enrollment.id}/english-time-commitment.pdf`} target="_blank" rel="noreferrer">Imprimir carta English Time</a>}
                        </div>
                      </details>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <nav className="grade-table-pagination" aria-label={`Paginación de ${from} a ${to}`}>
        <span>Filas {startIndex + 1}–{Math.min(startIndex + TABLE_PAGE_SIZE, rows.length)} de {rows.length}</span>
        <div>
          <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
            Anterior
          </button>
          <small>Página {currentPage} de {pageCount}</small>
          <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
            Siguiente
          </button>
        </div>
      </nav>
    </article>
  );
}

export function GradeProgressionTables({
  initialCandidates,
  initialError = "",
}: {
  initialCandidates: AdmissionCandidate[];
  initialError?: string;
}) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [submittedFamilyIds, setSubmittedFamilyIds] = useState<Set<number> | null>(null);
  const [preEnrollmentStatusLoaded, setPreEnrollmentStatusLoaded] = useState(false);
  const [preEnrollmentStatusAvailable, setPreEnrollmentStatusAvailable] = useState(false);
  const [search, setSearch] = useState("");
  const [transitionFilter, setTransitionFilter] = useState("all");
  const [preEnrollmentFilter, setPreEnrollmentFilter] = useState("all");
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState<EnrollmentStatusFilter>("all");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      void loadSubmittedFamilyIds()
        .then((ids) => {
          if (cancelled) return;
          setSubmittedFamilyIds(ids);
          setPreEnrollmentStatusLoaded(true);
          setPreEnrollmentStatusAvailable(true);
        })
        .catch((cause) => {
          if (cancelled) return;
          setSubmittedFamilyIds(null);
          setPreEnrollmentStatusLoaded(true);
          setPreEnrollmentStatusAvailable(false);
          const message = cause instanceof Error ? cause.message : "No se pudo consultar el estado de las preinscripciones.";
          setLoadError((current) => current ? `${current} ${message}` : message);
        });
      const [bootstrapResult, enrollmentResult] = await Promise.allSettled([
        operation<Bootstrap>("enrollments/bootstrap?summary=true"),
        operation<Enrollment[]>("enrollments?schoolYear=2027&summary=true"),
      ]);

      const errors: string[] = [];
      const nextBootstrap = bootstrapResult.status === "fulfilled" ? bootstrapResult.value : null;
      const nextEnrollments = enrollmentResult.status === "fulfilled" ? enrollmentResult.value : [];

      if (bootstrapResult.status !== "fulfilled") {
        errors.push(bootstrapResult.reason instanceof Error ? bootstrapResult.reason.message : "No se pudo cargar el catálogo de grados.");
      }
      if (enrollmentResult.status === "rejected") {
        errors.push(enrollmentResult.reason instanceof Error ? enrollmentResult.reason.message : "No se pudieron cargar las inscripciones del ciclo 2027.");
      }

      if (!cancelled) {
        setBootstrap(nextBootstrap);
        setEnrollments(nextEnrollments);
        if (errors.length > 0) setLoadError((current) => current ? `${current} ${errors.join(" ")}` : errors.join(" "));
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const enrollmentByStudent = useMemo(() => new Map(enrollments.map((enrollment) => [enrollment.studentId, enrollment])), [enrollments]);

  const tables = useMemo(() => {
    const students = new Map<number, AdmissionCandidate>();

    for (const candidate of initialCandidates) {
      const enrollment = enrollmentByStudent.get(candidate.id);
      students.set(candidate.id, {
        ...candidate,
        proposedGrade: candidate.proposedGrade || enrollment?.gradeName || null,
      });
    }

    for (const enrollment of enrollments) {
      if (students.has(enrollment.studentId)) continue;
      const profileFamilyName = String(enrollment.profile?.familyName ?? "").trim();
      students.set(enrollment.studentId, {
        id: enrollment.studentId,
        uuid: enrollment.studentUuid,
        firstName: enrollment.studentFirstName || "Alumno",
        lastName: enrollment.studentLastName || "",
        currentGrade: null,
        proposedGrade: enrollment.gradeName,
        familyId: null,
        familyName: profileFamilyName || null,
        familyReviewStatus: null,
        representativeName: null,
        historicalContracts: 0,
        status: "REVIEW",
      });
    }

    const groups = new Map<string, { from: string; to: string; rows: AdmissionCandidate[] }>();
    for (const student of students.values()) {
      if (student.status === "GRADUATED" || isFinalBachilleratoGrade(student.currentGrade)) continue;
      const from = student.currentGrade?.trim() || (student.historicalContracts > 0 ? "Grado por confirmar" : "Nuevo ingreso");
      const to = student.proposedGrade?.trim() || "Grado por asignar";
      const key = `${from}\u0000${to}`;
      const group = groups.get(key) ?? { from, to, rows: [] };
      group.rows.push(student);
      groups.set(key, group);
    }

    const gradeOrder = bootstrap?.gradeLevels.map((grade) => grade.name) ?? FALLBACK_GRADE_ORDER;
    const gradeRank = new Map(gradeOrder.map((grade, index) => [grade.toLocaleLowerCase("es"), index]));
    const rank = (grade: string) => gradeRank.get(grade.toLocaleLowerCase("es")) ?? Number.MAX_SAFE_INTEGER;

    return [...groups.values()]
      .map((group) => ({
        ...group,
        rows: group.rows.sort((a, b) =>
          (a.familyName || "").localeCompare(b.familyName || "", "es") ||
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "es"),
        ),
      }))
      .sort((a, b) => rank(a.to) - rank(b.to) || rank(a.from) - rank(b.from) || a.from.localeCompare(b.from, "es"));
  }, [bootstrap, enrollments, initialCandidates]);

  const visibleTables = useMemo(() => {
    const searchTerm = normalizeSearch(search);
    return tables
      .map((table) => ({
        ...table,
        rows: table.rows.filter((student) => {
          const matchesTransition = transitionFilter === "all" || transitionFilter === transitionKey(table.from, table.to);
          const studentText = normalizeSearch(`${student.familyName ?? ""} ${student.firstName} ${student.lastName}`);
          const matchesSearch = !searchTerm || studentText.includes(searchTerm);
          const status = familyPreEnrollmentStatus(
            student.familyId,
            preEnrollmentStatusLoaded,
            preEnrollmentStatusAvailable,
            submittedFamilyIds,
          );
          const matchesPreEnrollment = preEnrollmentFilter === "all" || status.className === preEnrollmentFilter;
          const enrollmentStatus = enrollmentByStudent.get(student.id)?.status;
          const matchesEnrollmentStatus = enrollmentStatusFilter === "all"
            || (enrollmentStatusFilter === "unregistered" ? !enrollmentStatus : enrollmentStatus === enrollmentStatusFilter);
          return matchesTransition && matchesSearch && matchesPreEnrollment && matchesEnrollmentStatus;
        }),
      }))
      .filter((table) => table.rows.length > 0);
  }, [tables, search, transitionFilter, preEnrollmentFilter, enrollmentStatusFilter, enrollmentByStudent, preEnrollmentStatusLoaded, preEnrollmentStatusAvailable, submittedFamilyIds]);

  const visibleStudentCount = visibleTables.reduce((total, table) => total + table.rows.length, 0);
  const pageResetKey = `${normalizeSearch(search)}\u0000${transitionFilter}\u0000${preEnrollmentFilter}\u0000${enrollmentStatusFilter}`;
  const batchGradeOrder = bootstrap?.gradeLevels.map((grade) => grade.name) ?? FALLBACK_GRADE_ORDER;

  return (
    <section className="grade-tables-section" aria-label="Familias agrupadas por transición de grado">
      {(initialError || loadError) && <p className="grade-table-alert" role="alert">{initialError || loadError}</p>}
      <GradeBatchPreEnrollmentLinks
        candidates={initialCandidates}
        enrollments={enrollments}
        submittedFamilyIds={submittedFamilyIds}
        preEnrollmentStatusReady={preEnrollmentStatusLoaded && preEnrollmentStatusAvailable}
        gradeOrder={batchGradeOrder}
      />
      <div className="grade-table-toolbar">
        <label className="grade-table-filter grade-table-search">
          <span>Buscar familia o alumno</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Escribe un nombre…"
          />
        </label>
        <label className="grade-table-filter">
          <span>Transición de grado</span>
          <select value={transitionFilter} onChange={(event) => setTransitionFilter(event.target.value)}>
            <option value="all">Todos los grados</option>
            {tables.map((table) => {
              const key = transitionKey(table.from, table.to);
              return <option key={key} value={key}>{key}</option>;
            })}
          </select>
        </label>
        <label className="grade-table-filter">
          <span>Estado de preinscripción</span>
          <select value={preEnrollmentFilter} onChange={(event) => setPreEnrollmentFilter(event.target.value)}>
            <option value="all">Todos los estados</option>
            <option value="complete">Completada</option>
            <option value="pending">Pendiente</option>
            <option value="unlinked">Sin familia</option>
            <option value="unavailable">No disponible</option>
          </select>
        </label>
        <label className="grade-table-filter">
          <span>Estado de inscripción</span>
          <select value={enrollmentStatusFilter} onChange={(event) => setEnrollmentStatusFilter(event.target.value as EnrollmentStatusFilter)}>
            {enrollmentStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>
      {!loading && tables.length > 0 && (
        <p className="grade-table-result-count">
          {visibleStudentCount} alumno{visibleStudentCount === 1 ? "" : "s"} en {visibleTables.length} transición{visibleTables.length === 1 ? "" : "es"}
        </p>
      )}
      {loading && <p className="grade-table-message" role="status">Cargando familias, grados y preinscripciones…</p>}
      {!loading && tables.length === 0 && (
        <div className="grade-table-empty">
          <h2>Aún no hay alumnos para mostrar</h2>
          <p>Las familias aparecerán aquí agrupadas por el grado actual y el grado al que avanzan.</p>
        </div>
      )}
      {!loading && tables.length > 0 && visibleTables.length === 0 && (
        <div className="grade-table-empty">
          <h2>No encontramos coincidencias</h2>
          <p>Prueba con otro nombre o cambia los filtros.</p>
        </div>
      )}
      {visibleTables.map((table) => (
        <GradeTransitionTable
          key={JSON.stringify([table.from, table.to, pageResetKey])}
          from={table.from}
          to={table.to}
          rows={table.rows}
          submittedFamilyIds={submittedFamilyIds}
          preEnrollmentStatusLoaded={preEnrollmentStatusLoaded}
          preEnrollmentStatusAvailable={preEnrollmentStatusAvailable}
          enrollments={enrollments}
        />
      ))}
    </section>
  );
}
