"use client";

import { useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { operation, save } from "@/lib/operations/client";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import type {
  Bootstrap,
  Enrollment,
  EnrollmentProfile,
  LegacyContractDetails,
} from "@/lib/operations/types";
import { SignaturePad } from "./SignaturePad";
import { EnrollmentExtras } from "./EnrollmentExtras";

type Props = {
  candidate: AdmissionCandidate | null;
  bootstrap: Bootstrap | null;
  enrollment: Enrollment | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
};
type Field = {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
};
const motherFields: Field[] = [
  { key: "motherName", label: "Nombre completo" },
  { key: "motherPhone", label: "Celular", type: "tel" },
  { key: "motherEmail", label: "Correo", type: "email" },
  { key: "motherDpi", label: "DPI" },
];
const fatherFields: Field[] = [
  { key: "fatherName", label: "Nombre completo" },
  { key: "fatherPhone", label: "Celular", type: "tel" },
  { key: "fatherHomePhone", label: "Teléfono de casa", type: "tel" },
  { key: "fatherDpi", label: "DPI" },
];
const representativeFields: Field[] = [
  { key: "representativeFirstName", label: "Nombres" },
  { key: "representativeLastName", label: "Apellidos" },
  { key: "representativeDocument", label: "Número de documento" },
  { key: "representativeResidence", label: "Dirección de residencia" },
  { key: "representativeMobilePhone", label: "Celular", type: "tel" },
  { key: "representativeAge", label: "Edad", type: "number" },
  { key: "representativeCivilStatus", label: "Estado civil" },
  { key: "representativeNationality", label: "Nacionalidad" },
  { key: "representativeOccupation", label: "Profesión u oficio" },
  { key: "representativeHomePhone", label: "Teléfono de casa", type: "tel" },
  {
    key: "representativeOfficePhone",
    label: "Teléfono de oficina",
    type: "tel",
  },
];
const steps = ["Alumno", "Familia", "Contrato", "Pedidos"];
export function EnrollmentWizard({
  candidate,
  bootstrap,
  enrollment,
  onClose,
  onSaved,
}: Props) {
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState<Enrollment | null>(enrollment);
  const [firstName, setFirstName] = useState(
    enrollment?.studentFirstName ?? candidate?.firstName ?? "",
  );
  const [lastName, setLastName] = useState(
    enrollment?.studentLastName ?? candidate?.lastName ?? "",
  );
  const suggestedGrade = bootstrap?.gradeLevels.find(
    (grade) =>
      grade.name.toLocaleLowerCase("es") ===
      candidate?.proposedGrade?.toLocaleLowerCase("es"),
  );
  const [gradeId, setGradeId] = useState(
    enrollment?.gradeId ?? suggestedGrade?.id ?? 0,
  );
  const [section, setSection] = useState(enrollment?.section ?? "");
  const [profile, setProfile] = useState<EnrollmentProfile>(
    enrollment?.profile ?? {
      familyName: candidate?.familyName,
      representativeName: candidate?.representativeName,
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const year = bootstrap?.schoolYears.find((item) => item.year === 2027);
  useEffect(() => {
    if (!candidate || enrollment) return;
    let active = true;
    void Promise.all([
      operation<Enrollment[]>(`students/${candidate.id}/enrollments`).catch(() => []),
      candidate.historicalContracts > 0
        ? operation<LegacyContractDetails>(`admission-workflow/students/${candidate.id}/legacy-contract`).catch(() => null)
        : Promise.resolve(null),
    ]).then(([rows, legacy]) => {
        if (!active) return;
        const previous = rows
          .filter((item) => item.schoolYear !== 2027)
          .sort((a, b) => (b.schoolYear ?? 0) - (a.schoolYear ?? 0))[0];
        const imported: EnrollmentProfile = legacy ? {
          ...legacy,
          representativeName: `${legacy.representativeFirstName} ${legacy.representativeLastName}`.trim(),
        } : {};
        delete imported.contractId;
        setProfile((current) => ({
            ...imported,
            ...Object.fromEntries(Object.entries(previous?.profile ?? {}).filter(([, value]) => value != null && value !== "")),
            ...Object.fromEntries(
              Object.entries(current).filter(
                ([, value]) => value != null && value !== "",
              ),
            ),
          }));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [candidate, enrollment]);
  const fullName = `${firstName} ${lastName}`.trim();
  const age = useMemo(() => {
    const birth = profile.birthDate;
    if (typeof birth !== "string" || !birth) return null;
    const date = new Date(`${birth}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    const now = new Date();
    return (
      now.getFullYear() -
      date.getFullYear() -
      Number(
        now.getMonth() < date.getMonth() ||
          (now.getMonth() === date.getMonth() &&
            now.getDate() < date.getDate()),
      )
    );
  }, [profile.birthDate]);
  function field({ key, label, type = "text", placeholder }: Field) {
    return (
      <label className="field-label" key={key}>
        {label}
        <input
          type={type}
          min={type === "number" ? "0" : undefined}
          step={type === "number" && /Fee/.test(key) ? "0.01" : undefined}
          value={profile[key] ?? ""}
          placeholder={placeholder}
          onChange={(event) =>
            setProfile((current) => ({
              ...current,
              [key]:
                type === "number" && key === "representativeAge"
                  ? Number(event.target.value) || null
                  : event.target.value,
            }))
          }
        />
      </label>
    );
  }
  function next() {
    setError("");
    if (step === 0 && (!firstName.trim() || !lastName.trim() || !gradeId)) {
      setError("Completa nombre, apellido y grado para continuar.");
      return;
    }
    setStep((current) => Math.min(2, current + 1));
  }
  async function saveEnrollment() {
    if (!year) {
      setError("El ciclo 2027 debe estar configurado en Admin.");
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !gradeId) {
      setError("Completa los datos del alumno.");
      setStep(0);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        gradeId,
        section: section || null,
        status: "ACTIVO",
        profile: {
          ...profile,
          representativeName: [profile.representativeFirstName, profile.representativeLastName].filter(Boolean).join(" ").trim() || profile.representativeName || null,
        },
      };
      const result = saved
        ? await save<Enrollment>(`enrollments/${saved.id}`, body, "PUT")
        : await save<Enrollment>("enrollments", {
            ...body,
            schoolYearId: year.id,
            ...(candidate ? { studentId: candidate.id } : {}),
          });
      setSaved(result);
      await onSaved();
      setStep(3);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo completar la inscripción",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="touch-modal enrollment-modal"
        role="dialog"
        aria-modal="true"
        aria-label={saved ? `Inscripción de ${fullName}` : "Nueva inscripción"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">INSCRIPCIONES · CICLO 2027</span>
            <h2>
              {saved
                ? fullName
                : candidate
                  ? `Inscribir a ${candidate.firstName}`
                  : "Nueva inscripción"}
            </h2>
            <p>
              {candidate?.currentGrade
                ? `${candidate.currentGrade} → ${candidate.proposedGrade || "Grado a definir"}`
                : "Completa el expediente paso a paso"}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <AppIcon name="close" />
          </button>
        </header>
        <nav className="wizard-steps" aria-label="Pasos de inscripción">
          {steps.map((name, index) => (
            <span
              key={name}
              className={
                index === step ? "current" : index < step ? "completed" : ""
              }
            >
              <i>
                {index < step ? <AppIcon name="check" size={15} /> : index + 1}
              </i>
              {name}
            </span>
          ))}
        </nav>
        {step === 3 && saved ? (
          <div className="wizard-scroll">
            <EnrollmentExtras
              studentId={saved.studentId}
              studentName={fullName}
              gradeId={gradeId}
              schoolYearId={year!.id}
              onDone={onClose}
            />
          </div>
        ) : (
          <>
            <div className="wizard-scroll">
              {step === 0 && (
                <div className="wizard-content">
                  <div className="form-intro">
                    <span className="intro-icon blue">
                      <AppIcon name="users" size={26} />
                    </span>
                    <div>
                      <h3>Datos del alumno</h3>
                      <p>Confirma identidad y grado antes de continuar.</p>
                    </div>
                  </div>
                  <div className="form-grid">
                    <label className="field-label">
                      Nombre *
                      <input
                        required
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                      />
                    </label>
                    <label className="field-label">
                      Apellido *
                      <input
                        required
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                      />
                    </label>
                    {field({
                      key: "birthDate",
                      label: "Fecha de nacimiento",
                      type: "date",
                    })}
                    <div className="info-tile">
                      <small>EDAD</small>
                      <strong>{age == null ? "—" : `${age} años`}</strong>
                    </div>
                    {field({ key: "studentDpi", label: "DPI del alumno" })}
                    {field({ key: "familyName", label: "Nombre de familia" })}
                    <label className="field-label">
                      Grado 2027 *
                      <select
                        value={gradeId || ""}
                        onChange={(event) =>
                          setGradeId(Number(event.target.value))
                        }
                      >
                        <option value="">Selecciona un grado</option>
                        {bootstrap?.gradeLevels.map((grade) => (
                          <option key={grade.id} value={grade.id}>
                            {grade.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field-label">
                      Sección
                      <input
                        value={section}
                        onChange={(event) => setSection(event.target.value)}
                        placeholder="A"
                      />
                    </label>
                    <div className="form-grid-full">
                      {field({ key: "address", label: "Dirección" })}
                    </div>
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="wizard-content">
                  <div className="form-intro">
                    <span className="intro-icon coral">
                      <AppIcon name="users" size={26} />
                    </span>
                    <div>
                      <h3>Familia y contactos</h3>
                      <p>Datos para comunicación y atención del alumno.</p>
                    </div>
                  </div>
                  <section className="form-subsection">
                    <h4>Madre</h4>
                    <div className="form-grid">{motherFields.map(field)}</div>
                  </section>
                  <section className="form-subsection">
                    <h4>Padre</h4>
                    <div className="form-grid">{fatherFields.map(field)}</div>
                  </section>
                  <section className="form-subsection">
                    <h4>Emergencia</h4>
                    <div className="form-grid">
                      {[
                        { key: "emergencyContactName", label: "Contacto" },
                        {
                          key: "emergencyContactPhone",
                          label: "Celular",
                          type: "tel",
                        },
                        {
                          key: "emergencyPhone",
                          label: "Teléfono alterno",
                          type: "tel",
                        },
                        { key: "attendedBy", label: "Personal que atendió" },
                      ].map(field)}
                    </div>
                  </section>
                </div>
              )}
              {step === 2 && (
                <div className="wizard-content">
                  <div className="form-intro">
                    <span className="intro-icon mint">
                      <AppIcon name="receipt" size={26} />
                    </span>
                    <div>
                      <h3>Representante y contrato</h3>
                      <p>Revisa los datos antes de confirmar la inscripción.</p>
                    </div>
                  </div>
                  <section className="form-subsection">
                    <h4>Representante</h4>
                    <div className="form-grid">
                      <label className="field-label">
                        Tipo de representante
                        <select
                          value={String(profile.representativeType || "")}
                          onChange={(event) =>
                            setProfile((current) => ({
                              ...current,
                              representativeType: event.target.value,
                            }))
                          }
                        >
                          <option value="">Seleccionar</option>
                          <option value="MOTHER">Madre</option>
                          <option value="FATHER">Padre</option>
                          <option value="OTHER">Otro</option>
                        </select>
                      </label>
                      {representativeFields.map(field)}
                      <label className="field-label">
                        Tipo de documento
                        <select value={String(profile.representativeDocumentType || "")} onChange={(event) => setProfile((current) => ({ ...current, representativeDocumentType: event.target.value }))}>
                          <option value="">Seleccionar</option>
                          <option value="DPI">DPI</option>
                          <option value="PASAPORTE">Pasaporte</option>
                          <option value="OTRO">Otro</option>
                        </select>
                      </label>
                    </div>
                  </section>
                  <section className="form-subsection">
                    <h4>Condiciones del contrato</h4>
                    <div className="form-grid">
                      {[
                        { key: "educationLevel", label: "Nivel" },
                        { key: "career", label: "Carrera" },
                        { key: "schedulePlan", label: "Jornada" },
                        { key: "studyPlan", label: "Plan de estudios" },
                        { key: "contractNumber", label: "Número de contrato" },
                        {
                          key: "contractDiacoResolution",
                          label: "Resolución DIACO",
                        },
                        {
                          key: "enrollmentFee",
                          label: "Cuota de inscripción (Q)",
                          type: "number",
                        },
                        {
                          key: "monthlyFee",
                          label: "Cuota mensual (Q)",
                          type: "number",
                        },
                        {
                          key: "contractSignedAt",
                          label: "Fecha de firma",
                          type: "date",
                        },
                      ].map(field)}
                    </div>
                  </section>
                  <section className="form-subsection">
                    <h4>Firmas</h4>
                    <div className="signature-grid">
                      <SignaturePad
                        label="Firma del representante del contrato"
                        value={String(profile.representativeSignatureBase64 || "")}
                        onChange={(value) => setProfile((current) => ({ ...current, representativeSignatureBase64: value }))}
                      />
                      <SignaturePad
                        label="Firma de madre"
                        value={String(profile.motherSignatureBase64 || "")}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            motherSignatureType: "DRAWING",
                            motherSignatureBase64: value,
                          }))
                        }
                      />
                      <SignaturePad
                        label="Firma de padre"
                        value={String(profile.fatherSignatureBase64 || "")}
                        onChange={(value) =>
                          setProfile((current) => ({
                            ...current,
                            fatherSignatureType: "DRAWING",
                            fatherSignatureBase64: value,
                          }))
                        }
                      />
                    </div>
                  </section>
                  <div className="form-grid-full">
                    {field({ key: "otherNotes", label: "Notas de atención" })}
                  </div>
                </div>
              )}
              {error && (
                <p className="alert-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <footer className="modal-actions wizard-actions">
              <button
                className="button button-soft"
                onClick={() => (step ? setStep(step - 1) : onClose())}
              >
                {step ? "Atrás" : "Cancelar"}
              </button>
              <div>
                {saved && (
                  <a
                    className="button button-soft"
                    target="_blank"
                    rel="noreferrer"
                    href={`/api/operations/enrollments/${saved.id}/contract`}
                  >
                    Ver contrato
                  </a>
                )}
                <button
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => (step === 2 ? void saveEnrollment() : next())}
                >
                  {busy
                    ? "Guardando…"
                    : step === 2
                      ? saved
                        ? "Guardar y ver pedidos"
                        : "Inscribir y ver pedidos"
                      : "Continuar"}
                  <AppIcon name="arrow" size={18} />
                </button>
              </div>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
