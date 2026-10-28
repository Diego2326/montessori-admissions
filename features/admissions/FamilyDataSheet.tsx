"use client";

import { useEffect, useMemo, useState } from "react";
import type { MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { operation, save } from "@/lib/operations/client";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import type { Bootstrap, Enrollment, FamilyIntake } from "@/lib/operations/types";

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

export function FamilyDataSheet({ familyId }: { familyId: number }) {
  const [family, setFamily] = useState<FamilyIntake | null>(null);
  const [candidates, setCandidates] = useState<AdmissionCandidate[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyEnrollmentId, setBusyEnrollmentId] = useState<number | null>(null);
  const [signatureTarget, setSignatureTarget] = useState<Enrollment | null>(null);
  const [activity, setActivity] = useState<FamilyActivity[]>([]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
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
        setCandidates(overview.candidates);
        setEnrollments(nextEnrollments);
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
      if (candidate.familyId !== family.id) continue;
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
                {detail("Correo del representante", profile.representativeEmail)}
              </div>
            </section>

            <section className="family-sheet-card">
              <div className="family-sheet-section-heading"><div><span className="family-sheet-label">CONTACTOS</span><h2>Madre y padre</h2></div></div>
              <div className="family-sheet-parent-grid">
                <article><span className="family-sheet-label">MADRE</span><h3>{display(profile.motherName)}</h3><p>{display(profile.motherPhone)}</p><p>{display(profile.motherEmail)}</p></article>
                <article><span className="family-sheet-label">PADRE</span><h3>{display(profile.fatherName)}</h3><p>{display(profile.fatherPhone)}</p><p>{display(profile.fatherEmail)}</p></article>
              </div>
            </section>

            <section className="family-sheet-card family-sheet-children">
              <div className="family-sheet-section-heading"><div><span className="family-sheet-label">ALUMNOS</span><h2>Inscripciones de la familia</h2></div><span>{children.length} alumno{children.length === 1 ? "" : "s"}</span></div>
              {children.length === 0 && <p className="family-sheet-empty">No hay alumnos vinculados a esta familia.</p>}
              {children.map((child) => {
                const enrollment = enrollments.find((item) => item.studentId === child.id);
                const status = enrollmentLabel(enrollment);
                return <article className="family-sheet-child" key={child.id}>
                  <div className="family-sheet-child-name"><strong>{child.firstName} {child.lastName}</strong><span>{child.currentGrade || enrollment?.gradeName || "Grado sin registrar"}</span></div>
                  <span className={`pre-enrollment-status ${status.className}`}>{status.label}</span>
                  <div className="family-sheet-child-actions">
                    <Link href={`/inscripciones/reinscripcion/alumno/${child.id}`} onClick={(event) => void startReenrollment(event, child)}>Iniciar reinscripción</Link>
                    {enrollment && <a className="subtle" href={`/api/operations/enrollments/${enrollment.id}/contract.pdf`} target="_blank" rel="noreferrer">Imprimir contrato</a>}
                    {enrollment?.status === "PENDIENTE_FIRMA" && <button type="button" disabled={busyEnrollmentId === enrollment.id} onClick={() => setSignatureTarget(enrollment)}>{busyEnrollmentId === enrollment.id ? "Guardando…" : "Marcar contrato firmado"}</button>}
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
          <h2 id="signature-confirm-title">¿El representante ya firmó el contrato?</h2>
          <p>Se registrará la firma del contrato impreso de <strong>{signatureTarget.studentFirstName} {signatureTarget.studentLastName}</strong> y quedará guardado qué usuario hizo el cambio.</p>
          <div className="family-sheet-confirm-actions">
            <button type="button" className="cancel" disabled={busyEnrollmentId === signatureTarget.id} onClick={() => setSignatureTarget(null)}>Cancelar</button>
            <button type="button" disabled={busyEnrollmentId === signatureTarget.id} onClick={() => void markContractSigned(signatureTarget)}>{busyEnrollmentId === signatureTarget.id ? "Guardando…" : "Sí, registrar firma"}</button>
          </div>
        </section>
      </div>}
    </>
  );
}
