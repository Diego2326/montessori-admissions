import type { AdmissionCandidate } from "@/lib/admissions/types";

export function OverviewStats({ candidates }: { candidates: AdmissionCandidate[] }) {
  const promoted = candidates.filter((candidate) => candidate.status === "PROMOTION");
  const stats = [
    { value: candidates.length, label: "Alumnos actuales", note: "Base del ciclo 2026" },
    { value: promoted.length, label: "Promoción propuesta", note: "Con grado siguiente identificado" },
    { value: promoted.filter((candidate) => candidate.representativeName).length, label: "Con representante", note: "Datos para el contrato" },
    { value: candidates.filter((candidate) => candidate.status !== "PROMOTION").length, label: "Casos especiales", note: "Egresados o grado por revisar" },
  ];
  return <div className="stat-grid">{stats.map((stat, index) => <article className="stat-card" key={stat.label}>
    <span className="stat-index">0{index + 1}</span><strong>{stat.value}</strong><span>{stat.label}</span><small>{stat.note}</small>
  </article>)}</div>;
}
