"use client";

import { useState } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { save } from "@/lib/operations/client";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import type { Enrollment, EnrollmentProfile, FamilyIntake } from "@/lib/operations/types";
import { FamilyPreEnrollmentLinks } from "./FamilyPreEnrollmentLinks";
import {
  civilStatusOptions,
  nationalityOptions,
  optionsWithExistingValue,
  representativeDocumentTypeOptions,
  representativeTypeOptions,
} from "./normalizedOptions";

type Props = {
  family: FamilyIntake;
  students: AdmissionCandidate[];
  unassigned: AdmissionCandidate[];
  enrollmentStatuses: Map<number, string>;
  enrollments: Enrollment[];
  canManageEnrollment: boolean;
  onBack: () => void;
  onUpdated: (family: FamilyIntake) => void;
  onOpenChild: (candidate: AdmissionCandidate | null, profile: EnrollmentProfile) => void;
  onAttachStudent: (studentId: number) => Promise<void>;
};

const contactFields = [
  ["motherName", "Nombre de la madre"], ["motherPhone", "Celular de la madre"],
  ["motherEmail", "Correo de la madre"], ["motherDpi", "DPI de la madre"],
  ["motherOccupation", "Ocupación de la madre"], ["motherWorkplace", "Lugar de trabajo de la madre"],
  ["fatherName", "Nombre del padre"], ["fatherPhone", "Celular del padre"],
  ["fatherHomePhone", "Teléfono de casa del padre"], ["fatherDpi", "DPI del padre"],
  ["fatherOccupation", "Ocupación del padre"], ["fatherWorkplace", "Lugar de trabajo del padre"],
  ["emergencyContactName", "Contacto de emergencia"],
  ["emergencyContactPhone", "Celular de emergencia"],
  ["emergencyPhone", "Teléfono alterno"], ["city", "Municipio o ciudad"],
  ["otherContact", "Otro contacto"],
] as const;

const representativeFields = [
  ["representativeFirstName", "Nombres"], ["representativeLastName", "Apellidos"],
  ["representativeAge", "Edad"], ["representativeOccupation", "Profesión u oficio"],
  ["representativeDocument", "Número de documento"],
  ["representativeResidence", "Dirección de residencia"],
  ["representativeHomePhone", "Teléfono de casa"],
  ["representativeOfficePhone", "Teléfono de oficina"],
  ["representativeMobilePhone", "Celular"],
] as const;

export function FamilyIntakePanel({ family, students, unassigned, enrollmentStatuses, enrollments, canManageEnrollment, onBack, onUpdated, onOpenChild, onAttachStudent }: Props) {
  const [name, setName] = useState(family.name);
  const [profile, setProfile] = useState<EnrollmentProfile>(family.profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [studentToAttach, setStudentToAttach] = useState(0);

  function update(key: string, value: string) {
    setProfile((current) => ({ ...current, [key]: key === "representativeAge" ? Number(value) || null : value }));
  }

  function field(key: string, label: string) {
    return (
      <label className="field-label" key={key}>
        {label}
        <input
          value={profile[key] ?? ""}
          type={key === "representativeAge" ? "number" : key.includes("Email") ? "email" : key.includes("Phone") ? "tel" : "text"}
          onChange={(event) => update(key, event.target.value)}
        />
      </label>
    );
  }

  function selectField(key: string, label: string, options: readonly (string | { value: string; label: string })[]) {
    const currentValue = String(profile[key] ?? "");
    return (
      <label className="field-label" key={key}>
        {label}
        <select value={currentValue} onChange={(event) => update(key, event.target.value)}>
          <option value="">Seleccionar</option>
          {optionsWithExistingValue(options, currentValue).map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    );
  }

  async function persist(): Promise<FamilyIntake | null> {
    if (!name.trim()) { setError("Escribe el nombre de la familia."); return null; }
    setBusy(true);
    setError("");
    try {
      const updated = await save<FamilyIntake>(`admission-workflow/families/${family.id}`, { name: name.trim(), profile }, "PUT");
      onUpdated(updated);
      return updated;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la familia");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function openChild(candidate: AdmissionCandidate | null) {
    const updated = await persist();
    if (updated) onOpenChild(candidate, { ...updated.profile, familyName: updated.name });
  }

  return (
    <div className="family-intake">
      <div className="section-heading">
        <div>
          <button className="text-button" type="button" onClick={onBack}>← Familias</button>
          <span className="eyebrow">EXPEDIENTE FAMILIAR</span>
          <h2>{family.name}</h2>
        </div>
        <Link href="/caja" className="button button-soft">Ir a Caja</Link>
      </div>

      <section className="family-panel">
        <div className="section-row"><div><h3>Datos compartidos</h3></div></div>
        <div className="form-grid">
          <label className="field-label">Nombre de familia
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          {field("address", "Dirección de la familia")}
        </div>
        <h4>Representante principal</h4>
        <div className="form-grid">
          <label className="field-label">Parentesco
            <select value={String(profile.representativeType || "")} onChange={(event) => update("representativeType", event.target.value)}>
              <option value="">Por confirmar</option>
              {optionsWithExistingValue(representativeTypeOptions, profile.representativeType).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="field-label">Tipo de documento
            <select value={String(profile.representativeDocumentType || "")} onChange={(event) => update("representativeDocumentType", event.target.value)}>
              <option value="">Seleccionar</option>
              {optionsWithExistingValue(representativeDocumentTypeOptions, profile.representativeDocumentType).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {representativeFields.map(([key, label]) => field(key, label))}
          {selectField("representativeCivilStatus", "Estado civil", civilStatusOptions)}
          {selectField("representativeNationality", "Nacionalidad", nationalityOptions)}
        </div>
        <h4>Contactos</h4>
        <div className="form-grid">{contactFields.map(([key, label]) => field(key, label))}</div>
        {error && <p className="alert-error" role="alert">{error}</p>}
        <button className="button button-primary" type="button" disabled={busy} onClick={() => void persist()}>
          {busy ? "Guardando…" : "Guardar familia"}
        </button>
      </section>

      <FamilyPreEnrollmentLinks familyId={family.id} onError={setError} />

      <section className="family-panel">
        <div className="section-heading">
          <div><span className="eyebrow">HIJOS</span><h2>Inscripciones de la familia</h2></div>
          {canManageEnrollment && <button className="button button-primary" type="button" disabled={busy} onClick={() => void openChild(null)}><AppIcon name="plus" size={18} /> Agregar alumno</button>}
        </div>
        <div className="family-children">
          {students.map((child) => {
            const enrollment = enrollments.find((item) => item.studentId === child.id);
            return <article className="family-child family-child-actions" key={child.id}>
              <span><strong>{child.firstName} {child.lastName}</strong><small>{child.currentGrade || enrollment?.gradeName || "Grado por definir"}</small></span>
              <span className={`status-pill ${enrollmentStatuses.get(child.id) === "ACTIVO" ? "success" : "waiting"}`}>
                {enrollmentStatuses.get(child.id) === "ACTIVO" ? "Inscrito" : enrollmentStatuses.get(child.id) === "PENDIENTE_PAGO" ? "Pendiente de pago" : enrollmentStatuses.get(child.id) === "PENDIENTE_FIRMA" ? "Pendiente de firma" : "Por inscribir"}
              </span>
              {canManageEnrollment && <button className="button button-soft" type="button" disabled={busy} onClick={() => void openChild(child)}>Editar inscripción</button>}
              {enrollment && <a className="button button-primary" href={`/api/operations/enrollments/${enrollment.id}/contract.pdf`} target="_blank" rel="noreferrer">Generar contrato</a>}
            </article>;
          })}
          {students.length === 0 && <p className="muted">Agrega el primer alumno de esta familia.</p>}
        </div>
        {!canManageEnrollment && <p className="muted">Tu cuenta puede revisar y compartir la información familiar. Para editar inscripciones o contratos solicita acceso al área de Inscripciones.</p>}
        {unassigned.length > 0 && <div className="family-attach">
          <label className="field-label">Vincular alumno existente
            <select value={studentToAttach} onChange={(event) => setStudentToAttach(Number(event.target.value))}>
              <option value={0}>Selecciona un alumno</option>
              {unassigned.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}
            </select>
          </label>
          <button className="button button-soft" type="button" disabled={!studentToAttach || busy} onClick={async () => {
            setBusy(true);
            try { await onAttachStudent(studentToAttach); setStudentToAttach(0); }
            finally { setBusy(false); }
          }}>Vincular</button>
        </div>}
      </section>
    </div>
  );
}
