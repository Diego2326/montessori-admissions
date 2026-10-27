"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { useLiveUpdates } from "@/components/LiveUpdatesProvider";
import { operation, save } from "@/lib/operations/client";
import type { AdmissionCandidate, AdmissionsOverview } from "@/lib/admissions/types";
import type { Bootstrap, Enrollment, FamilyIntake, FamilySummary, LegacyContractAssignment } from "@/lib/operations/types";
import type { StaffAccess } from "@/lib/auth/access";
import { FamilyIntakePanel } from "./FamilyIntakePanel";
import { LegacyContractsPanel } from "./LegacyContractsPanel";
import { PreEnrollmentResponsesPanel } from "./PreEnrollmentResponsesPanel";

type Queue = "new" | "returning" | "home" | "families" | "contracts";

function enrollmentLabel(status?: string) {
  if (status === "ACTIVO") return "Inscrito";
  if (status === "PENDIENTE_PAGO") return "Pendiente de pago";
  if (status === "PENDIENTE_FIRMA") return "Pendiente de firma";
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
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [contracts, setContracts] = useState<LegacyContractAssignment[]>([]);
  const [familyId, setFamilyId] = useState<number | null>(initialFamilyId);
  const [familyDetail, setFamilyDetail] = useState<FamilyIntake | null>(null);
  const [search, setSearch] = useState("");
  const [queue, setQueue] = useState<Queue>("new");
  const [error, setError] = useState("");
  const { version, area } = useLiveUpdates();

  const reload = useCallback(async () => {
    const problems: string[] = [];
    if (access.enrollments) {
      const result = await Promise.allSettled([operation<Bootstrap>("enrollments/bootstrap")]);
      if (result[0].status === "fulfilled") {
        const nextBootstrap = result[0].value;
        const year = nextBootstrap.schoolYears.find((item) => item.year === 2027);
        setBootstrap(nextBootstrap);
        if (year) {
          try { setEnrollments(await operation<Enrollment[]>(`enrollments?schoolYearId=${year.id}`)); }
          catch (cause) { problems.push(cause instanceof Error ? cause.message : "No se pudieron cargar las inscripciones."); }
        } else setEnrollments([]);
      } else problems.push(result[0].reason instanceof Error ? result[0].reason.message : "No se pudo cargar el catálogo de inscripciones.");
    } else {
      setBootstrap(null);
      setEnrollments([]);
    }
    if (access.admissions) {
      const results = await Promise.allSettled([
        operation<{ candidates: AdmissionCandidate[] }>("admission-workflow/2027/overview"),
        operation<FamilySummary[]>("admission-workflow/families"),
        operation<LegacyContractAssignment[]>("admission-workflow/legacy-contracts"),
      ]);
      if (results[0].status === "fulfilled") setCandidates(results[0].value.candidates);
      else problems.push(results[0].reason instanceof Error ? results[0].reason.message : "No se pudieron cargar los alumnos.");
      if (results[1].status === "fulfilled") setFamilies(results[1].value);
      else problems.push(results[1].reason instanceof Error ? results[1].reason.message : "No se pudieron cargar las familias.");
      if (results[2].status === "fulfilled") setContracts(results[2].value);
      else problems.push(results[2].reason instanceof Error ? results[2].reason.message : "No se pudieron cargar los contratos.");
    }
    setError(problems[0] ?? "");
  }, [access.admissions, access.enrollments]);

  useEffect(() => { const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer); }, [reload]);
  useEffect(() => {
    if (!version || (area && area !== "ENROLLMENTS")) return;
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [version, area, reload]);

  const allCandidates = useMemo(() => {
    const familyStudentMap = new Map<number, { familyId: number; familyName: string; currentGrade: string | null }>();
    for (const family of families) {
      for (const student of family.activeStudents ?? []) {
        if (student.studentId != null) familyStudentMap.set(student.studentId, { familyId: family.id, familyName: family.name, currentGrade: student.currentGrade });
      }
    }
    const existing = new Set(candidates.map((candidate) => candidate.id));
    const linkedCandidates = candidates.map((candidate) => {
      const linkedFamily = familyStudentMap.get(candidate.id);
      return {
        ...candidate,
        familyId: candidate.familyId ?? linkedFamily?.familyId ?? null,
        familyName: candidate.familyName ?? linkedFamily?.familyName ?? null,
        currentGrade: candidate.currentGrade ?? linkedFamily?.currentGrade ?? null,
      };
    });
    const registrations = enrollments.filter((item) => !existing.has(item.studentId)).map((item): AdmissionCandidate => ({
      id: item.studentId,
      uuid: item.studentUuid,
      firstName: item.studentFirstName || "Alumno",
      lastName: item.studentLastName || "",
      currentGrade: familyStudentMap.get(item.studentId)?.currentGrade ?? null,
      proposedGrade: item.gradeName,
      familyId: familyStudentMap.get(item.studentId)?.familyId ?? null,
      familyName: familyStudentMap.get(item.studentId)?.familyName ?? (String(item.profile?.familyName || "") || null),
      familyReviewStatus: null,
      representativeName: String(item.profile?.representativeName || "") || null,
      historicalContracts: 0,
      status: "REVIEW",
    }));
    return [...linkedCandidates, ...registrations];
  }, [candidates, enrollments, families]);

  const enrollmentByStudent = useMemo(() => new Map(enrollments.map((item) => [item.studentId, item])), [enrollments]);
  const enrollmentStatuses = useMemo(() => new Map(enrollments.map((item) => [item.studentId, item.status])), [enrollments]);
  const enrolledIds = useMemo(() => new Set(enrollments.filter((item) => item.status === "ACTIVO").map((item) => item.studentId)), [enrollments]);
  const familyCards = useMemo(() => families.map((family) => {
    const children = allCandidates.filter((candidate) => candidate.familyId === family.id);
    const enrolled = children.filter((child) => enrolledIds.has(child.id)).length;
    return { ...family, children, enrolled, pending: children.length - enrolled };
  }), [families, allCandidates, enrolledIds]);
  const newStudents = allCandidates.filter((candidate) => candidate.historicalContracts === 0);
  const returningStudents = allCandidates.filter((candidate) => candidate.historicalContracts > 0);
  const pendingSteps = enrollments.filter((item) => item.status === "PENDIENTE_FIRMA" || item.status === "PENDIENTE_PAGO").length;
  const unassigned = allCandidates.filter((candidate) => candidate.familyId == null);
  const selectedFamily = familyDetail?.id === familyId ? familyDetail : null;
  const visibleFamilies = familyCards.filter((family) => `${family.name} ${family.children.map((child) => `${child.firstName} ${child.lastName}`).join(" ")}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));
  const grades = [...new Set([
    ...allCandidates.map((candidate) => candidate.currentGrade),
    ...families.flatMap((family) => family.activeStudents?.map((student) => student.currentGrade) ?? []),
    ...bootstrap?.gradeLevels.map((grade) => grade.name) ?? [],
  ].filter((grade): grade is string => Boolean(grade?.trim())))].sort((a, b) => a.localeCompare(b, "es"));

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

  function openChild(candidate: AdmissionCandidate | null, profile: Record<string, string | number | null | undefined>) {
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
  const visibleQueueStudents = queueStudents.filter((student) => `${student.firstName} ${student.lastName} ${student.familyName ?? ""} ${student.currentGrade ?? ""} ${student.proposedGrade ?? ""}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")));

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
              {access.enrollments && <button className="button button-primary" type="button" onClick={() => openRegistration({ mode: "new" })}><AppIcon name="plus" size={19} /> Registrar alumno nuevo</button>}
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
            <div><span className="stat-icon blue"><AppIcon name="users" /></span><span><small>Familias atendidas</small><strong>{families.length}</strong></span></div>
            <div><span className="stat-icon coral"><AppIcon name="plus" /></span><span><small>Alumnos nuevos</small><strong>{newStudents.length}</strong></span></div>
            <div><span className="stat-icon violet"><AppIcon name="users" /></span><span><small>Reinscripciones</small><strong>{returningStudents.length}</strong></span></div>
            <div><span className="stat-icon mint"><AppIcon name="clock" /></span><span><small>Firma o pago pendiente</small><strong>{pendingSteps}</strong></span></div>
          </div>

          {error && <p className="alert-error" role="alert">{error}</p>}
          {bootstrap && !bootstrap.schoolYears.some((item) => item.year === 2027) && <p className="alert-error" role="alert">El ciclo 2027 todavía no está creado en el API escolar.</p>}

          <section className="work-section admissions-inbox">
            <div className="section-heading"><div><span className="eyebrow">BANDEJA DE TRABAJO</span><h2>¿Qué proceso vas a atender?</h2></div>
              {queue !== "home" && <label className="search-field queue-search"><AppIcon name="search" size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={queue === "contracts" ? "Alumno, representante o contrato" : "Buscar alumno o familia"} /></label>}
            </div>
            <div className="large-tabs admissions-tabs" role="tablist" aria-label="Procesos de inscripción">
              <button role="tab" aria-selected={queue === "new"} onClick={() => { setQueue("new"); setSearch(""); }}>Alumnos nuevos <span>{newStudents.length}</span></button>
              <button role="tab" aria-selected={queue === "returning"} onClick={() => { setQueue("returning"); setSearch(""); }}>Reinscripción <span>{returningStudents.length}</span></button>
              <button role="tab" aria-selected={queue === "home"} onClick={() => setQueue("home")}>Desde casa</button>
              <button role="tab" aria-selected={queue === "families"} onClick={() => { setQueue("families"); setSearch(""); }}>Familias <span>{families.length}</span></button>
              <button role="tab" aria-selected={queue === "contracts"} onClick={() => { setQueue("contracts"); setSearch(""); }}>Contratos <span>{contracts.length}</span></button>
            </div>

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
              {visibleQueueStudents.length === 0 && <div className="empty-state"><h3>No hay alumnos en esta bandeja</h3><p>Registra un alumno nuevo o revisa las respuestas que llegaron desde casa.</p></div>}
              {unassigned.length > 0 && <div className="unassigned-summary"><strong>{unassigned.length} alumno{unassigned.length === 1 ? "" : "s"} sin familia vinculada</strong><span>Abre cada inscripción y confirma a qué expediente familiar pertenece.</span></div>}
            </div>}

            {queue === "families" && <>
              <div className="family-card-grid">
                {visibleFamilies.map((family) => <button className="family-card" type="button" key={family.id} onClick={() => void openFamily(family.id)}>
                  <span className="avatar blue">{family.name.slice(0, 2).toLocaleUpperCase("es")}</span><span className="family-card-copy"><strong>{family.name}</strong><small>{family.children.length} alumno{family.children.length === 1 ? "" : "s"}</small><em>{family.children.map((child) => child.firstName).join(", ") || "Sin alumnos todavía"}</em></span>
                  <span className={`status-pill ${family.pending ? "waiting" : "success"}`}>{family.pending ? `${family.pending} por revisar` : family.children.length ? "Completa" : "Sin alumnos"}</span><AppIcon name="arrow" size={18} />
                </button>)}
              </div>
              {visibleFamilies.length === 0 && <div className="empty-state"><h3>No hay familias que coincidan</h3></div>}
            </>}

            {queue === "contracts" && <LegacyContractsPanel contracts={contracts} search={search} openableStudentIds={new Set(allCandidates.map((item) => item.id))} onOpenStudent={(id) => {
              const candidate = allCandidates.find((item) => item.id === id);
              if (candidate?.familyId) void openFamily(candidate.familyId);
            }} />}
          </section>
        </>
      )}
    </WorkspaceShell>
  );
}
