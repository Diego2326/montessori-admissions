import type { AdmissionCandidate } from "@/lib/admissions/types";

export function OverviewStats({ candidates }: { candidates: AdmissionCandidate[] }) {
  const promoted = candidates.filter((candidate) => candidate.status === "PROMOTION");
  const stats = [
    { value: candidates.length, label: "Alumnos" },
    { value: promoted.length, label: "Promoción" },
    { value: promoted.filter((candidate) => candidate.representativeName).length, label: "Con representante" },
    { value: candidates.filter((candidate) => candidate.status !== "PROMOTION").length, label: "Por revisar" },
  ];
  return <div className="stat-grid">{stats.map((stat) => <article className="stat-card" key={stat.label}>
    <span>{stat.label}</span><strong>{stat.value}</strong>
  </article>)}</div>;
}
