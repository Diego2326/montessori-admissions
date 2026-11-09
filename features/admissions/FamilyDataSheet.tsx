"use client";

import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { operation, save } from "@/lib/operations/client";
import { isMissingOperation } from "@/lib/operations/client-error";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import type { Bootstrap, Enrollment, FamilyIntake } from "@/lib/operations/types";
import { isDeviceUsePolicyApplicable } from "@/features/admissions/device-use-policy";
import { isEnglishTimeApplicable } from "@/features/admissions/english-time";

type FamilyChild = {
  id: number;
  firstName: string;
  lastName: string;
  currentGrade: string | null;
};

type FamilyActivity = {
  id: number;
  action: string;
  description: string;
  studentName?: string | null;
  actorUserId?: number | null;
  actorName: string;
  createdAt: string;
};

type EnrollmentProgress = {
  enrollmentId: number;
  studentId: number;
  studentName: string;
  gradeName: string;
  enrollmentStatus: string;
  currentStep: string;
  currentStepLabel: string;
  paymentStatus: string;
  insuranceSelection: string | null;
  otherInsuranceName: string | null;
  steps: Array<{ code: string; label: string; completed: boolean; completedAt: string | null }>;
};

function display(value: unknown) {
  if (value == null || String(value).trim() === "") return "Sin registrar";
  return String(value);
}

function detail(label: string, value: unknown) {
  return <div className="family-sheet-detail" key={label}><span>{label}</span><strong>{display(value)}</strong></div>;
}

function enrollmentLabel(enrollment?: Enrollment) {
  if (enrollment?.status === "ACTIVO") return { label: "Inscrito", className: "complete" };
  if (enrollment?.status === "PENDIENTE_FIRMA") return { label: "Por firmar", className: "pending" };
  return { label: "No inscrito", className: "unlinked" };
}

function selectedRepresentativeEmail(profile: FamilyIntake["profile"]) {
  const type = String(profile.representativeType ?? "").toUpperCase();
  const parentEmail = type === "MOTHER" ? profile.motherEmail : type === "FATHER" ? profile.fatherEmail : null;
  return String(parentEmail || profile.representativeEmail || "").trim();
}

export function FamilyDataSheet({ familyId }: { familyId: number }) {
  const [family, setFamily] = useState<FamilyIntake | null>(null);
  const [candidates, setCandidates] = useState<AdmissionCandidate[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyEnrollmentId, setBusyEnrollmentId] = useState<number | null>(null);
  const [emailBusy, setEmailBusy] = useState<"saving" | "sending" | null>(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [signatureTarget, setSignatureTarget] = useState<Enrollment | null>(null);
  const [activity, setActivity] = useState<FamilyActivity[]>([]);
  const [progress, setProgress] = useState<EnrollmentProgress[]>([]);
  const [progressAvailable, setProgressAvailable] = useState<boolean | null>(null);
  const [progressRequestFailed, setProgressRequestFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const progressRequest = operation<{ students: EnrollmentProgress[] }>(`admission-workflow/families/${familyId}/progress?schoolYear=2027`)
          .then((result) => {
            if (!active) return;
            setProgress(result.students ?? []);
            setProgressAvailable(true);
            setProgressRequestFailed(false);
          })
          .catch((cause: unknown) => {
            if (!active) return;
            if (isMissingOperation(cause)) {
              setProgress([]);
              setProgressAvailable(false);
            } else {
              setProgressRequestFailed(true);
            }
          });
        const [familyResult, overview, bootstrap] = await Promise.all([
          operation<FamilyIntake>(`admission-workflow/families/${familyId}`),
          operation<{ candidates: AdmissionCandidate[] }>("admission-workflow/2027/overview"),
          operation<Bootstrap>("enrollments/bootstrap"),
        ]);
        const schoolYear = bootstrap.schoolYears.find((item) => item.year === 2027);
        const nextEnrollments = schoolYear
          ? await operation<Enrollment[]>(`enrollments?schoolYearId=${schoolYear.id}`)
          : [];
        if (!active) return;
        setFamily(familyResult);
        setRecipientEmail(selectedRepresentativeEmail(familyResult.profile));
        setCandidates(overview.candidates);
        setEnrollments(nextEnrollments);
        void progressRequest;
        try {
          await save(`admission-workflow/families/${familyId}/activity`, { action: "FAMILY_SHEET_VIEWED" });
          const entries = await operation<FamilyActivity[]>(`admission-workflow/families/${familyId}/activity`);
          if (active) setActivity(entries);
        } catch {
          // Keep the family record available if the audit service is temporarily unavailable.
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudo cargar la ficha familiar.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [familyId]);

  useEffect(() => {
    // The progress endpoint is optional and is not deployed on every API version.
    // Stop the background polling after its first unavailable response.
    if (progressAvailable === false) return;
    let active = true;
    const refresh = async () => {
      try {
        const latest = await operation<{ students: EnrollmentProgress[] }>(`admission-workflow/families/${familyId}/progress?schoolYear=2027`);
        if (active) {
          setProgress(latest.students ?? []);
          setProgressAvailable(true);
          setProgressRequestFailed(false);
        }
      } catch (cause) {
        if (!active) return;
        if (isMissingOperation(cause)) {
          setProgress([]);
          setProgressAvailable(false);
        } else {
          setProgressRequestFailed(true);
        }
      }
    };
    const timer = window.setInterval(() => void refresh(), 15000);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [familyId, progressAvailable]);

  const children = useMemo(() => {
    if (!family) return [];
    const rows = new Map<number, FamilyChild>();
    for (const student of family.activeStudents ?? []) {
      if (student.studentId == null) continue;
      rows.set(student.studentId, {
        id: student.studentId,
        firstName: student.firstName,
        lastName: student.lastName,
        currentGrade: student.currentGrade,
      });
    }
    for (const candidate of candidates) {
      if (candidate.familyId !== family.id || rows.has(candidate.id)) continue;
      rows.set(candidate.id, {
        id: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        currentGrade: candidate.currentGrade,
      });
    }
    return [...rows.values()].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, "es"));
  }, [candidates, family]);

  async function markContractSigned(enrollment: Enrollment) {
    setBusyEnrollmentId(enrollment.id);
    setError("");
    try {
      const updated = await save<Enrollment>(`enrollments/${enrollment.id}/contract-signature`, {}, "POST");
      setEnrollments((current) => current.map((item) => item.id === enrollment.id ? updated : item));
      setSignatureTarget(null);
      setActivity(await operation<FamilyActivity[]>(`admission-workflow/families/${familyId}/activity`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo registrar la firma del contrato.");
    } finally {
      setBusyEnrollmentId(null);
    }
  }

  async function startReenrollment(event: MouseEvent<HTMLAnchorElement>, child: FamilyChild) {
    event.preventDefault();
    setError("");
    try {
      await save(`admission-workflow/families/${familyId}/activity`, { action: "REENROLLMENT_STARTED", studentId: child.id });
      window.location.assign(`/inscripciones/reinscripcion/alumno/${child.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar la actividad de reinscripción.");
    }
  }

  const profile = family?.profile ?? {};
  const representativeName = [profile.representativeFirstName, profile.representativeLastName].filter(Boolean).join(" ") || profile.representativeName;
  const progressGroups = [...progress.reduce((groups, student) => {
    const current = groups.get(student.currentStep) ?? { label: student.currentStepLabel, students: [] as EnrollmentProgress[] };
    current.students.push(student);
    groups.set(student.currentStep, current);
    return groups;
  }, new Map<string, { label: string; students: EnrollmentProgress[] }>()).values()];

  async function saveRecipientEmail(email: string) {
    if (!family) throw new Error("No se encontró la ficha familiar.");
    const selectedProfile = {
      ...family.profile,
      representativeEmail: email,
      ...(String(family.profile.representativeType ?? "").toUpperCase() === "MOTHER" ? { motherEmail: email } : {}),
      ...(String(family.profile.representativeType ?? "").toUpperCase() === "FATHER" ? { fatherEmail: email } : {}),
    };
    const updated = await save<FamilyIntake>(`admission-workflow/families/${family.id}`, {
      name: family.name,
      profile: selectedProfile,
    }, "PUT");
    setFamily(updated);
    setRecipientEmail(email);
    return updated;
  }

  async function persistEmail() {
    const email = recipientEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Escribe un correo electrónico válido.");
      setEmailMessage("");
      return;
    }
    setEmailBusy("saving");
    setEmailError("");
    setEmailMessage("");
    try {
      await saveRecipientEmail(email);
      setEditingEmail(false);
      setEmailMessage("Correo actualizado.");
    } catch (cause) {
      setEmailError(cause instanceof Error ? cause.message : "No se pudo guardar el correo.");
    } finally {
      setEmailBusy(null);
    }
  }

  async function resendEmail() {
    const email = recipientEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEditingEmail(true);
      setEmailError("Escribe un correo electrónico válido antes de reenviar.");
      setEmailMessage("");
      return;
    }
    setEmailBusy("sending");
    setEmailError("");
    setEmailMessage("");
    try {
      const savedFamily = await saveRecipientEmail(email);
      const response = await save<{ sent: boolean }>(`admission-workflow/families/${familyId}/completion-email`, {
        schoolYear: 2027,
        recipientEmail: email,
      });
      if (!response.sent) throw new Error("No se pudo reenviar el correo.");
      setFamily(savedFamily);
      setEditingEmail(false);
      setEmailMessage(`Correo reenviado a ${email}.`);
      try {
        setActivity(await operation<FamilyActivity[]>(`admission-workflow/families/${familyId}/activity`));
      } catch {
        // The email can be sent even if the activity log is temporarily unavailable.
      }
    } catch (cause) {
      setEmailError(cause instanceof Error ? cause.message : "No se pudo reenviar el correo.");
    } finally {
      setEmailBusy(null);
    }
  }

  return (
    <>
      <header className="admissions-brand-header">
        <div className="admissions-brand">
          <Image unoptimized src="/logo-colegio.png" width={46} height={46} alt="" />
          <span><small>Colegio Bilingüe</small><strong>Montessori</strong><em>Zacapa</em></span>
        </div>
      </header>
      <main className="family-sheet-page">
        <div className="family-sheet-wrap">
          <Link className="family-sheet-back" href="/">← Volver a inscripciones</Link>
          <div className="family-sheet-heading">
            <div><span className="eyebrow">EXPEDIENTE FAMILIAR · CICLO 2027</span><h1>Ficha de datos</h1><p>Información familiar y estado de inscripción de cada alumno.</p></div>
            {family && <span className="family-sheet-id">Familia #{family.id}</span>}
          </div>

          {loading && <section className="family-sheet-message" role="status">Cargando ficha familiar…</section>}
          {error && <p className="family-sheet-error" role="alert">{error}</p>}
          {!loading && family && <>
            <section className="family-sheet-card family-sheet-summary">
              <div><span className="family-sheet-label">FAMILIA</span><h2>{family.name}</h2></div>
              <span className={`family-sheet-review ${family.reviewStatus === "REVIEWED" ? "complete" : "pending"}`}>{family.reviewStatus === "REVIEWED" ? "Datos revisados" : "Datos por revisar"}</span>
            </section>

            <section className="family-sheet-card">
              <div className="family-sheet-section-heading"><div><span className="family-sheet-label">DATOS COMPARTIDOS</span><h2>Domicilio y representante</h2></div></div>
              <div className="family-sheet-detail-grid">
                {detail("Dirección", profile.address)}
                {detail("Departamento", profile.department)}
                {detail("Municipio", profile.municipality || profile.city)}
                {detail("Representante", representativeName)}
                {detail("Parentesco", profile.representativeType)}
                {detail("Documento", profile.representativeDocument)}
                {detail("Teléfono del representante", profile.representativeMobilePhone)}
              </div>
              <div className="family-sheet-email-tools">
                <div className="family-sheet-email-value">
                  <span className="family-sheet-label">CORREO PARA CONTRATO Y SEGURO</span>
                  {editingEmail
                    ? <input aria-label="Correo para recibir el contrato y seguro" type="email" autoComplete="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} />
                    : <strong>{display(selectedRepresentativeEmail(profile))}</strong>}
                </div>
                <div className="family-sheet-email-actions">
                  {editingEmail
                    ? <>
                      <button type="button" className="secondary" disabled={emailBusy !== null} onClick={() => { setRecipientEmail(selectedRepresentativeEmail(profile)); setEditingEmail(false); setEmailError(""); }}>Cancelar</button>
                      <button type="button" className="secondary" disabled={emailBusy !== null} onClick={() => void persistEmail()}>{emailBusy === "saving" ? "Guardando…" : "Guardar correo"}</button>
                    </>
                    : <button type="button" className="secondary" disabled={emailBusy !== null} onClick={() => { setRecipientEmail(selectedRepresentativeEmail(profile)); setEditingEmail(true); setEmailError(""); }}>Editar correo</button>}
                  <button type="button" disabled={emailBusy !== null} onClick={() => void resendEmail()}>
                    {emailBusy === "sending" ? "Enviando…" : editingEmail ? "Guardar y reenviar correo" : "Reenviar correo"}
                  </button>
                </div>
              </div>
              {emailError && <p className="family-sheet-error" role="alert">{emailError}</p>}
              {emailMessage && <p className="family-sheet-email-message" role="status">{emailMessage}</p>}
            </section>

            <section className="family-sheet-card">
              <div className="family-sheet-section-heading"><div><span className="family-sheet-label">CONTACTOS</span><h2>Madre y padre</h2></div></div>
              <div className="family-sheet-parent-grid">
                <article><span className="family-sheet-label">MADRE</span><h3>{display(profile.motherName)}</h3><p>{display(profile.motherPhone)}</p><p>{display(profile.motherEmail)}</p></article>
                <article><span className="family-sheet-label">PADRE</span><h3>{display(profile.fatherName)}</h3><p>{display(profile.fatherPhone)}</p><p>{display(profile.fatherEmail)}</p></article>
              </div>
            </section>

            <section className="family-sheet-card family-sheet-progress">
              <div className="family-sheet-section-heading"><div><span className="family-sheet-label">AVANCE COMPARTIDO</span><h2>Proceso de inscripción 2027</h2></div><span className="family-sheet-live"><i />{progressAvailable === null ? progressRequestFailed ? "Reintentando…" : "Consultando…" : progressAvailable ? progressRequestFailed ? "Error de actualización" : "Actualizado en vivo" : "API pendiente"}</span></div>
              {progressAvailable === null ? <p className="family-sheet-empty" role="status">{progressRequestFailed ? "No se pudo consultar el avance. Se volverá a intentar automáticamente." : "Consultando el avance de inscripción…"}</p> : !progressAvailable ? <p className="family-sheet-empty">El avance todavía no está disponible. Los alumnos y datos de la familia sí se muestran con normalidad.</p> : progressGroups.length === 0 ? <p className="family-sheet-empty">Todavía no hay inscripciones guardadas para este ciclo.</p> : <div className="family-progress-list">
                {progressGroups.map((group) => <article className="family-progress-row" key={group.students[0]?.currentStep}>
                  <span className="family-progress-check">{group.students[0]?.steps.filter((step) => step.completed).length}</span>
                  <div><strong>{group.label}</strong><p>{group.students.map((student) => student.studentName).join(" · ")}</p><small>{group.students.map((student) => student.gradeName).filter((grade, index, all) => all.indexOf(grade) === index).join(" · ")}</small></div>
                  <span className="family-progress-payment">{group.students.filter((student) => student.paymentStatus === "PAID").length}/{group.students.length} pagos completos</span>
                </article>)}
              </div>}
            </section>

            <section className="family-sheet-card family-sheet-children">
              <div className="family-sheet-section-heading"><div><span className="family-sheet-label">ALUMNOS</span><h2>Inscripciones de la familia</h2></div><span>{children.length} alumno{children.length === 1 ? "" : "s"}</span></div>
              {children.length === 0 && <p className="family-sheet-empty">No hay alumnos vinculados a esta familia.</p>}
              {children.map((child) => {
                const enrollment = enrollments.find((item) => item.studentId === child.id);
                const status = enrollmentLabel(enrollment);
                const requiresDevicePolicy = Boolean(enrollment && isDeviceUsePolicyApplicable(enrollment.gradeName, enrollment.schoolYear));
                const requiresEnglishTimeLetter = Boolean(enrollment && isEnglishTimeApplicable(enrollment.gradeName, enrollment.schoolYear));
                return <article className="family-sheet-child" key={child.id}>
                  <div className="family-sheet-child-name"><strong>{child.firstName} {child.lastName}</strong><span>{child.currentGrade || enrollment?.gradeName || "Grado sin registrar"}</span></div>
                  <span className={`pre-enrollment-status ${status.className}`}>{status.label}</span>
                  <div className="family-sheet-child-actions">
                    {!enrollment && <Link href={`/inscripciones/reinscripcion/alumno/${child.id}`} onClick={(event) => void startReenrollment(event, child)}>Iniciar reinscripción</Link>}
                    {enrollment?.status === "PENDIENTE_FIRMA" && <Link href={`/inscripciones/nueva?${new URLSearchParams({ familyId: String(familyId), studentId: String(child.id), enrollmentId: String(enrollment.id), mode: "reinscripcion" })}`}>Editar datos</Link>}
                    {enrollment && enrollment.status !== "PENDIENTE_FIRMA" && <button type="button" className="is-locked" disabled title={enrollment.status === "ACTIVO" ? "Una inscripción activa no se puede editar." : "Esta inscripción no se puede editar."} aria-label={`Editar datos de ${child.firstName} ${child.lastName}: la inscripción no se puede editar`}>Editar datos</button>}
                    {enrollment && <a className="subtle" href={`/api/operations/enrollments/${enrollment.id}/contract.pdf`} target="_blank" rel="noreferrer">Imprimir contrato</a>}
                    {enrollment?.profile?.insuranceSelection === "SCHOOL" && <a className="subtle" href={`/api/operations/enrollments/${enrollment.id}/insurance.pdf`} target="_blank" rel="noreferrer">Imprimir seguro escolar</a>}
                    {enrollment && requiresDevicePolicy && <a className="subtle" href={`/api/operations/enrollments/${enrollment.id}/device-use-policy.pdf`} target="_blank" rel="noreferrer">Imprimir reglamento de dispositivos</a>}
                    {enrollment && requiresEnglishTimeLetter && <a className="subtle" href={`/api/operations/enrollments/${enrollment.id}/english-time-commitment.pdf`} target="_blank" rel="noreferrer">Imprimir carta English Time</a>}
                    {enrollment?.status === "PENDIENTE_FIRMA" && <button type="button" disabled={busyEnrollmentId === enrollment.id} onClick={() => setSignatureTarget(enrollment)}>{busyEnrollmentId === enrollment.id ? "Guardando…" : "Marcar documentos firmados"}</button>}
                  </div>
                </article>;
              })}
            </section>
            <section className="family-sheet-card family-sheet-activity">
              <div className="family-sheet-section-heading"><div><span className="family-sheet-label">TRAZABILIDAD</span><h2>Actividad de la ficha</h2></div></div>
              {activity.length === 0 ? <p className="family-sheet-empty">Todavía no hay actividad registrada.</p> : <ol className="family-sheet-activity-list">
                {activity.map((entry) => <li key={entry.id}>
                  <span className="family-sheet-activity-dot" aria-hidden="true" />
                  <div><strong>{entry.description}</strong>{entry.studentName && <span>Alumno: {entry.studentName}</span>}<small>{entry.actorName} · {new Date(entry.createdAt).toLocaleString("es-GT", { dateStyle: "medium", timeStyle: "short" })}</small></div>
                </li>)}
              </ol>}
            </section>
          </>}
        </div>
      </main>
      {signatureTarget && <div className="family-sheet-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && busyEnrollmentId == null) setSignatureTarget(null); }}>
        <section className="family-sheet-confirm" role="dialog" aria-modal="true" aria-labelledby="signature-confirm-title">
          <span className="family-sheet-label">CONFIRMACIÓN</span>
          <h2 id="signature-confirm-title">¿El representante ya firmó los documentos obligatorios?</h2>
          <p>Confirma que <strong>{signatureTarget.studentFirstName} {signatureTarget.studentLastName}</strong> tiene firmado el contrato de adhesión{isDeviceUsePolicyApplicable(signatureTarget.gradeName, signatureTarget.schoolYear) ? " y el reglamento de uso de dispositivos electrónicos" : ""}{signatureTarget.profile?.insuranceSelection === "SCHOOL" ? " y el formulario del seguro escolar" : ""}. Se guardará qué usuario registró las firmas.</p>
          <div className="family-sheet-confirm-actions">
            <button type="button" className="cancel" disabled={busyEnrollmentId === signatureTarget.id} onClick={() => setSignatureTarget(null)}>Cancelar</button>
            <button type="button" disabled={busyEnrollmentId === signatureTarget.id} onClick={() => void markContractSigned(signatureTarget)}>{busyEnrollmentId === signatureTarget.id ? "Guardando…" : "Sí, registrar firmas"}</button>
          </div>
        </section>
      </div>}
    </>
  );
}
