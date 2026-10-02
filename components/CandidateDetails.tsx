"use client";

import type { AdmissionCandidate } from "@/lib/admissions/types";

export function CandidateDetails({ candidate, onClose }: { candidate: AdmissionCandidate; onClose: () => void }) {
  return <div className="drawer-backdrop" onMouseDown={onClose}>
    <aside className="details-drawer" role="dialog" aria-modal="true" aria-label={`Expediente de ${candidate.firstName} ${candidate.lastName}`} onMouseDown={(event) => event.stopPropagation()}>
      <div className="drawer-head"><span className="eyebrow">Expediente 2027</span><button className="close-button" type="button" onClick={onClose} aria-label="Cerrar expediente">×</button></div>
      <h2>{candidate.firstName}<br /><em>{candidate.lastName}</em></h2>
      <div className="detail-section"><h3>Promoción académica</h3><div className="grade-transition"><span>{candidate.currentGrade ?? "Sin grado"}<small>Ciclo 2026</small></span><b aria-hidden="true">→</b><span>{candidate.proposedGrade ?? (candidate.status === "GRADUATED" ? "Egresado" : "Pendiente")}<small>Ciclo 2027</small></span></div></div>
      <div className="detail-section"><h3>Grupo familiar</h3><dl>
        <div><dt>Familia</dt><dd>{candidate.familyName ?? "Por relacionar"}</dd></div>
        <div><dt>Representante</dt><dd>{candidate.representativeName ?? "Por completar"}</dd></div>
        <div><dt>Revisión</dt><dd>{candidate.familyReviewStatus === "VERIFIED" ? "Verificada" : "Pendiente"}</dd></div>
        <div><dt>Contratos anteriores</dt><dd>{candidate.historicalContracts}</dd></div>
      </dl></div>
      <div className="drawer-status">{candidate.status === "GRADUATED" ? "Egresado" : candidate.status === "REVIEW" ? "Grado por revisar" : "Promoción propuesta"}</div>
    </aside>
  </div>;
}
