"use client";

import { useState, type FormEvent } from "react";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import { save } from "@/lib/operations/client";
import type { Bootstrap, Enrollment, EnrollmentProfile } from "@/lib/operations/types";

type Props = { candidate: AdmissionCandidate | null; bootstrap: Bootstrap | null; enrollment: Enrollment | null; onClose: () => void; onSaved: () => Promise<void> };
const fields: { key: keyof EnrollmentProfile; label: string }[] = [
  { key: "familyName", label: "Familia" }, { key: "birthDate", label: "Fecha de nacimiento" }, { key: "studentDpi", label: "Documento del alumno" }, { key: "address", label: "Dirección" },
  { key: "motherName", label: "Madre" }, { key: "motherPhone", label: "Teléfono de madre" }, { key: "motherEmail", label: "Correo de madre" },
  { key: "fatherName", label: "Padre" }, { key: "fatherPhone", label: "Teléfono de padre" }, { key: "representativeName", label: "Representante" },
  { key: "representativeMobilePhone", label: "Teléfono del representante" }, { key: "representativeDocument", label: "Documento del representante" },
  { key: "emergencyPhone", label: "Teléfono de emergencia" }, { key: "enrollmentFee", label: "Inscripción (Q)" }, { key: "monthlyFee", label: "Mensualidad (Q)" }, { key: "otherNotes", label: "Notas" },
];
export function EnrollmentDrawer({ candidate, bootstrap, enrollment, onClose, onSaved }: Props) {
  const grades = bootstrap?.gradeLevels ?? [];
  const year = bootstrap?.schoolYears.find((item) => item.year === 2027);
  const proposedGrade = grades.find((grade) => grade.name.toLocaleLowerCase("es") === candidate?.proposedGrade?.toLocaleLowerCase("es"));
  const [firstName, setFirstName] = useState(enrollment?.studentFirstName ?? candidate?.firstName ?? "");
  const [lastName, setLastName] = useState(enrollment?.studentLastName ?? candidate?.lastName ?? "");
  const [gradeId, setGradeId] = useState(enrollment?.gradeId ?? proposedGrade?.id ?? 0);
  const [section, setSection] = useState(enrollment?.section ?? "");
  const [profile, setProfile] = useState<EnrollmentProfile>(enrollment?.profile ?? { familyName: candidate?.familyName, representativeName: candidate?.representativeName });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!year || !candidate) return;
    setBusy(true); setError("");
    try {
      const body = { firstName, lastName, gradeId, section: section || null, status: "ACTIVO", profile };
      if (enrollment) await save<Enrollment>(`enrollments/${enrollment.id}`, body, "PUT");
      else await save<Enrollment>("enrollments", { ...body, ...(candidate.id > 0 ? { studentId: candidate.id } : {}), schoolYearId: year.id });
      await onSaved(); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la inscripción"); }
    finally { setBusy(false); }
  }
  if (!candidate) return null;
  return <div className="drawer-backdrop" onMouseDown={onClose}><aside className="details-drawer wide-drawer" role="dialog" aria-modal="true" aria-label={`Inscripción de ${candidate.firstName} ${candidate.lastName}`} onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><span className="eyebrow">{enrollment ? `Inscripción #${enrollment.id}` : "Nueva inscripción"}</span><button className="close-button" onClick={onClose}>×</button></div><h2>{candidate.id > 0 ? <>{candidate.firstName}<br /><em>{candidate.lastName}</em></> : "Nuevo alumno"}</h2>{candidate.id > 0 && <div className="grade-transition"><span>{candidate.currentGrade || "Sin grado"}<small>Ciclo 2026</small></span><b>→</b><span>{candidate.proposedGrade || "Por definir"}<small>Ciclo 2027</small></span></div>}{error && <p className="form-error" role="alert">{error}</p>}
    <form onSubmit={(event) => void submit(event)}><div className="field-grid two-columns"><label>Nombre<input required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label>Apellido<input required value={lastName} onChange={(event) => setLastName(event.target.value)} /></label><label>Grado 2027<select required value={gradeId || ""} onChange={(event) => setGradeId(Number(event.target.value))}><option value="">Seleccionar grado</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label><label>Sección<input value={section} onChange={(event) => setSection(event.target.value)} /></label>{fields.map(({ key, label }) => <label key={key}>{label}<input type={key === "birthDate" ? "date" : key === "enrollmentFee" || key === "monthlyFee" ? "number" : "text"} min={key === "enrollmentFee" || key === "monthlyFee" ? "0" : undefined} step={key === "enrollmentFee" || key === "monthlyFee" ? "0.01" : undefined} value={profile[key] ?? ""} onChange={(event) => setProfile({ ...profile, [key]: event.target.value })} /></label>)}</div><div className="form-actions"><button className="primary-button" disabled={busy || !year || !gradeId}>{enrollment ? "Guardar cambios" : "Inscribir alumno"}</button>{enrollment && <a className="outline-button" href={`/api/operations/enrollments/${enrollment.id}/contract`} target="_blank" rel="noreferrer">Ver contrato</a>}</div>{!year && <p className="muted">El ciclo 2027 todavía no está creado.</p>}</form></aside></div>;
}
