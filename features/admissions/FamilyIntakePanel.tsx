"use client";

import { useState } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { save } from "@/lib/operations/client";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import type { EnrollmentProfile, FamilyIntake } from "@/lib/operations/types";

type Props = {
  family: FamilyIntake;
  students: AdmissionCandidate[];
  unassigned: AdmissionCandidate[];
  enrolledIds: Set<number>;
  onBack: () => void;
  onUpdated: (family: FamilyIntake) => void;
  onOpenChild: (candidate: AdmissionCandidate | null, profile: EnrollmentProfile) => void;
  onAttachStudent: (studentId: number) => Promise<void>;
};

const contactFields = [
  ["motherName", "Nombre de la madre"], ["motherPhone", "Celular de la madre"],
  ["motherEmail", "Correo de la madre"], ["motherDpi", "DPI de la madre"],
  ["fatherName", "Nombre del padre"], ["fatherPhone", "Celular del padre"],
  ["fatherHomePhone", "Teléfono de casa del padre"], ["fatherDpi", "DPI del padre"],
  ["emergencyContactName", "Contacto de emergencia"],
  ["emergencyContactPhone", "Celular de emergencia"],
  ["emergencyPhone", "Teléfono alterno"],
] as const;

const representativeFields = [
  ["representativeFirstName", "Nombres"], ["representativeLastName", "Apellidos"],
  ["representativeAge", "Edad"], ["representativeCivilStatus", "Estado civil"],
  ["representativeNationality", "Nacionalidad"], ["representativeOccupation", "Profesión u oficio"],
  ["representativeDocument", "Número de documento"],
  ["representativeResidence", "Dirección de residencia"],
  ["representativeHomePhone", "Teléfono de casa"],
  ["representativeOfficePhone", "Teléfono de oficina"],
  ["representativeMobilePhone", "Celular"],
] as const;

export function FamilyIntakePanel({ family, students, unassigned, enrolledIds, onBack, onUpdated, onOpenChild, onAttachStudent }: Props) {
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
              <option value="">Por confirmar</option><option value="MOTHER">Madre</option><option value="FATHER">Padre</option><option value="OTHER">Otro</option>
            </select>
          </label>
          <label className="field-label">Tipo de documento
            <select value={String(profile.representativeDocumentType || "")} onChange={(event) => update("representativeDocumentType", event.target.value)}>
              <option value="">Seleccionar</option><option value="DPI">DPI</option><option value="PASAPORTE">Pasaporte</option><option value="OTRO">Otro</option>
            </select>
          </label>
          {representativeFields.map(([key, label]) => field(key, label))}
        </div>
        <h4>Contactos</h4>
        <div className="form-grid">{contactFields.map(([key, label]) => field(key, label))}</div>
        {error && <p className="alert-error" role="alert">{error}</p>}
        <button className="button button-primary" type="button" disabled={busy} onClick={() => void persist()}>
          {busy ? "Guardando…" : "Guardar familia"}
        </button>
      </section>

      <section className="family-panel">
        <div className="section-heading">
          <div><span className="eyebrow">HIJOS</span><h2>Inscripciones de la familia</h2></div>
          <button className="button button-primary" type="button" disabled={busy} onClick={() => void openChild(null)}>
            <AppIcon name="plus" size={18} /> Agregar alumno
          </button>
        </div>
        <div className="family-children">
          {students.map((child) => (
            <button className="family-child" type="button" key={child.id} disabled={busy} onClick={() => void openChild(child)}>
              <span><strong>{child.firstName} {child.lastName}</strong><small>{child.currentGrade || "Grado por definir"}</small></span>
              <span className={`status-pill ${enrolledIds.has(child.id) ? "success" : "waiting"}`}>
                {enrolledIds.has(child.id) ? "Inscrito" : "Por inscribir"}
              </span>
              <AppIcon name="arrow" size={18} />
            </button>
          ))}
          {students.length === 0 && <p className="muted">Agrega el primer alumno de esta familia.</p>}
        </div>
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
