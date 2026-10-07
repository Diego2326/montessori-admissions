"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EnrollmentDrawer } from "@/features/enrollments/EnrollmentDrawer";
import { useLiveUpdates } from "@/components/LiveUpdatesProvider";
import { operation } from "@/lib/operations/client";
import type { Bootstrap, Enrollment } from "@/lib/operations/types";
import { CandidateTable } from "@/components/CandidateTable";
import { OverviewStats } from "@/components/OverviewStats";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import type { AdmissionCandidate, AdmissionsOverview } from "@/lib/admissions/types";

type Filter = "all" | "promotion" | "representative" | "special";

export function AdmissionsWorkspace({ overview }: { overview: AdmissionsOverview }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<AdmissionCandidate | null>(null);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState("");
  const { version, area } = useLiveUpdates();
  const reload = useCallback(async () => {
    try {
      const data = await operation<Bootstrap>("enrollments/bootstrap");
      setBootstrap(data);
      const year = data.schoolYears.find((item) => item.year === 2027);
      setEnrollments(year ? await operation<Enrollment[]>(`enrollments?schoolYearId=${year.id}`) : []);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron cargar las inscripciones"); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer); }, [reload]);
  useEffect(() => { if (!version || area && area !== "ENROLLMENTS") return; const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer); }, [version, area, reload]);
  const allCandidates = useMemo(() => {
    const existing = new Set(overview.candidates.map((candidate) => candidate.id));
    return [...overview.candidates, ...enrollments.filter((item) => !existing.has(item.studentId)).map((item): AdmissionCandidate => ({
      id: item.studentId, firstName: item.studentFirstName || "Alumno", lastName: item.studentLastName || "", currentGrade: null,
      proposedGrade: item.gradeName, familyId: null, familyName: item.profile?.familyName || null,
      familyReviewStatus: null, representativeName: item.profile?.representativeName || null, historicalContracts: 0, status: "REVIEW",
    }))];
  }, [overview.candidates, enrollments]);
  const candidates = useMemo(() => allCandidates.filter((candidate) => {
    const needle = search.trim().toLocaleLowerCase("es");
    const text = `${candidate.firstName} ${candidate.lastName} ${candidate.familyName ?? ""} ${candidate.currentGrade ?? ""}`.toLocaleLowerCase("es");
    const matchesFilter = filter === "all" || filter === "promotion" && candidate.status === "PROMOTION" || filter === "representative" && candidate.status === "PROMOTION" && !candidate.representativeName || filter === "special" && candidate.status !== "PROMOTION";
    return matchesFilter && (!needle || text.includes(needle));
  }), [allCandidates, search, filter]);

  return <WorkspaceShell current="Inscripciones">
    <header className="page-heading"><div><p className="eyebrow">Ciclo 2027</p><h1>Inscripciones</h1></div><button className="primary-button" type="button" onClick={() => setSelected({ id: 0, firstName: "", lastName: "", currentGrade: null, proposedGrade: null, familyId: null, familyName: null, familyReviewStatus: null, representativeName: null, historicalContracts: 0, status: "REVIEW" })}>Nuevo alumno</button></header>

    {overview.connection !== "connected" && <div className="connection-notice" role="status"><strong>Expedientes no disponibles.</strong><span>{overview.connection === "not_configured" ? "Configura la dirección de la API de admisiones." : overview.connection === "forbidden" ? "Tu cuenta necesita permiso de admisiones." : overview.error}</span></div>}
    {error && <div className="connection-notice" role="alert">{error}</div>}
    <OverviewStats candidates={allCandidates} />

    <section className="section-intro"><h2>Expedientes</h2><span className="section-count">{enrollments.length} inscritos · {candidates.length} alumnos</span></section>

    <section className="queue-panel"><div className="queue-tools"><div className="filter-tabs" role="group" aria-label="Filtrar expedientes">
      {([{ id: "all", label: "Todos" }, { id: "promotion", label: "Promoción" }, { id: "representative", label: "Falta representante" }, { id: "special", label: "Casos especiales" }] as const).map((item) => <button key={item.id} type="button" className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}
    </div><label className="search-box"><span className="sr-only">Buscar alumno, familia o grado</span><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar alumno o familia" /></label></div>
    <CandidateTable candidates={candidates} onSelect={setSelected} /></section>
    {selected && <EnrollmentDrawer candidate={selected} bootstrap={bootstrap} enrollment={enrollments.find((item) => item.studentId === selected.id) ?? null} onClose={() => setSelected(null)} onSaved={reload} />}
  </WorkspaceShell>;
}
