"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { operation, save } from "@/lib/operations/client";
import type { Bootstrap } from "@/lib/operations/types";
import "./owned-enrollment.css";

type Family = { id: string; name: string; representativeFirstName: string; representativeLastName: string; representativeDocumentType: string; representativeDocumentNumber: string; representativePhone: string | null; address: string | null };
type Student = { uuid: string; firstName: string; lastName: string; gradeId: number | null; section: string | null; active: boolean };
type Enrollment = { id: string; familyId: string | null; studentUuid: string; firstName: string; lastName: string; schoolYear: number; gradeId: number; section: string | null; status: string; feeChargeId: string; signedAt: string | null };
type Charge = { amount: number; paidAmount: number; paid: boolean };

export function OwnedEnrollmentFlow() {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [familyId] = useState(() => crypto.randomUUID());
  const [enrollmentId] = useState(() => crypto.randomUUID());
  const [family, setFamily] = useState<Family | null>(null);
  const [familyName, setFamilyName] = useState("");
  const [repFirst, setRepFirst] = useState("");
  const [repLast, setRepLast] = useState("");
  const [repDocument, setRepDocument] = useState("");
  const [repPhone, setRepPhone] = useState("");
  const [address, setAddress] = useState("");
  const [familySearch, setFamilySearch] = useState("");
  const [familyMatches, setFamilyMatches] = useState<Family[]>([]);
  const [existing, setExisting] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentMatches, setStudentMatches] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [section, setSection] = useState("");
  const [fee, setFee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [charge, setCharge] = useState<Charge | null>(null);
  const [reference, setReference] = useState("");
  const [intentId, setIntentId] = useState<string | null>(null);
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { void operation<Bootstrap>("enrollments/bootstrap").then(setBootstrap).catch((cause) => setError(String(cause))); }, []);

  async function searchFamilies() {
    try { setFamilyMatches(await operation<Family[]>(`v2/families?q=${encodeURIComponent(familySearch)}`)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron consultar las familias"); }
  }
  async function createFamily() {
    setBusy(true); setError("");
    try {
      const saved = await save<Family>(`v2/families/${familyId}`, {
        name: familyName.trim(), representativeFirstName: repFirst.trim(), representativeLastName: repLast.trim(),
        representativeDocumentType: "DPI", representativeDocumentNumber: repDocument.trim(),
        representativePhone: repPhone.trim() || null, address: address.trim() || null,
      }, "PUT");
      setFamily(saved);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la familia"); }
    finally { setBusy(false); }
  }
  async function searchStudents() {
    try { setStudentMatches(await operation<Student[]>(`students/directory?q=${encodeURIComponent(studentSearch)}&limit=25`)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo consultar el directorio"); }
  }
  async function createEnrollment() {
    if (!family || !gradeId || !fee || !dueDate || (existing ? !student : !firstName.trim() || !lastName.trim())) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await save<Enrollment>(`v2/enrollments/${enrollmentId}`, {
        familyId: family.id, studentUuid: existing ? student?.uuid : null,
        firstName: existing ? student?.firstName : firstName.trim(),
        lastName: existing ? student?.lastName : lastName.trim(),
        schoolYear: 2027, gradeId: Number(gradeId), section: section.trim() || null,
        enrollmentFee: Number(fee), feeDueDate: dueDate,
      }, "PUT");
      setEnrollment(saved);
      setCharge(await operation<Charge>(`v2/enrollments/${saved.id}/charge`));
      setNotice("Expediente y cargo creados. La firma del contrato sigue pendiente.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : `No se pudo guardar. Reintenta con el UUID ${enrollmentId}.`); }
    finally { setBusy(false); }
  }
  async function confirmPayment() {
    if (!enrollment || !reference.trim()) return;
    const id = intentId ?? crypto.randomUUID();
    const timestamp = receivedAt ?? new Date().toISOString();
    setIntentId(id); setReceivedAt(timestamp); setBusy(true); setError(""); setNotice("");
    try {
      await save(`v2/enrollments/${enrollment.id}/payment-intents/${id}`, { method: "MANUAL" }, "PUT");
      const updated = await save<Enrollment>(`v2/enrollments/${enrollment.id}/payment-intents/${id}/confirm-manual`, { reference: reference.trim(), receivedAt: timestamp });
      setEnrollment(updated); setCharge(await operation<Charge>(`v2/enrollments/${enrollment.id}/charge`));
      setNotice(updated.signedAt ? "Pago manual confirmado. Revisa la activación y la proyección académica." : "Pago manual confirmado. El expediente queda pendiente de la firma del contrato.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Revisa el intento ${id} antes de reintentar.`); }
    finally { setBusy(false); }
  }

  return <div className="owned-flow">
    <div className="section-heading"><div><span className="eyebrow">BASE NUEVA · 2027</span><h1>Inscripción nueva</h1><p>Familia, alumno e inscripción se guardan con UUID. El contrato se gestiona antes de activar al alumno.</p></div><Link className="button" href="/">Volver</Link></div>
    {error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="owned-notice" role="status">{notice}</p>}
    <section className="owned-card"><h2>1. Familia y representante</h2>{family ? <p><strong>{family.name}</strong> · {family.representativeFirstName} {family.representativeLastName} <button className="button" type="button" onClick={() => setFamily(null)}>Cambiar</button></p> : <>
      <div className="owned-row"><label>Buscar familia existente<input value={familySearch} onChange={(event) => setFamilySearch(event.target.value)} /></label><button className="button" type="button" onClick={() => void searchFamilies()}>Buscar</button></div>
      {familyMatches.map((item) => <button className="owned-result" type="button" key={item.id} onClick={() => setFamily(item)}>{item.name} · {item.representativeFirstName} {item.representativeLastName}</button>)}
      <div className="owned-grid"><label>Nombre de familia<input value={familyName} onChange={(event) => setFamilyName(event.target.value)} /></label><label>Nombres del representante<input value={repFirst} onChange={(event) => setRepFirst(event.target.value)} /></label><label>Apellidos<input value={repLast} onChange={(event) => setRepLast(event.target.value)} /></label><label>DPI<input value={repDocument} onChange={(event) => setRepDocument(event.target.value)} /></label><label>Teléfono<input value={repPhone} onChange={(event) => setRepPhone(event.target.value)} /></label><label>Dirección<input value={address} onChange={(event) => setAddress(event.target.value)} /></label></div>
      <button className="button button-primary" disabled={busy || !familyName.trim() || !repFirst.trim() || !repLast.trim() || !repDocument.trim()} onClick={() => void createFamily()}>Guardar familia</button>
    </>}</section>
    <section className="owned-card"><h2>2. Alumno</h2><label className="owned-check"><input type="checkbox" checked={existing} onChange={(event) => { setExisting(event.target.checked); setStudent(null); setStudentMatches([]); }} /> Ya estudia en Montessori</label>{existing ? <><div className="owned-row"><label>Nombre o UUID<input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} /></label><button className="button" type="button" onClick={() => void searchStudents()}>Buscar</button></div>{student && <p>Seleccionado: <strong>{student.firstName} {student.lastName}</strong> · {student.uuid}</p>}{studentMatches.filter((item) => item.active).map((item) => <button className="owned-result" type="button" key={item.uuid} onClick={() => { setStudent(item); setGradeId(item.gradeId ? String(item.gradeId) : ""); setSection(item.section ?? ""); }}>{item.firstName} {item.lastName} · {item.uuid}</button>)}</> : <div className="owned-grid"><label>Nombres<input value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label>Apellidos<input value={lastName} onChange={(event) => setLastName(event.target.value)} /></label></div>}</section>
    <section className="owned-card"><h2>3. Inscripción y cargo</h2><div className="owned-grid"><label>Grado<select value={gradeId} onChange={(event) => setGradeId(event.target.value)}><option value="">Selecciona grado</option>{bootstrap?.gradeLevels.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label><label>Sección<input value={section} onChange={(event) => setSection(event.target.value)} /></label><label>Cuota de inscripción (Q)<input type="number" min="0.01" step="0.01" value={fee} onChange={(event) => setFee(event.target.value)} /></label><label>Vencimiento<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div><p>UUID de operación: <code>{enrollmentId}</code></p><button className="button button-primary" disabled={busy || !!enrollment || !family || !gradeId || !fee || !dueDate || (existing ? !student : !firstName.trim() || !lastName.trim())} onClick={() => void createEnrollment()}>{busy ? "Guardando…" : "Crear expediente y cargo"}</button></section>
    {enrollment && <section className="owned-card"><h2>4. Estado y pago manual</h2><p><strong>{enrollment.firstName} {enrollment.lastName}</strong> · {enrollment.status}</p><p>Alumno UUID: <code>{enrollment.studentUuid}</code><br />Inscripción UUID: <code>{enrollment.id}</code></p><p>Cargo: Q {Number(charge?.amount ?? 0).toFixed(2)} · Pagado: Q {Number(charge?.paidAmount ?? 0).toFixed(2)}</p>{!charge?.paid && <div className="owned-row"><label>Referencia del pago recibido<input value={reference} onChange={(event) => setReference(event.target.value)} /></label><button className="button button-primary" disabled={busy || !reference.trim()} onClick={() => void confirmPayment()}>Confirmar pago manual</button></div>}<p>La activación requiere firma registrada del contrato aprobado y conciliación con identidad y LMS.</p></section>}
  </div>;
}
