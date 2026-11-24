"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { useLiveUpdates } from "@/components/LiveUpdatesProvider";
import { operation, save } from "@/lib/operations/client";
import type { AdmissionCandidate, AdmissionsOverview } from "@/lib/admissions/types";
import type { Bootstrap, Enrollment, EnrollmentProfile, FamilyIntake, FamilySummary, LegacyContractAssignment } from "@/lib/operations/types";
import type { StaffAccess } from "@/lib/auth/access";
import { downloadWorkbook } from "@/lib/admissions/xlsx";
import { FamilyIntakePanel } from "./FamilyIntakePanel";
import { LegacyContractsPanel } from "./LegacyContractsPanel";
import { PreEnrollmentResponsesPanel } from "./PreEnrollmentResponsesPanel";

type Queue = "new" | "returning" | "home" | "families" | "contracts" | "report";
type EnrollmentStatusFilter = "ALL" | "UNENROLLED" | "PENDIENTE_FIRMA" | "PENDIENTE_PAGO" | "ACTIVO" | "INACTIVO" | "RETIRADO";
type FamilySummaryPage = { items: FamilySummary[]; page: number; pageSize: number; total: number; gradeOptions: string[] };
const FAMILY_PAGE_SIZE = 30;

const enrollmentStatusOptions: { value: EnrollmentStatusFilter; label: string }[] = [
  { value: "ALL", label: "Todos los estados" },
  { value: "UNENROLLED", label: "Sin inscripción 2027" },
  { value: "PENDIENTE_FIRMA", label: "Pendiente de firma" },
  { value: "PENDIENTE_PAGO", label: "Pendiente de pago" },
  { value: "ACTIVO", label: "Inscrito" },
  { value: "INACTIVO", label: "Inactivo" },
  { value: "RETIRADO", label: "Retirado" },
];

function enrollmentLabel(status?: string) {
  if (status === "ACTIVO") return "Inscrito";
  if (status === "PENDIENTE_PAGO") return "Pendiente de pago";
  if (status === "PENDIENTE_FIRMA") return "Pendiente de firma";
  if (status === "INACTIVO") return "Inactivo";
  if (status === "RETIRADO") return "Retirado";
  return "Sin inscripción 2027";
}

function nextStep(candidate: AdmissionCandidate, status?: string) {
  if (status === "ACTIVO") return "Inscripción completada";
  if (status === "PENDIENTE_PAGO") return "Continuar en Contabilidad · Caja";
  if (status === "PENDIENTE_FIRMA") return "Revisar contrato y gestionar firma";
  return candidate.historicalContracts > 0 ? "Verificar alumno y actualizar expediente" : "Revisar información e iniciar inscripción";
}

export function AdmissionsWorkspace({ overview, initialFamilyId = null, access }: { overview: AdmissionsOverview; initialFamilyId?: number | null; access: StaffAccess }) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [candidates, setCandidates] = useState<AdmissionCandidate[]>(overview.candidates);
  const [families, setFamilies] = useState<FamilySummary[]>([]);
  const [familyTotal, setFamilyTotal] = useState(0);
  const [familyPage, setFamilyPage] = useState(1);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [familyRefreshVersion, setFamilyRefreshVersion] = useState(0);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [contracts, setContracts] = useState<LegacyContractAssignment[]>([]);
  const [contractsLoaded, setContractsLoaded] = useState(false);
  const [contractsLoading, setContractsLoading] = useState(false);
  const [familyId, setFamilyId] = useState<number | null>(initialFamilyId);
  const [familyDetail, setFamilyDetail] = useState<FamilyIntake | null>(null);
  const [search, setSearch] = useState("");
  const [queue, setQueue] = useState<Queue>("new");
  const [enrollmentStatusFilter, setEnrollmentStatusFilter] = useState<EnrollmentStatusFilter>("ALL");
  const [reportGradeFilter, setReportGradeFilter] = useState("ALL");
  const [reportTypeFilter, setReportTypeFilter] = useState("ALL");
  const [reportStatusFilter, setReportStatusFilter] = useState<EnrollmentStatusFilter>("ALL");
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const { version, area } = useLiveUpdates();

  const reload = useCallback(async () => {
    const problems: string[] = [];
    const [bootstrapResult, enrollmentResult, candidatesResult, familiesResult] = await Promise.allSettled([
      access.enrollments ? operation<Bootstrap>("enrollments/bootstrap?summary=true") : Promise.resolve(null),
      access.enrollments ? operation<Enrollment[]>("enrollments?schoolYear=2027&summary=true") : Promise.resolve(null),
      access.admissions ? operation<{ candidates: AdmissionCandidate[] }>("admission-workflow/2027/overview") : Promise.resolve(null),
      access.admissions ? operation<FamilySummaryPage>("admission-workflow/families/page?page=1&pageSize=1&includeGradeOptions=false") : Promise.resolve(null),
    ]);
    if (!access.enrollments) { setBootstrap(null); setEnrollments([]); }
    else {
      if (bootstrapResult.status === "fulfilled") setBootstrap(bootstrapResult.value);
      else problems.push(bootstrapResult.reason instanceof Error ? bootstrapResult.reason.message : "No se pudo cargar el catálogo de inscripciones.");
      if (enrollmentResult.status === "fulfilled") setEnrollments(enrollmentResult.value ?? []);
      else problems.push(enrollmentResult.reason instanceof Error ? enrollmentResult.reason.message : "No se pudieron cargar las inscripciones.");
    }
    if (access.admissions) {
      if (candidatesResult.status === "fulfilled") setCandidates(candidatesResult.value?.candidates ?? []);
      else problems.push(candidatesResult.reason instanceof Error ? candidatesResult.reason.message : "No se pudieron cargar los alumnos.");
      if (familiesResult.status === "fulfilled") setFamilyTotal(familiesResult.value?.total ?? 0);
      else problems.push(familiesResult.reason instanceof Error ? familiesResult.reason.message : "No se pudieron cargar las familias.");
      setFamilyRefreshVersion((value) => value + 1);
    }
    setError(problems[0] ?? "");
  }, [access.admissions, access.enrollments]);

  const loadContracts = useCallback(async () => {
    if (!access.admissions) return;
    setContractsLoading(true);
    try {
      setContracts(await operation<LegacyContractAssignment[]>("admission-workflow/legacy-contracts"));
      setContractsLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los contratos.");
      setContractsLoaded(true);
    } finally {
      setContractsLoading(false);
    }
  }, [access.admissions]);

  useEffect(() => {
    if (queue !== "families" || !access.admissions) return;
    let active = true;
    const timer = setTimeout(() => {
      setFamilyLoading(true);
      const params = new URLSearchParams({ page: String(familyPage), pageSize: String(FAMILY_PAGE_SIZE), includeGradeOptions: "false" });
      if (search.trim()) params.set("q", search.trim());
      void operation<FamilySummaryPage>(`admission-workflow/families/page?${params.toString()}`)
        .then((result) => {
          if (!active) return;
          setFamilies(result.items ?? []);
          setFamilyTotal(result.total ?? 0);
        })
        .catch((cause) => {
          if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar las familias.");
        })
        .finally(() => { if (active) setFamilyLoading(false); });
    }, 160);
    return () => { active = false; clearTimeout(timer); };
  }, [access.admissions, familyPage, familyRefreshVersion, queue, search]);

  const refreshEnrollmentData = useCallback(async () => {
    const [enrollmentResult, candidatesResult, familiesResult] = await Promise.allSettled([
      access.enrollments ? operation<Enrollment[]>("enrollments?schoolYear=2027&summary=true") : Promise.resolve(null),
      access.admissions ? operation<{ candidates: AdmissionCandidate[] }>("admission-workflow/2027/overview") : Promise.resolve(null),
      access.admissions ? operation<FamilySummaryPage>("admission-workflow/families/page?page=1&pageSize=1&includeGradeOptions=false") : Promise.resolve(null),
    ]);
    const problems: string[] = [];
    if (access.enrollments) {
      if (enrollmentResult.status === "fulfilled") setEnrollments(enrollmentResult.value ?? []);
      else problems.push(enrollmentResult.reason instanceof Error ? enrollmentResult.reason.message : "No se pudieron actualizar las inscripciones.");
    }
    if (access.admissions) {
      if (candidatesResult.status === "fulfilled") setCandidates(candidatesResult.value?.candidates ?? []);
      else problems.push(candidatesResult.reason instanceof Error ? candidatesResult.reason.message : "No se pudieron actualizar los alumnos.");
      if (familiesResult.status === "fulfilled") setFamilyTotal(familiesResult.value?.total ?? 0);
      else problems.push(familiesResult.reason instanceof Error ? familiesResult.reason.message : "No se pudieron actualizar las familias.");
      setFamilyRefreshVersion((value) => value + 1);
    }
    setError(problems[0] ?? "");
  }, [access.admissions, access.enrollments]);

  const refreshAdmissions = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await reload();
      if (queue === "contracts") await loadContracts();
    }
    finally { setRefreshing(false); }
  }, [refreshing, reload, queue, loadContracts]);

  useEffect(() => { const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer); }, [reload]);
  useEffect(() => {
    if (queue !== "contracts" || contractsLoaded || !access.admissions) return;
    void loadContracts();
  }, [queue, contractsLoaded, access.admissions, loadContracts]);
  useEffect(() => {
    if (!version || (area && area !== "ENROLLMENTS" && !(area === "ADMISSIONS" && queue === "contracts"))) return;
    const timer = setTimeout(() => {
      if (area === "ENROLLMENTS") void refreshEnrollmentData();
      else {
        void reload();
        if (queue === "contracts") void loadContracts();
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [version, area, reload, refreshEnrollmentData, queue, loadContracts]);

  const allCandidates = useMemo(() => {
    const existing = new Set(candidates.map((candidate) => candidate.id));
    const linkedCandidates = candidates;
    const registrations = enrollments.filter((item) => !existing.has(item.studentId)).map((item): AdmissionCandidate => ({
      id: item.studentId,
      uuid: item.studentUuid,
      firstName: item.studentFirstName || "Alumno",
      lastName: item.studentLastName || "",
      currentGrade: null,
      proposedGrade: item.gradeName,
      familyId: null,
      familyName: String(item.profile?.familyName || "") || null,
      familyReviewStatus: null,
      representativeName: String(item.profile?.representativeName || "") || null,
      historicalContracts: 0,
      status: "REVIEW",
    }));
    return [...linkedCandidates, ...registrations];
  }, [candidates, enrollments]);

  const enrollmentByStudent = useMemo(() => new Map(enrollments.map((item) => [item.studentId, item])), [enrollments]);
  const enrollmentStatuses = useMemo(() => new Map(enrollments.map((item) => [item.studentId, item.status])), [enrollments]);
  const enrolledIds = useMemo(() => new Set(enrollments.filter((item) => item.status === "ACTIVO").map((item) => item.studentId)), [enrollments]);
  const candidatesByFamilyId = useMemo(() => {
    const grouped = new Map<number, AdmissionCandidate[]>();
    for (const candidate of allCandidates) {
      if (candidate.familyId == null) continue;
      const children = grouped.get(candidate.familyId) ?? [];
      children.push(candidate);
      grouped.set(candidate.familyId, children);
    }
    return grouped;
  }, [allCandidates]);
  const familyCards = useMemo(() => families.map((family) => {
    const children = candidatesByFamilyId.get(family.id) ?? [];
    const enrolled = children.filter((child) => enrolledIds.has(child.id)).length;
    return { ...family, children, enrolled, pending: children.length - enrolled };
  }), [families, candidatesByFamilyId, enrolledIds]);
  const newStudents = allCandidates.filter((candidate) => candidate.historicalContracts === 0);
  const returningStudents = allCandidates.filter((candidate) => candidate.historicalContracts > 0);
  const pendingSteps = enrollments.filter((item) => item.status === "PENDIENTE_FIRMA" || item.status === "PENDIENTE_PAGO").length;
  const unassigned = allCandidates.filter((candidate) => candidate.familyId == null);
  const selectedFamily = familyDetail?.id === familyId ? familyDetail : null;
  const familyPageCount = Math.max(1, Math.ceil(familyTotal / FAMILY_PAGE_SIZE));
  const visibleFamilies = familyCards;
  const grades = [...new Set([
    ...allCandidates.map((candidate) => candidate.currentGrade),
    ...bootstrap?.gradeLevels.map((grade) => grade.name) ?? [],
  ].filter((grade): grade is string => Boolean(grade?.trim())))].sort((a, b) => a.localeCompare(b, "es"));
  const reportRows = useMemo(() => allCandidates.filter((candidate) => candidate.status !== "GRADUATED").map((candidate) => {
    const enrollment = enrollmentByStudent.get(candidate.id);
    return {
      candidate,
      enrollment,
      type: candidate.historicalContracts > 0 ? "REINSCRIPTION" : "NEW",
      status: enrollment?.status ?? "UNENROLLED",
      grade: enrollment?.gradeName || candidate.proposedGrade || candidate.currentGrade || "Grado pendiente",
    };
  }), [allCandidates, enrollmentByStudent]);
  const visibleReportRows = reportRows.filter(({ candidate, type, status, grade }) => {
    const searchText = `${candidate.firstName} ${candidate.lastName} ${candidate.familyName ?? ""} ${grade} ${candidate.representativeName ?? ""}`;
    return (reportGradeFilter === "ALL" || grade === reportGradeFilter)
      && (reportTypeFilter === "ALL" || type === reportTypeFilter)
      && (reportStatusFilter === "ALL" || status === reportStatusFilter)
      && searchText.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"));
  });
  const activeEnrollmentCount = reportRows.filter((row) => row.status === "ACTIVO").length;
  const activeNewCount = reportRows.filter((row) => row.status === "ACTIVO" && row.type === "NEW").length;
  const activeReturningCount = reportRows.filter((row) => row.status === "ACTIVO" && row.type === "REINSCRIPTION").length;
  const noEnrollmentCount = reportRows.filter((row) => row.status === "UNENROLLED").length;

  const loadFamily = useCallback(async (id: number) => {
    try {
      const detail = await operation<FamilyIntake>(`admission-workflow/families/${id}`);
      const firstWithContract = allCandidates.find((candidate) => candidate.familyId === id && candidate.historicalContracts > 0);
      if (firstWithContract && !detail.profile.representativeFirstName) {
        const legacy = await operation<Record<string, string | number | null>>(`admission-workflow/students/${firstWithContract.id}/legacy-contract`).catch(() => null);
        if (legacy) detail.profile = {
          ...Object.fromEntries(Object.entries(legacy).filter(([key, value]) => key.startsWith("representative") && value != null)),
          ...detail.profile,
        };
      }
      setFamilyDetail(detail);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo abrir el expediente familiar."); }
  }, [allCandidates]);

  useEffect(() => {
    if (familyId == null || !access.admissions) return;
    void loadFamily(familyId);
  }, [familyId, access.admissions, version, loadFamily]);

  async function openFamily(id: number) {
    setFamilyId(id);
    setFamilyDetail(null);
    setError("");
  }

  function openRegistration(options: { familyId?: number; studentId?: number; mode?: "reinscription" | "new" } = {}) {
    if (!access.enrollments || !access.admissions) return;
    const params = new URLSearchParams();
    if (options.familyId) params.set("familyId", String(options.familyId));
    if (options.studentId) params.set("studentId", String(options.studentId));
    if (options.mode) params.set("mode", options.mode);
    const query = params.toString();
    window.open(`/inscripciones/nueva${query ? `?${query}` : ""}`, "_blank", "noopener,noreferrer");
  }

  function openChild(candidate: AdmissionCandidate | null, profile: EnrollmentProfile) {
    if (!access.enrollments) return;
    const params = new URLSearchParams();
    if (familyId) params.set("familyId", String(familyId));
    if (candidate) params.set("studentId", String(candidate.id));
    params.set("mode", candidate ? "reinscription" : "new");
    // Keep the family details in the existing saved family record. The admission form loads that record by id.
    void profile;
    window.open(`/inscripciones/nueva?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  async function attachStudent(studentId: number) {
    if (!familyId) return;
    try { await save(`admission-workflow/families/${familyId}/students/${studentId}`, {}); await reload(); await loadFamily(familyId); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo vincular al alumno."); }
  }

  const queueStudents = queue === "new" ? newStudents : returningStudents;
  const visibleQueueStudents = queueStudents.filter((student) => {
    const status = enrollmentStatuses.get(student.id);
    const matchesStatus = enrollmentStatusFilter === "ALL"
      || (enrollmentStatusFilter === "UNENROLLED" ? !status : status === enrollmentStatusFilter);
    const searchText = `${student.firstName} ${student.lastName} ${student.familyName ?? ""} ${student.currentGrade ?? ""} ${student.proposedGrade ?? ""}`;
    return matchesStatus && searchText.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"));
  });

  function downloadAdmissionReport() {
    downloadWorkbook(`seguimiento-inscripciones-2027-${new Date().toISOString().slice(0, 10)}.xlsx`, "Inscripciones 2027", [
      ["Alumno", "Familia", "Tipo de ingreso", "Grado 2027", "Estado de inscripción", "Representante", "Historial de contratos"],
      ...visibleReportRows.map(({ candidate, type, status, grade }) => [
        `${candidate.firstName} ${candidate.lastName}`.trim(), candidate.familyName ?? "", type === "NEW" ? "Nuevo ingreso" : "Reinscripción", grade,
        enrollmentLabel(status === "UNENROLLED" ? undefined : status), candidate.representativeName ?? "", candidate.historicalContracts,
      ]),
    ]);
  }

  return (
    <WorkspaceShell current={selectedFamily ? "Expediente familiar" : "Inscripciones"} access={access}>
      {selectedFamily ? (
        <FamilyIntakePanel
          key={selectedFamily.id}
          family={selectedFamily}
          students={allCandidates.filter((candidate) => candidate.familyId === selectedFamily.id)}
          unassigned={unassigned}
          enrollmentStatuses={enrollmentStatuses}
          enrollments={enrollments}
          canManageEnrollment={access.enrollments}
          onBack={() => { setFamilyId(null); setFamilyDetail(null); }}
          onUpdated={setFamilyDetail}
          onOpenChild={openChild}
          onAttachStudent={attachStudent}
        />
      ) : (
        <>
          <header className="admissions-workspace-hero">
            <div className="hero-copy">
              <span className="eyebrow">PANEL DEL PERSONAL · CICLO ESCOLAR 2027</span>
              <h1>Atención de inscripciones</h1>
              <p>Organiza alumnos nuevos y reinscripciones, revisa formularios completados desde casa y continúa cada expediente con la familia.</p>
              <div className="admissions-workspace-actions">
                <button className="button button-soft admissions-refresh-button" type="button" onClick={() => void refreshAdmissions()} disabled={refreshing} aria-label="Actualizar inscripciones">
                  <AppIcon name="refresh" size={18} /> {refreshing ? "Actualizando…" : "Actualizar"}
                </button>
                {access.enrollments && <button className="button button-primary" type="button" onClick={() => openRegistration({ mode: "new" })}><AppIcon name="plus" size={19} /> Registrar alumno nuevo</button>}
              </div>
              {!access.enrollments && <p className="access-hint">Tu cuenta puede revisar expedientes. Para crear inscripciones, solicita el permiso de Inscripciones.</p>}
            </div>
            <div className="hero-art"><div className="art-ring"><AppIcon name="users" size={68} /></div></div>
          </header>

          <section className="workflow-guide" aria-label="Flujo interno de inscripción">
            <div className="workflow-guide-heading"><div><span className="eyebrow">FLUJO DE ATENCIÓN DEL COLEGIO</span><h2>Un expediente, pasos claros y áreas responsables</h2></div><span>El formulario desde casa es una entrada al mismo proceso.</span></div>
            <div className="workflow-track">
              <article><strong>Alumnos nuevos</strong><p>Contacto y orientación → formulario en colegio o desde casa → visita y atención → inscripción → documentos → firma → pago → libros y uniformes.</p><small>Recepción · Inscripción · Secretaría · Ventas · Contabilidad</small></article>
              <article><strong>Alumnos antiguos</strong><p>Recepción → verificar alumno y solvencia → actualizar datos → reinscripción → firma → pago → libros y uniformes.</p><small>Recepción · Fiscalización · Secretaría · Ventas · Contabilidad</small></article>
            </div>
            <div className="workflow-responsibilities"><span><strong>Secretaría:</strong> papelería, expediente y materiales.</span><span><strong>Fiscalización:</strong> solvencia, cambios de datos, listados y materiales.</span></div>
          </section>

          <div className="station-stats">
            <div><span className="stat-icon blue"><AppIcon name="users" /></span><span><small>Familias atendidas</small><strong>{familyTotal}</strong></span></div>
            <div><span className="stat-icon coral"><AppIcon name="plus" /></span><span><small>Alumnos nuevos</small><strong>{newStudents.length}</strong></span></div>
            <div><span className="stat-icon violet"><AppIcon name="users" /></span><span><small>Reinscripciones</small><strong>{returningStudents.length}</strong></span></div>
            <div><span className="stat-icon mint"><AppIcon name="clock" /></span><span><small>Firma o pago pendiente</small><strong>{pendingSteps}</strong></span></div>
          </div>

          {error && <p className="alert-error" role="alert">{error}</p>}
          {bootstrap && !bootstrap.schoolYears.some((item) => item.year === 2027) && <p className="alert-error" role="alert">El ciclo 2027 todavía no está creado en el API escolar.</p>}

          <section className="work-section admissions-inbox">
            <div className="section-heading"><div><span className="eyebrow">BANDEJA DE TRABAJO</span><h2>¿Qué proceso vas a atender?</h2></div>
              {queue !== "home" && queue !== "report" && <div className="queue-tools">
                {(queue === "new" || queue === "returning") && <label className="queue-status-filter"><span>Estado de inscripción</span><select value={enrollmentStatusFilter} onChange={(event) => setEnrollmentStatusFilter(event.target.value as EnrollmentStatusFilter)}>{enrollmentStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>}
                <label className="search-field queue-search"><AppIcon name="search" size={19} /><input value={search} onChange={(event) => { setSearch(event.target.value); if (queue === "families") setFamilyPage(1); }} placeholder={queue === "contracts" ? "Alumno, representante o contrato" : "Buscar alumno o familia"} /></label>
              </div>}
            </div>
            <div className="large-tabs admissions-tabs" role="tablist" aria-label="Procesos de inscripción">
              <button role="tab" aria-selected={queue === "new"} onClick={() => { setQueue("new"); setSearch(""); }}>Alumnos nuevos <span>{newStudents.length}</span></button>
              <button role="tab" aria-selected={queue === "returning"} onClick={() => { setQueue("returning"); setSearch(""); }}>Reinscripción <span>{returningStudents.length}</span></button>
              <button role="tab" aria-selected={queue === "home"} onClick={() => setQueue("home")}>Desde casa</button>
              <button role="tab" aria-selected={queue === "families"} onClick={() => { setQueue("families"); setSearch(""); setFamilyPage(1); }}>Familias <span>{familyTotal}</span></button>
              <button role="tab" aria-selected={queue === "contracts"} onClick={() => { setQueue("contracts"); setSearch(""); }}>Contratos <span>{contracts.length}</span></button>
              {access.isAdmin && <button role="tab" aria-selected={queue === "report"} onClick={() => { setQueue("report"); setSearch(""); }}>Seguimiento <span>{reportRows.length}</span></button>}
            </div>

            {queue === "report" && access.isAdmin && <section className="enrollment-report" aria-label="Seguimiento de inscripciones 2027">
              <div className="enrollment-report-heading"><div><span className="eyebrow">ADMINISTRACIÓN · CICLO 2027</span><h3>Seguimiento de inscripciones</h3><p>Consulta por grado, tipo de ingreso y avance de inscripción.</p></div><button className="button button-primary" type="button" onClick={downloadAdmissionReport} disabled={visibleReportRows.length === 0}><AppIcon name="download" size={18} /> Descargar Excel</button></div>
              <div className="enrollment-report-stats"><article><small>Inscritos</small><strong>{activeEnrollmentCount}</strong></article><article><small>Nuevo ingreso inscrito</small><strong>{activeNewCount}</strong></article><article><small>Reinscripción inscrita</small><strong>{activeReturningCount}</strong></article><article><small>Pendiente de firma</small><strong>{reportRows.filter((row) => row.status === "PENDIENTE_FIRMA").length}</strong></article><article><small>Pendiente de pago</small><strong>{reportRows.filter((row) => row.status === "PENDIENTE_PAGO").length}</strong></article><article><small>Sin inscripción</small><strong>{noEnrollmentCount}</strong></article></div>
              <div className="enrollment-report-filters"><label>Buscar<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Alumno, familia o representante" /></label><label>Grado<select value={reportGradeFilter} onChange={(event) => setReportGradeFilter(event.target.value)}><option value="ALL">Todos los grados</option>{[...new Set(reportRows.map((row) => row.grade))].sort((a, b) => a.localeCompare(b, "es")).map((grade) => <option key={grade}>{grade}</option>)}</select></label><label>Ingreso<select value={reportTypeFilter} onChange={(event) => setReportTypeFilter(event.target.value)}><option value="ALL">Nuevo y reinscripción</option><option value="NEW">Nuevo ingreso</option><option value="REINSCRIPTION">Reinscripción</option></select></label><label>Estado<select value={reportStatusFilter} onChange={(event) => setReportStatusFilter(event.target.value as EnrollmentStatusFilter)}>{enrollmentStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
              <div className="enrollment-report-table-wrap"><table className="enrollment-report-table"><thead><tr><th>Alumno</th><th>Familia</th><th>Ingreso</th><th>Grado 2027</th><th>Estado</th><th>Representante</th></tr></thead><tbody>{visibleReportRows.map(({ candidate, type, status, grade }) => <tr key={candidate.id}><td><strong>{candidate.firstName} {candidate.lastName}</strong></td><td>{candidate.familyName || "Sin familia vinculada"}</td><td><span className={`enrollment-report-type ${type === "NEW" ? "new" : "returning"}`}>{type === "NEW" ? "Nuevo ingreso" : "Reinscripción"}</span></td><td>{grade}</td><td><span className={`status-pill ${status === "ACTIVO" ? "success" : "waiting"}`}>{enrollmentLabel(status === "UNENROLLED" ? undefined : status)}</span></td><td>{candidate.representativeName || "—"}</td></tr>)}</tbody></table>{visibleReportRows.length === 0 && <div className="empty-state"><h3>No hay resultados para estos filtros</h3><p>Prueba con otro grado, tipo de ingreso o estado.</p></div>}</div>
              <div className="enrollment-report-footer"><span>{visibleReportRows.length} de {reportRows.length} alumnos</span><span>Los estados corresponden a las inscripciones guardadas en el ciclo 2027.</span></div>
            </section>}

            {queue === "home" && <PreEnrollmentResponsesPanel grades={grades} onOpenFamily={(id) => void openFamily(id)} />}
            {(queue === "new" || queue === "returning") && <div className="admission-queue-list">
              {visibleQueueStudents.map((student) => {
                const enrollment = enrollmentByStudent.get(student.id);
                const status = enrollmentStatuses.get(student.id);
                return <article className="admission-queue-row" key={student.id}>
                  <span className={`avatar ${queue === "new" ? "blue" : "mint"}`}>{student.firstName.slice(0, 1)}{student.lastName.slice(0, 1)}</span>
                  <div className="admission-queue-person"><strong>{student.firstName} {student.lastName}</strong><small>{student.familyName || "Familia por vincular"} · {student.currentGrade || student.proposedGrade || "Grado por confirmar"}</small><span>{nextStep(student, status)}</span></div>
                  <span className={`status-pill ${status === "ACTIVO" ? "success" : "waiting"}`}>{enrollmentLabel(status)}</span>
                  <div className="admission-queue-actions">
                    {student.familyId ? <button className="button button-soft" type="button" onClick={() => void openFamily(student.familyId!)}>Abrir familia</button> : <button className="button button-soft" type="button" disabled={!access.enrollments} onClick={() => openRegistration({ studentId: student.id, mode: queue === "returning" ? "reinscription" : "new" })}>{access.enrollments ? "Abrir inscripción" : "Sin permiso"}</button>}
                    {enrollment?.studentUuid && status === "ACTIVO" && <><a className="button button-soft" href={`/libros?studentUuid=${encodeURIComponent(enrollment.studentUuid)}`}>Libros</a><a className="button button-soft" href={`/uniformes?studentUuid=${encodeURIComponent(enrollment.studentUuid)}`}>Uniformes</a></>}
                    {enrollment?.status === "PENDIENTE_PAGO" && access.finance && <a className="button button-soft" href="/caja">Ir a Caja</a>}
                  </div>
                </article>;
              })}
              {!access.enrollments && <p className="muted">El personal con permiso de Inscripciones puede iniciar el registro y administrar los datos de cada alumno.</p>}
              {visibleQueueStudents.length === 0 && <div className="empty-state"><h3>No hay alumnos en esta bandeja</h3><p>{enrollmentStatusFilter !== "ALL" ? "Prueba con otro estado de inscripción o cambia la búsqueda." : "Registra un alumno nuevo o revisa las respuestas que llegaron desde casa."}</p></div>}
              {unassigned.length > 0 && <div className="unassigned-summary"><strong>{unassigned.length} alumno{unassigned.length === 1 ? "" : "s"} sin familia vinculada</strong><span>Abre cada inscripción y confirma a qué expediente familiar pertenece.</span></div>}
            </div>}

            {queue === "families" && <>
              {familyLoading && <p className="muted" role="status">Cargando familias…</p>}
              <div className="family-card-grid">
                {visibleFamilies.map((family) => <button className="family-card" type="button" key={family.id} onClick={() => void openFamily(family.id)}>
                  <span className="avatar blue">{family.name.slice(0, 2).toLocaleUpperCase("es")}</span><span className="family-card-copy"><strong>{family.name}</strong><small>{family.children.length} alumno{family.children.length === 1 ? "" : "s"}</small><em>{family.children.map((child) => child.firstName).join(", ") || "Sin alumnos todavía"}</em></span>
                  <span className={`status-pill ${family.pending ? "waiting" : "success"}`}>{family.pending ? `${family.pending} por revisar` : family.children.length ? "Completa" : "Sin alumnos"}</span><AppIcon name="arrow" size={18} />
                </button>)}
              </div>
              {!familyLoading && visibleFamilies.length === 0 && <div className="empty-state"><h3>No hay familias que coincidan</h3></div>}
              {familyTotal > FAMILY_PAGE_SIZE && <div className="response-pagination"><button className="button button-soft" type="button" disabled={familyPage <= 1 || familyLoading} onClick={() => setFamilyPage((current) => Math.max(1, current - 1))}>← Anterior</button><span>Página {familyPage} de {familyPageCount}</span><button className="button button-soft" type="button" disabled={familyPage >= familyPageCount || familyLoading} onClick={() => setFamilyPage((current) => Math.min(familyPageCount, current + 1))}>Siguiente →</button></div>}
            </>}

            {queue === "contracts" && <LegacyContractsPanel contracts={contracts} loading={contractsLoading} search={search} openableStudentIds={new Set(allCandidates.map((item) => item.id))} onOpenStudent={(id) => {
              const candidate = allCandidates.find((item) => item.id === id);
              if (candidate?.familyId) void openFamily(candidate.familyId);
            }} />}
          </section>
        </>
      )}
    </WorkspaceShell>
  );
}
