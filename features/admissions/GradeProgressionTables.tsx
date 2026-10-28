"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { operation } from "@/lib/operations/client";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import type { Bootstrap, Enrollment, FamilySummary, PreEnrollmentSubmissionPage } from "@/lib/operations/types";

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
const RESPONSE_PAGE_SIZE = 100;

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

function reinscriptionHref(student: AdmissionCandidate) {
  return `/inscripciones/reinscripcion/alumno/${student.id}`;
}

async function loadSubmittedFamilyIds() {
  const firstPage = await operation<PreEnrollmentSubmissionPage>(
    `admission-workflow/pre-enrollment-responses?page=1&pageSize=${RESPONSE_PAGE_SIZE}&decision=all&sort=newest`,
  );
  const pages = [firstPage];
  const pageCount = Math.ceil(firstPage.total / RESPONSE_PAGE_SIZE);

  for (let firstPageNumber = 2; firstPageNumber <= pageCount; firstPageNumber += 5) {
    const pageNumbers = Array.from(
      { length: Math.min(5, pageCount - firstPageNumber + 1) },
      (_, index) => firstPageNumber + index,
    );
    const batch = await Promise.all(pageNumbers.map((page) =>
      operation<PreEnrollmentSubmissionPage>(
        `admission-workflow/pre-enrollment-responses?page=${page}&pageSize=${RESPONSE_PAGE_SIZE}&decision=all&sort=newest`,
      ),
    ));
    pages.push(...batch);
  }

  return new Set(pages.flatMap((page) => page.items.map((submission) => submission.familyId)));
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
              const enrollmentStatus = enrollment?.status === "ACTIVO" ? "Inscrito" : enrollment?.status === "PENDIENTE_FIRMA" ? "Por firmar" : "No inscrito";
              return (
                <tr key={student.id}>
                  <td>{student.familyName || "Familia sin vincular"}</td>
                  <td>{`${student.firstName} ${student.lastName}`.trim()}</td>
                  <td><span className={`pre-enrollment-status ${status.className}`}>{status.label}</span></td>
                  <td><span className={`pre-enrollment-status ${enrollment?.status === "ACTIVO" ? "complete" : enrollment ? "pending" : "unlinked"}`}>{enrollmentStatus}</span></td>
                  <td>
                    <div className="grade-table-actions">
                      <Link className="grade-row-action" href={reinscriptionHref(student)}>Iniciar reinscripción</Link>
                      {student.familyId && <a className="grade-row-action secondary" href={`/inscripciones/familias/${student.familyId}`}>Ficha de datos</a>}
                      {enrollment && <a className="grade-row-action secondary" href={`/api/operations/enrollments/${enrollment.id}/contract.pdf`} target="_blank" rel="noreferrer">Imprimir contrato</a>}
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
  const [families, setFamilies] = useState<FamilySummary[]>([]);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [submittedFamilyIds, setSubmittedFamilyIds] = useState<Set<number> | null>(null);
  const [preEnrollmentStatusLoaded, setPreEnrollmentStatusLoaded] = useState(false);
  const [preEnrollmentStatusAvailable, setPreEnrollmentStatusAvailable] = useState(false);
  const [search, setSearch] = useState("");
  const [transitionFilter, setTransitionFilter] = useState("all");
  const [preEnrollmentFilter, setPreEnrollmentFilter] = useState("all");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const errors: string[] = [];
      const [familyResult, bootstrapResult, preEnrollmentResult] = await Promise.allSettled([
        operation<FamilySummary[]>("admission-workflow/families"),
        operation<Bootstrap>("enrollments/bootstrap"),
        loadSubmittedFamilyIds(),
      ]);

      const nextFamilies = familyResult.status === "fulfilled" ? familyResult.value : [];
      let nextBootstrap: Bootstrap | null = null;
      let nextEnrollments: Enrollment[] = [];

      if (familyResult.status === "rejected") {
        errors.push(familyResult.reason instanceof Error ? familyResult.reason.message : "No se pudieron cargar las familias.");
      }
      const nextSubmittedFamilyIds = preEnrollmentResult.status === "fulfilled" ? preEnrollmentResult.value : null;
      if (preEnrollmentResult.status === "rejected") {
        errors.push(preEnrollmentResult.reason instanceof Error ? preEnrollmentResult.reason.message : "No se pudo consultar el estado de las preinscripciones.");
      }
      if (bootstrapResult.status === "fulfilled") {
        nextBootstrap = bootstrapResult.value;
        const schoolYear = nextBootstrap.schoolYears.find((item) => item.year === 2027);
        if (schoolYear) {
          try {
            nextEnrollments = await operation<Enrollment[]>(`enrollments?schoolYearId=${schoolYear.id}`);
          } catch (cause) {
            errors.push(cause instanceof Error ? cause.message : "No se pudieron cargar las inscripciones del ciclo 2027.");
          }
        } else {
          errors.push("El ciclo escolar 2027 no está configurado en el catálogo de inscripciones.");
        }
      } else {
        errors.push(bootstrapResult.reason instanceof Error ? bootstrapResult.reason.message : "No se pudo cargar el catálogo de grados.");
      }

      if (!cancelled) {
        setFamilies(nextFamilies);
        setBootstrap(nextBootstrap);
        setEnrollments(nextEnrollments);
        setSubmittedFamilyIds(nextSubmittedFamilyIds);
        setPreEnrollmentStatusLoaded(true);
        setPreEnrollmentStatusAvailable(preEnrollmentResult.status === "fulfilled");
        setLoadError(errors.join(" "));
        setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tables = useMemo(() => {
    const familyByStudent = new Map<number, { familyId: number; familyName: string; currentGrade: string | null }>();
    for (const family of families) {
      for (const student of family.activeStudents ?? []) {
        if (student.studentId != null) {
          familyByStudent.set(student.studentId, {
            familyId: family.id,
            familyName: family.name,
            currentGrade: student.currentGrade,
          });
        }
      }
    }

    const enrollmentByStudent = new Map(enrollments.map((enrollment) => [enrollment.studentId, enrollment]));
    const students = new Map<number, AdmissionCandidate>();

    for (const candidate of initialCandidates) {
      const linkedFamily = familyByStudent.get(candidate.id);
      const enrollment = enrollmentByStudent.get(candidate.id);
      students.set(candidate.id, {
        ...candidate,
        familyId: linkedFamily?.familyId ?? candidate.familyId ?? null,
        familyName: linkedFamily?.familyName || candidate.familyName || null,
        currentGrade: candidate.currentGrade || linkedFamily?.currentGrade || null,
        proposedGrade: candidate.proposedGrade || enrollment?.gradeName || null,
      });
    }

    for (const enrollment of enrollments) {
      if (students.has(enrollment.studentId)) continue;
      const linkedFamily = familyByStudent.get(enrollment.studentId);
      const profileFamilyName = String(enrollment.profile?.familyName ?? "").trim();
      students.set(enrollment.studentId, {
        id: enrollment.studentId,
        uuid: enrollment.studentUuid,
        firstName: enrollment.studentFirstName || "Alumno",
        lastName: enrollment.studentLastName || "",
        currentGrade: linkedFamily?.currentGrade ?? null,
        proposedGrade: enrollment.gradeName,
        familyId: linkedFamily?.familyId ?? null,
        familyName: linkedFamily?.familyName || profileFamilyName || null,
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
  }, [bootstrap, enrollments, families, initialCandidates]);

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
          return matchesTransition && matchesSearch && matchesPreEnrollment;
        }),
      }))
      .filter((table) => table.rows.length > 0);
  }, [tables, search, transitionFilter, preEnrollmentFilter, preEnrollmentStatusLoaded, preEnrollmentStatusAvailable, submittedFamilyIds]);

  const visibleStudentCount = visibleTables.reduce((total, table) => total + table.rows.length, 0);
  const pageResetKey = `${normalizeSearch(search)}\u0000${transitionFilter}\u0000${preEnrollmentFilter}`;

  return (
    <section className="grade-tables-section" aria-label="Familias agrupadas por transición de grado">
      {(initialError || loadError) && <p className="grade-table-alert" role="alert">{initialError || loadError}</p>}
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
