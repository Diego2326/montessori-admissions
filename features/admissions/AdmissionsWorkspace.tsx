"use client";

import { useMemo, useState } from "react";
import { CandidateDetails } from "@/components/CandidateDetails";
import { CandidateTable } from "@/components/CandidateTable";
import { OverviewStats } from "@/components/OverviewStats";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import type { AdmissionCandidate, AdmissionsOverview } from "@/lib/admissions/types";

type Filter = "all" | "promotion" | "representative" | "special";

export function AdmissionsWorkspace({ overview }: { overview: AdmissionsOverview }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<AdmissionCandidate | null>(null);
  const candidates = useMemo(() => overview.candidates.filter((candidate) => {
    const needle = search.trim().toLocaleLowerCase("es");
    const text = `${candidate.firstName} ${candidate.lastName} ${candidate.familyName ?? ""} ${candidate.currentGrade ?? ""}`.toLocaleLowerCase("es");
    const matchesFilter = filter === "all" || filter === "promotion" && candidate.status === "PROMOTION" || filter === "representative" && candidate.status === "PROMOTION" && !candidate.representativeName || filter === "special" && candidate.status !== "PROMOTION";
    return matchesFilter && (!needle || text.includes(needle));
  }), [overview.candidates, search, filter]);

  return <WorkspaceShell current="Inscripciones">
    <header className="page-heading"><div><p className="eyebrow">Ciclo 2027</p><h1>Inscripciones</h1></div><span className="heading-year">2027</span></header>

    {overview.connection !== "connected" && <div className="connection-notice" role="status"><strong>Expedientes no disponibles.</strong><span>{overview.connection === "not_configured" ? "Configura la dirección de la API de admisiones." : overview.connection === "forbidden" ? "Tu cuenta necesita permiso de admisiones." : overview.error}</span></div>}
    <OverviewStats candidates={overview.candidates} />

    <section className="section-intro"><h2>Expedientes</h2><span className="section-count">{candidates.length} alumnos</span></section>

    <section className="queue-panel"><div className="queue-tools"><div className="filter-tabs" role="group" aria-label="Filtrar expedientes">
      {([{ id: "all", label: "Todos" }, { id: "promotion", label: "Promoción" }, { id: "representative", label: "Falta representante" }, { id: "special", label: "Casos especiales" }] as const).map((item) => <button key={item.id} type="button" className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}</button>)}
    </div><label className="search-box"><span className="sr-only">Buscar alumno, familia o grado</span><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar alumno o familia" /></label></div>
    <CandidateTable candidates={candidates} onSelect={setSelected} /></section>
    {selected && <CandidateDetails candidate={selected} onClose={() => setSelected(null)} />}
  </WorkspaceShell>;
}
