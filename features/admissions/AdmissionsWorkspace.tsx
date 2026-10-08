"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { useLiveUpdates } from "@/components/LiveUpdatesProvider";
import { operation, save } from "@/lib/operations/client";
import type { AdmissionCandidate, AdmissionsOverview } from "@/lib/admissions/types";
import type { Bootstrap, Enrollment, EnrollmentProfile, FamilyIntake, FamilySummary, LegacyContractAssignment } from "@/lib/operations/types";
import { EnrollmentWizard } from "./EnrollmentWizard";
import { FamilyIntakePanel } from "./FamilyIntakePanel";
import { LegacyContractsPanel } from "./LegacyContractsPanel";

type Filter = "pending" | "enrolled" | "all" | "contracts";

export function AdmissionsWorkspace({ overview }: { overview: AdmissionsOverview }) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [candidates, setCandidates] = useState<AdmissionCandidate[]>(overview.candidates);
  const [families, setFamilies] = useState<FamilySummary[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [contracts, setContracts] = useState<LegacyContractAssignment[]>([]);
  const [familyId, setFamilyId] = useState<number | null>(null);
  const [familyDetail, setFamilyDetail] = useState<FamilyIntake | null>(null);
  const [selectedChild, setSelectedChild] = useState<AdmissionCandidate | null>(null);
  const [sharedProfile, setSharedProfile] = useState<EnrollmentProfile>({});
  const [wizardOpen, setWizardOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFamilyName, setNewFamilyName] = useState("");
  const [newFamilyStudentId, setNewFamilyStudentId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("pending");
  const [error, setError] = useState("");
  const { version, area } = useLiveUpdates();

  const reload = useCallback(async () => {
    try {
      const [nextBootstrap, nextOverview, nextFamilies, nextContracts] = await Promise.all([
        operation<Bootstrap>("enrollments/bootstrap"),
        operation<{ candidates: AdmissionCandidate[] }>("admission-workflow/2027/overview"),
        operation<FamilySummary[]>("admission-workflow/families"),
        operation<LegacyContractAssignment[]>("admission-workflow/legacy-contracts"),
      ]);
      const year = nextBootstrap.schoolYears.find((item) => item.year === 2027);
      const nextEnrollments = year ? await operation<Enrollment[]>(`enrollments?schoolYearId=${year.id}`) : [];
      setBootstrap(nextBootstrap);
      setCandidates(nextOverview.candidates);
      setFamilies(nextFamilies);
      setContracts(nextContracts);
      setEnrollments(nextEnrollments);
      if (familyId) setFamilyDetail(await operation<FamilyIntake>(`admission-workflow/families/${familyId}`));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las familias");
    }
  }, [familyId]);

  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  useEffect(() => {
    if (!version || (area && area !== "ENROLLMENTS")) return;
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [version, area, reload]);

  const allCandidates = useMemo(() => {
    const existing = new Set(candidates.map((candidate) => candidate.id));
    const newcomers = enrollments.filter((item) => !existing.has(item.studentId)).map((item): AdmissionCandidate => ({
      id: item.studentId,
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
    return [...candidates, ...newcomers];
  }, [candidates, enrollments]);
  const enrolledIds = useMemo(() => new Set(enrollments.map((item) => item.studentId)), [enrollments]);
  const familyCards = useMemo(() => families.map((family) => {
    const children = allCandidates.filter((candidate) => candidate.familyId === family.id);
    const enrolled = children.filter((child) => enrolledIds.has(child.id)).length;
    return { ...family, children, enrolled, pending: children.length - enrolled };
  }), [families, allCandidates, enrolledIds]);
  const pendingFamilies = familyCards.filter((family) => family.pending > 0 || family.children.length === 0).length;
  const visibleFamilies = familyCards.filter((family) => {
    if (filter === "pending" && family.pending === 0 && family.children.length > 0) return false;
    if (filter === "enrolled" && (family.pending > 0 || family.children.length === 0)) return false;
    return `${family.name} ${family.children.map((child) => `${child.firstName} ${child.lastName}`).join(" ")}`
      .toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"));
  });
  const unassigned = allCandidates.filter((candidate) => candidate.familyId == null);
  const selectedFamily = familyDetail?.id === familyId ? familyDetail : null;

  async function openFamily(id: number) {
    setFamilyId(id);
    setFamilyDetail(null);
    setError("");
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo abrir la familia");
    }
  }

  async function createFamily() {
    if (!newFamilyName.trim()) { setError("Escribe el nombre de la familia."); return; }
    setBusy(true);
    setError("");
    try {
      const created = await save<FamilyIntake>("admission-workflow/families", { name: newFamilyName.trim(), studentId: newFamilyStudentId || null });
      setCreating(false);
      setNewFamilyName("");
      setNewFamilyStudentId(0);
      await reload();
      await openFamily(created.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear la familia");
    } finally {
      setBusy(false);
    }
  }

  function openChild(candidate: AdmissionCandidate | null, profile: EnrollmentProfile) {
    const defaults = { ...profile };
    if (candidate?.historicalContracts) {
      for (const key of Object.keys(defaults)) if (key.startsWith("representative")) delete defaults[key];
    }
    setSelectedChild(candidate);
    setSharedProfile(defaults);
    setWizardOpen(true);
  }

  async function attachStudent(studentId: number) {
    if (!familyId) return;
    setBusy(true);
    try {
      await save(`admission-workflow/families/${familyId}/students/${studentId}`, {});
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo vincular al alumno");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceShell current="Inscripciones">
      {selectedFamily ? (
        <FamilyIntakePanel
          key={selectedFamily.id}
          family={selectedFamily}
          students={allCandidates.filter((candidate) => candidate.familyId === selectedFamily.id)}
          unassigned={unassigned}
          enrolledIds={enrolledIds}
          onBack={() => { setFamilyId(null); setFamilyDetail(null); }}
          onUpdated={setFamilyDetail}
          onOpenChild={openChild}
          onAttachStudent={attachStudent}
        />
      ) : (
        <>
          <div className="hero hero-admissions">
            <div className="hero-copy">
              <span className="eyebrow">CICLO ESCOLAR 2027</span>
              <h1>Inscripciones por familia</h1>
              <button className="button button-primary" type="button" onClick={() => { setNewFamilyStudentId(0); setNewFamilyName(""); setCreating(true); }}>
                <AppIcon name="plus" size={19} /> Nueva familia
              </button>
            </div>
            <div className="hero-art"><div className="art-ring"><AppIcon name="users" size={68} /></div></div>
          </div>
          <div className="station-stats">
            <div><span className="stat-icon blue"><AppIcon name="users" /></span><span><small>Familias</small><strong>{families.length}</strong></span></div>
            <div><span className="stat-icon coral"><AppIcon name="clock" /></span><span><small>Por atender</small><strong>{pendingFamilies}</strong></span></div>
            <div><span className="stat-icon mint"><AppIcon name="check" /></span><span><small>Alumnos inscritos</small><strong>{enrollments.length}</strong></span></div>
          </div>
          {unassigned.length > 0 && <section className="work-section">
            <div className="section-heading"><div><span className="eyebrow">PENDIENTES DE VINCULAR</span><h2>Alumnos sin familia <span className="count-badge">{unassigned.length}</span></h2></div>
              <label className="search-field queue-search"><AppIcon name="search" size={19} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar alumno o familia" /></label>
            </div>
            <div className="family-unassigned-list">
              {unassigned.filter((student) => `${student.firstName} ${student.lastName}`.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es"))).slice(0, 12).map((student) => (
                <button className="family-child" key={student.id} type="button" onClick={() => {
                  setNewFamilyStudentId(student.id);
                  setNewFamilyName(student.lastName);
                  setCreating(true);
                }}>
                  <span><strong>{student.firstName} {student.lastName}</strong><small>{student.currentGrade || "Grado por definir"}</small></span>
                  <span className="status-pill waiting">Crear familia</span><AppIcon name="arrow" size={18} />
                </button>
              ))}
            </div>
          </section>}
          <section className="work-section">
            <div className="section-heading">
              <div><span className="eyebrow">ATENCIÓN EN MOSTRADOR</span><h2>Busca una familia</h2></div>
              <label className="search-field queue-search"><AppIcon name="search" size={19} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={filter === "contracts" ? "Alumno, representante o contrato" : "Familia o alumno"} />
              </label>
            </div>
            <div className="large-tabs" role="tablist">
              <button role="tab" aria-selected={filter === "pending"} onClick={() => setFilter("pending")}>Por atender <span>{pendingFamilies}</span></button>
              <button role="tab" aria-selected={filter === "enrolled"} onClick={() => setFilter("enrolled")}>Terminadas <span>{families.length - pendingFamilies}</span></button>
              <button role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")}>Todas <span>{families.length}</span></button>
              <button role="tab" aria-selected={filter === "contracts"} onClick={() => setFilter("contracts")}>Contratos <span>{contracts.length}</span></button>
            </div>
            {error && <p className="alert-error" role="alert">{error}</p>}
            {filter === "contracts" ? (
              <LegacyContractsPanel contracts={contracts} search={search} openableStudentIds={new Set(allCandidates.map((item) => item.id))} onOpenStudent={(id) => {
                const candidate = allCandidates.find((item) => item.id === id);
                if (candidate?.familyId) void openFamily(candidate.familyId);
              }} />
            ) : (
              <div className="family-card-grid">
                {visibleFamilies.map((family) => (
                  <button className="family-card" type="button" key={family.id} onClick={() => void openFamily(family.id)}>
                    <span className="avatar blue">{family.name.slice(0, 2).toLocaleUpperCase("es")}</span>
                    <span className="family-card-copy"><strong>{family.name}</strong><small>{family.children.length} alumno{family.children.length === 1 ? "" : "s"}</small>
                      <em>{family.children.map((child) => child.firstName).join(", ") || "Sin alumnos todavía"}</em></span>
                    <span className={`status-pill ${family.pending ? "waiting" : "success"}`}>
                      {family.pending ? `${family.pending} pendiente${family.pending === 1 ? "" : "s"}` : family.children.length ? "Completa" : "Nueva"}
                    </span>
                    <AppIcon name="arrow" size={18} />
                  </button>
                ))}
              </div>
            )}
            {filter !== "contracts" && visibleFamilies.length === 0 && <div className="empty-state"><h3>Sin familias para esta búsqueda</h3></div>}
          </section>
          {creating && <div className="modal-backdrop" onMouseDown={() => { setCreating(false); setNewFamilyStudentId(0); }}>
            <section className="touch-modal family-create-modal" role="dialog" aria-modal="true" aria-label="Nueva familia" onMouseDown={(event) => event.stopPropagation()}>
              <header className="modal-header"><h2>Nueva familia</h2><button className="icon-button" onClick={() => { setCreating(false); setNewFamilyStudentId(0); }} aria-label="Cerrar"><AppIcon name="close" /></button></header>
              <div className="family-create-content"><label className="field-label">Nombre de familia<input autoFocus value={newFamilyName} onChange={(event) => setNewFamilyName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void createFamily(); }} /></label>
                {newFamilyStudentId > 0 && <p className="muted">Se vinculará {unassigned.find((student) => student.id === newFamilyStudentId)?.firstName} {unassigned.find((student) => student.id === newFamilyStudentId)?.lastName} a esta familia.</p>}
                <button className="button button-primary" disabled={busy} onClick={() => void createFamily()}>{busy ? "Creando…" : "Crear familia"}</button></div>
            </section>
          </div>}
        </>
      )}
      {wizardOpen && selectedFamily && <EnrollmentWizard
        key={selectedChild?.id ?? `new-${selectedFamily.id}`}
        candidate={selectedChild}
        familyId={selectedFamily.id}
        familyName={selectedFamily.name}
        sharedProfile={sharedProfile}
        bootstrap={bootstrap}
        enrollment={enrollments.find((item) => item.studentId === selectedChild?.id) ?? null}
        onClose={() => { setWizardOpen(false); setSelectedChild(null); void reload(); }}
        onSaved={reload}
      />}
    </WorkspaceShell>
  );
}
