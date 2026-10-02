"use client";

import type { AdmissionCandidate } from "@/lib/admissions/types";

export function CandidateTable({ candidates, onSelect }: { candidates: AdmissionCandidate[]; onSelect: (candidate: AdmissionCandidate) => void }) {
  return <div className="table-wrap"><table className="candidate-table">
    <thead><tr><th>Estudiante</th><th>Grado 2026</th><th>Propuesta 2027</th><th>Familia</th><th>Revisión</th><th><span className="sr-only">Abrir</span></th></tr></thead>
    <tbody>{candidates.map((candidate) => <tr key={candidate.id}>
      <td><strong>{candidate.firstName} {candidate.lastName}</strong><span className="row-subtle">#{candidate.id}</span></td>
      <td>{candidate.currentGrade ?? "Sin grado"}</td>
      <td>{candidate.proposedGrade ?? (candidate.status === "GRADUATED" ? "Egresado" : "Por definir")}</td>
      <td>{candidate.familyName ?? "Sin familia"}</td>
      <td><span className={`status-badge ${candidate.status === "PROMOTION" ? candidate.representativeName ? "status-warm" : "status-alert" : "status-muted"}`}>
        {candidate.status === "GRADUATED" ? "Egreso" : candidate.status === "REVIEW" ? "Revisar grado" : candidate.representativeName ? "Revisar datos" : "Falta representante"}
      </span></td>
      <td><button type="button" className="row-action" onClick={() => onSelect(candidate)} aria-label={`Ver expediente de ${candidate.firstName} ${candidate.lastName}`}>Ver expediente <span aria-hidden="true">↗</span></button></td>
    </tr>)}</tbody>
  </table>{candidates.length === 0 && <div className="empty-table">No hay alumnos para este filtro.</div>}</div>;
}
