"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { operation, save } from "@/lib/operations/client";
import type { Bootstrap } from "@/lib/operations/types";
import "./owned-enrollment.css";

type FamilyProfile = {
  representativeBirthDate: string | null;
  representativeCivilStatus: string | null;
  representativeNationality: string | null;
  representativeOccupation: string | null;
  representativeWorkplace: string | null;
  representativeHomePhone: string | null;
  representativeOfficePhone: string | null;
};
type FamilyDraft = {
  name: string;
  representativeFirstName: string;
  representativeLastName: string;
  representativeDocumentType: string;
  representativeDocumentNumber: string;
  representativePhone: string;
  representativeEmail: string;
  address: string;
  profile: FamilyProfile;
};
type Family = FamilyDraft & { id: string };
type Student = { uuid: string; firstName: string; lastName: string; birthDate: string | null; gradeId: number | null; section: string | null; active: boolean };
type Enrollment = { id: string; familyId: string | null; familyName?: string | null; studentUuid: string; firstName: string; lastName: string; schoolYear: number; gradeId: number; section: string | null; birthDate: string | null; status: string; feeChargeId: string; feeDueDate: string; enrollmentFee: number; signedAt: string | null; feePaidAt?: string | null; activatedAt?: string | null; contractNumber?: string | null };
type Charge = { amount: number; paidAmount: number; paid: boolean };
type PaperContract = { contractNumber: string; issuedAt: string; signedAt: string | null; snapshot?: Record<string, string> };
type ContractFields = { resolutionDiaco: string; educationLevel: string; monthlyFee: string; career: string; schedulePlan: string };

const blankFamily = (): FamilyDraft => ({
  name: "", representativeFirstName: "", representativeLastName: "",
  representativeDocumentType: "DPI", representativeDocumentNumber: "",
  representativePhone: "", representativeEmail: "", address: "",
  profile: { representativeBirthDate: "", representativeCivilStatus: "", representativeNationality: "guatemalteca", representativeOccupation: "", representativeWorkplace: "", representativeHomePhone: "", representativeOfficePhone: "" },
});
const blankContract = (): ContractFields => ({ resolutionDiaco: "", educationLevel: "", monthlyFee: "", career: "", schedulePlan: "Matutina" });
function hydrateFamily(family: Family): Family {
  const blank = blankFamily();
  return {
    ...blank,
    ...family,
    representativePhone: family.representativePhone ?? "",
    representativeEmail: family.representativeEmail ?? "",
    address: family.address ?? "",
    profile: {
      ...blank.profile,
      ...family.profile,
      representativeCivilStatus: family.profile?.representativeCivilStatus ?? "",
      representativeNationality: family.profile?.representativeNationality || "guatemalteca",
      representativeOccupation: family.profile?.representativeOccupation ?? "",
      representativeWorkplace: family.profile?.representativeWorkplace ?? "",
      representativeHomePhone: family.profile?.representativeHomePhone ?? "",
      representativeOfficePhone: family.profile?.representativeOfficePhone ?? "",
    },
  };
}
const localToday = () => {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
};
function phoneFormat(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
}
function dpiFormat(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  return [digits.slice(0, 4), digits.slice(4, 9), digits.slice(9, 13)].filter(Boolean).join(" ");
}
function contractGrade(gradeName: string) {
  const normalized = gradeName.toLocaleLowerCase("es");
  if (normalized.includes("bachillerato")) {
    const match = gradeName.match(/(?:4|5)(?:to|to\.)?/i);
    return { level: "Bachillerato", grade: match?.[0] ?? gradeName, career: "Bachillerato en Ciencias y Letras", fee: "1782.50", monthly: "1322.50" };
  }
  if (normalized.includes("básic") || normalized.includes("basic")) return { level: "Básico", grade: gradeName, career: "", fee: "1012.00", monthly: "1012.00" };
  if (normalized.includes("primaria")) return { level: "Primaria", grade: gradeName, career: "", fee: "1012.00", monthly: "1012.00" };
  return { level: "Preprimaria", grade: gradeName, career: "", fee: "1012.00", monthly: "1012.00" };
}

export function OwnedEnrollmentFlow({ initialEnrollmentId, initialAction }: { initialEnrollmentId?: string; initialAction?: string }) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [familyId, setFamilyId] = useState("");
  const [enrollmentId, setEnrollmentId] = useState("");
  const [family, setFamily] = useState<Family | null>(null);
  const [familyDraft, setFamilyDraft] = useState<FamilyDraft>(blankFamily);
  const [familySearch, setFamilySearch] = useState("");
  const [familyMatches, setFamilyMatches] = useState<Family[]>([]);
  const [existing, setExisting] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentMatches, setStudentMatches] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [section, setSection] = useState("");
  const [fee, setFee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [charge, setCharge] = useState<Charge | null>(null);
  const [contract, setContract] = useState<PaperContract | null>(null);
  const [contractFields, setContractFields] = useState<ContractFields>(blankContract);
  const [paperSignatureDate, setPaperSignatureDate] = useState(localToday);
  const [paperConfirmed, setPaperConfirmed] = useState(false);
  const [reference, setReference] = useState("");
  const [intentId, setIntentId] = useState<string | null>(null);
  const [receivedAt, setReceivedAt] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const updateProfile = useCallback((key: keyof FamilyProfile, value: string) => {
    setFamilyDraft((draft) => ({ ...draft, profile: { ...draft.profile, [key]: value } }));
  }, []);
  const setContractField = useCallback((key: keyof ContractFields, value: string) => {
    setContractFields((current) => ({ ...current, [key]: value }));
  }, []);
  const gradeName = useMemo(() => bootstrap?.gradeLevels.find((grade) => grade.id === Number(gradeId))?.name ?? "", [bootstrap, gradeId]);

  useEffect(() => { void operation<Bootstrap>("enrollments/bootstrap").then(setBootstrap).catch((cause) => setError(String(cause))); }, []);
  useEffect(() => {
    let active = true;
    async function start() {
      let ids: { familyId: string; enrollmentId: string } | null = null;
      if (!initialEnrollmentId) {
        const stored = sessionStorage.getItem("montessori-admissions-operation");
        try { if (stored) ids = JSON.parse(stored) as { familyId: string; enrollmentId: string }; } catch { /* Start a new operation. */ }
        if (!ids || !/^[0-9a-f-]{36}$/i.test(ids.familyId) || !/^[0-9a-f-]{36}$/i.test(ids.enrollmentId)) {
          ids = { familyId: crypto.randomUUID(), enrollmentId: crypto.randomUUID() };
          sessionStorage.setItem("montessori-admissions-operation", JSON.stringify(ids));
        }
        setFamilyId(ids.familyId);
        setEnrollmentId(ids.enrollmentId);
        return;
      }
      if (!/^[0-9a-f-]{36}$/i.test(initialEnrollmentId)) { setError("El identificador de inscripción no es válido."); return; }
      setEnrollmentId(initialEnrollmentId);
      try {
        const saved = await operation<Enrollment>(`v2/enrollments/${initialEnrollmentId}`);
        if (!active) return;
        setEnrollment(saved); setGradeId(String(saved.gradeId)); setSection(saved.section ?? "");
        setBirthDate(saved.birthDate ?? ""); setFee(String(saved.enrollmentFee)); setDueDate(saved.feeDueDate);
        setFamilyId(saved.familyId ?? "");
        const [savedCharge, savedContract] = await Promise.all([
          operation<Charge>(`v2/enrollments/${saved.id}/charge`).catch(() => null),
          operation<PaperContract>(`v2/enrollments/${saved.id}/contract`).catch(() => null),
        ]);
        if (!active) return;
        setCharge(savedCharge); setContract(savedContract);
        if (saved.familyId) {
          const savedFamily = await operation<Family>(`v2/families/${saved.familyId}`);
          if (!active) return;
          const hydrated = hydrateFamily(savedFamily);
          setFamily(hydrated); setFamilyDraft(hydrated);
          if (savedContract?.snapshot) {
            setContractFields({
              resolutionDiaco: savedContract.snapshot.resolucion_diaco ?? "",
              educationLevel: savedContract.snapshot.nivel ?? "",
              monthlyFee: savedContract.snapshot.cuota_mensual ?? "",
              career: savedContract.snapshot.carrera ?? "",
              schedulePlan: savedContract.snapshot.jornada_plan ?? "Matutina",
            });
          } else {
            const terms = contractGrade(bootstrap?.gradeLevels.find((grade) => grade.id === saved.gradeId)?.name ?? "");
            setContractFields({ resolutionDiaco: "", educationLevel: terms.level, monthlyFee: terms.monthly, career: terms.career, schedulePlan: "Matutina" });
          }
        }
        setNotice("Expediente cargado. Puedes corregir los datos, imprimir el contrato y registrar la firma.");
        if (initialAction === "sign") setTimeout(() => document.getElementById("paper-contract")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      } catch (cause) {
        if (active && initialEnrollmentId) setError(cause instanceof Error ? cause.message : "No se pudo cargar el expediente seleccionado");
      }
    }
    void start();
    return () => { active = false; };
  }, [initialEnrollmentId, initialAction, bootstrap]);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  function familyPayload(draft = familyDraft) {
    return {
      ...draft,
      name: draft.name.trim(),
      representativeFirstName: draft.representativeFirstName.trim(),
      representativeLastName: draft.representativeLastName.trim(),
      representativeDocumentNumber: draft.representativeDocumentNumber.trim(),
      representativePhone: draft.representativePhone.trim() || null,
      representativeEmail: draft.representativeEmail.trim() || null,
      address: draft.address.trim() || null,
      profile: Object.fromEntries(Object.entries(draft.profile).map(([key, value]) => [key, value?.trim() || null])),
    };
  }
  async function persistFamily(): Promise<Family> {
    const payload = familyPayload();
    const response = family
      ? await save<Family>(`v2/families/${family.id}`, payload, "PATCH")
      : await save<Family>(`v2/families/${familyId}`, payload, "PUT");
    const saved = hydrateFamily(response);
    setFamily(saved); setFamilyDraft(saved); setFamilyId(saved.id);
    return saved;
  }
  async function saveFamily() {
    setBusy(true); setError(""); setNotice("");
    try { await persistFamily(); setNotice("Datos de familia y representante guardados."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron guardar los datos de familia"); }
    finally { setBusy(false); }
  }
  async function searchFamilies() {
    try { setFamilyMatches(await operation<Family[]>(`v2/families?q=${encodeURIComponent(familySearch)}&limit=50`)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron consultar las familias"); }
  }
  async function searchStudents() {
    try { setStudentMatches(await operation<Student[]>(`students/directory?q=${encodeURIComponent(studentSearch)}&limit=25`)); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo consultar el directorio"); }
  }
  function chooseGrade(value: string) {
    setGradeId(value);
    const item = bootstrap?.gradeLevels.find((grade) => grade.id === Number(value));
    if (!item) return;
    const terms = contractGrade(item.name);
    setFee(terms.fee);
    setContractFields((current) => ({ ...current, educationLevel: terms.level, monthlyFee: terms.monthly, career: terms.career, schedulePlan: "Matutina" }));
  }
  async function createEnrollment() {
    if (!enrollmentId || !family || !gradeId || !fee || !dueDate || !birthDate || (existing ? !student : !firstName.trim() || !lastName.trim())) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const saved = await save<Enrollment>(`v2/enrollments/${enrollmentId}`, {
        familyId: family.id, studentUuid: existing ? student?.uuid : null,
        firstName: existing ? student?.firstName : firstName.trim(),
        lastName: existing ? student?.lastName : lastName.trim(), birthDate,
        schoolYear: 2027, gradeId: Number(gradeId), section: section.trim() || null,
        enrollmentFee: Number(fee), feeDueDate: dueDate,
      }, "PUT");
      setEnrollment(saved);
      setCharge(await operation<Charge>(`v2/enrollments/${saved.id}/charge`));
      setNotice("Expediente creado. Revisa los datos y genera la vista previa del contrato individual.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : `No se pudo guardar. Reintenta con el UUID ${enrollmentId}.`); }
    finally { setBusy(false); }
  }
  function contractPayload() {
    return {
      ...contractFields,
      gradeName: gradeName.match(/(?:4|5)(?:to|to\.)?/i)?.[0] && gradeName.toLocaleLowerCase("es").includes("bachillerato")
        ? gradeName.match(/(?:4|5)(?:to|to\.)?/i)?.[0] : gradeName,
      representativeBirthDate: familyDraft.profile.representativeBirthDate,
      representativeCivilStatus: familyDraft.profile.representativeCivilStatus,
      representativeNationality: familyDraft.profile.representativeNationality,
      representativeOccupation: familyDraft.profile.representativeOccupation,
      representativeWorkplace: familyDraft.profile.representativeWorkplace,
      representativeAddress: familyDraft.address,
      homePhone: familyDraft.profile.representativeHomePhone,
      officePhone: familyDraft.profile.representativeOfficePhone,
    };
  }
  function contractIsComplete() {
    const profile = familyDraft.profile;
    return Boolean(gradeName && familyDraft.name.trim() && familyDraft.representativeFirstName.trim() && familyDraft.representativeLastName.trim() &&
      familyDraft.representativeDocumentNumber.trim() && familyDraft.representativePhone.trim() && familyDraft.address.trim() &&
      profile.representativeBirthDate && profile.representativeCivilStatus && String(profile.representativeNationality ?? "").trim() &&
      String(profile.representativeOccupation ?? "").trim() && String(profile.representativeWorkplace ?? "").trim() &&
      phoneFormat(profile.representativeHomePhone ?? "").length === 9 && phoneFormat(profile.representativeOfficePhone ?? "").length === 9 &&
      contractFields.resolutionDiaco.trim() && contractFields.educationLevel.trim() && Number(contractFields.monthlyFee) > 0);
  }
  async function previewContract() {
    if (!enrollment || !contractIsComplete()) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await persistFamily();
      const response = await fetch(`/api/operations/v2/enrollments/${enrollment.id}/contract/preview.pdf`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(contractPayload()), cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string; message?: string } | null;
        throw new Error(body?.error || body?.message || "No se pudo generar la vista previa");
      }
      const url = URL.createObjectURL(await response.blob());
      setPreviewUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return url; });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo preparar el contrato"); }
    finally { setBusy(false); }
  }
  async function issueContract() {
    if (!enrollment || !contractIsComplete()) return;
    setBusy(true); setError("");
    try {
      await persistFamily();
      const issued = await save<PaperContract>(`v2/enrollments/${enrollment.id}/contract`, contractPayload());
      setContract(issued); setPreviewUrl("");
      setNotice(`Contrato ${issued.contractNumber} emitido para ${enrollment.firstName}. Imprímelo y registra la firma cuando esté firmado.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo emitir el contrato"); }
    finally { setBusy(false); }
  }
  async function recordPaperSignature() {
    if (!enrollment || !contract || !paperConfirmed || !paperSignatureDate) return;
    setBusy(true); setError("");
    try {
      const signedAt = new Date(`${paperSignatureDate}T12:00:00-06:00`).toISOString();
      const updated = await save<Enrollment>(`v2/enrollments/${enrollment.id}/sign`, { signedAt, paperContractConfirmed: true });
      setEnrollment(updated);
      setContract(await operation<PaperContract>(`v2/enrollments/${updated.id}/contract`));
      setNotice(updated.status === "ACTIVO" ? "Firma registrada. El alumno está activo y ya puede comprar libros y uniformes." : "Firma física registrada. El expediente sigue pendiente del pago de inscripción.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo registrar la firma física"); }
    finally { setBusy(false); }
  }
  async function confirmPayment() {
    if (!enrollment || !reference.trim()) return;
    const id = intentId ?? crypto.randomUUID(); const timestamp = receivedAt ?? new Date().toISOString();
    setIntentId(id); setReceivedAt(timestamp); setBusy(true); setError(""); setNotice("");
    try {
      await save(`v2/enrollments/${enrollment.id}/payment-intents/${id}`, { method: "MANUAL" }, "PUT");
      const updated = await save<Enrollment>(`v2/enrollments/${enrollment.id}/payment-intents/${id}/confirm-manual`, { reference: reference.trim(), receivedAt: timestamp });
      setEnrollment(updated); setCharge(await operation<Charge>(`v2/enrollments/${updated.id}/charge`));
      setNotice(updated.signedAt ? "Pago confirmado. Revisa que el estado y la proyección académica estén activos." : "Pago confirmado; el expediente queda pendiente de la firma del contrato.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Revisa el intento ${id} antes de reintentar.`); }
    finally { setBusy(false); }
  }

  const familyInput = (key: keyof Omit<FamilyDraft, "profile">, label: string, type = "text") => <label key={key}>{label}<input required={key !== "representativeEmail"} value={familyDraft[key]} type={type} onChange={(event) => setFamilyDraft((draft) => ({ ...draft, [key]: event.target.value }))} /></label>;
  const profileInput = (key: keyof FamilyProfile, label: string, options?: { type?: string; inputMode?: "text" | "numeric"; max?: string }) => <label key={key}>{label}<input required type={options?.type ?? "text"} inputMode={options?.inputMode} max={options?.max} value={familyDraft.profile[key] ?? ""} onChange={(event) => updateProfile(key, event.target.value)} /></label>;

  return <div className="owned-flow">
    <div className="section-heading"><div><span className="eyebrow">INSCRIPCIONES · 2027</span><h1>{enrollment ? "Expediente de inscripción" : "Inscribir alumno"}</h1><p>El contrato es individual. Completa o corrige los datos familiares, revisa la vista previa y emite la impresión oficial.</p></div><Link className="button" href="/">Volver al tablero</Link></div>
    {error && <p className="alert-error" role="alert">{error}</p>}{notice && <p className="owned-notice" role="status">{notice}</p>}

    <section className="owned-card">
      <div className="owned-section-title"><div><span className="owned-step">01</span><h2>Familia y representante legal</h2></div>{family && <span className="owned-saved-tag">Expediente guardado</span>}</div>
      {!family && <div className="owned-row"><label>Buscar una familia existente<input value={familySearch} onChange={(event) => setFamilySearch(event.target.value)} placeholder="Nombre de familia o representante" /></label><button className="button" type="button" onClick={() => void searchFamilies()}>Buscar</button></div>}
      {!family && familyMatches.map((item) => <button className="owned-result" type="button" key={item.id} onClick={() => { const hydrated = hydrateFamily(item); setFamily(hydrated); setFamilyDraft(hydrated); setFamilyId(item.id); }}>{item.name} · {item.representativeFirstName} {item.representativeLastName}</button>)}
      <div className="owned-grid">
        {familyInput("name", "Nombre de familia")}
        {familyInput("representativeFirstName", "Nombres del representante")}
        {familyInput("representativeLastName", "Apellidos del representante")}
        <label>Documento<select required value={familyDraft.representativeDocumentType} onChange={(event) => setFamilyDraft((draft) => ({ ...draft, representativeDocumentType: event.target.value }))}><option value="DPI">DPI</option><option value="PASAPORTE">Pasaporte</option></select></label>
        <label>{familyDraft.representativeDocumentType === "DPI" ? "DPI" : "Número de pasaporte"}<input required value={familyDraft.representativeDocumentNumber} onChange={(event) => setFamilyDraft((draft) => ({ ...draft, representativeDocumentNumber: draft.representativeDocumentType === "DPI" ? dpiFormat(event.target.value) : event.target.value.toUpperCase() }))} /></label>
        <label>Teléfono celular<input required inputMode="numeric" placeholder="xxxx-xxxx" value={familyDraft.representativePhone} onChange={(event) => setFamilyDraft((draft) => ({ ...draft, representativePhone: phoneFormat(event.target.value) }))} /></label>
        {familyInput("representativeEmail", "Correo electrónico", "email")}
        {familyInput("address", "Dirección de residencia")}
        {profileInput("representativeBirthDate", "Fecha de nacimiento del representante", { type: "date", max: localToday() })}
        <label>Estado civil<select required value={familyDraft.profile.representativeCivilStatus ?? ""} onChange={(event) => updateProfile("representativeCivilStatus", event.target.value)}><option value="">Selecciona</option>{["Soltero(a)", "Casado(a)", "Unido(a)", "Divorciado(a)", "Viudo(a)"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>Nacionalidad<select required value={familyDraft.profile.representativeNationality ?? "guatemalteca"} onChange={(event) => updateProfile("representativeNationality", event.target.value)}>{["guatemalteca", "salvadoreña", "hondureña", "mexicana", "estadounidense", "otra"].map((value) => <option key={value}>{value}</option>)}</select></label>
        {profileInput("representativeOccupation", "Ocupación")}
        {profileInput("representativeWorkplace", "Lugar de trabajo")}
        <label>Teléfono de casa<input required inputMode="numeric" placeholder="xxxx-xxxx" value={familyDraft.profile.representativeHomePhone} onChange={(event) => updateProfile("representativeHomePhone", phoneFormat(event.target.value))} /></label>
        <label>Teléfono de oficina<input required inputMode="numeric" placeholder="xxxx-xxxx" value={familyDraft.profile.representativeOfficePhone} onChange={(event) => updateProfile("representativeOfficePhone", phoneFormat(event.target.value))} /></label>
      </div>
      <div className="owned-row"><button className="button button-primary" type="button" disabled={busy || !familyId} onClick={() => void saveFamily()}>{busy ? "Guardando…" : family ? "Actualizar datos de familia" : "Guardar familia y representante"}</button>{family && <button className="button" type="button" onClick={() => { setFamily(null); setFamilyDraft(blankFamily()); setFamilyId(crypto.randomUUID()); }}>Cambiar familia</button>}</div>
      <p>Si la familia no llenó el enlace de preinscripción, aquí puedes completar o corregir sus datos antes de emitir el contrato.</p>
    </section>

    <section className="owned-card">
      <div className="owned-section-title"><div><span className="owned-step">02</span><h2>Alumno</h2></div></div>
      {enrollment ? <div className="owned-grid"><p><strong>Alumno:</strong> {enrollment.firstName} {enrollment.lastName}</p><p><strong>Fecha de nacimiento:</strong> {enrollment.birthDate || "Sin registrar"}</p></div> : <>
        <label className="owned-check"><input type="checkbox" checked={existing} onChange={(event) => { setExisting(event.target.checked); setStudent(null); setStudentMatches([]); setBirthDate(""); }} /> El alumno ya estudia en Montessori</label>
        {existing ? <><div className="owned-row"><label>Buscar alumno<input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Nombre o UUID" /></label><button className="button" type="button" onClick={() => void searchStudents()}>Buscar</button></div>{student && <p>Seleccionado: <strong>{student.firstName} {student.lastName}</strong></p>}{studentMatches.filter((item) => item.active).map((item) => <button className="owned-result" type="button" key={item.uuid} onClick={() => { setStudent(item); setFirstName(item.firstName); setLastName(item.lastName); setBirthDate(item.birthDate ?? ""); }}>{item.firstName} {item.lastName} · {item.birthDate ? `Nacimiento ${item.birthDate}` : "Falta fecha de nacimiento"}</button>)}</> : <div className="owned-grid"><label>Nombres<input required value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label><label>Apellidos<input required value={lastName} onChange={(event) => setLastName(event.target.value)} /></label></div>}
        <label className="owned-birth-date">Fecha de nacimiento del alumno<input required type="date" max={localToday()} value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></label>
      </>}
    </section>

    {!enrollment && <section className="owned-card">
      <div className="owned-section-title"><div><span className="owned-step">03</span><h2>Grado y datos de inscripción</h2></div></div>
      <div className="owned-grid"><label>Grado<select required value={gradeId} onChange={(event) => chooseGrade(event.target.value)}><option value="">Selecciona grado</option>{bootstrap?.gradeLevels.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label><label>Sección<input value={section} onChange={(event) => setSection(event.target.value)} /></label><label>Cuota de inscripción (Q)<input type="number" min="0.01" step="0.01" value={fee} onChange={(event) => setFee(event.target.value)} /></label><label>Vencimiento del cargo<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div>
      <button className="button button-primary" disabled={busy || !family || !gradeId || !fee || !dueDate || !birthDate || (existing ? !student : !firstName.trim() || !lastName.trim())} onClick={() => void createEnrollment()}>{busy ? "Guardando…" : "Inscribir alumno y crear cargo"}</button>
      <p>La fecha de nacimiento es obligatoria para crear el expediente. Grado y alumno se guardan en esta inscripción individual.</p>
    </section>}

    {enrollment && <>
      <section className="owned-card" id="paper-contract">
        <div className="owned-section-title"><div><span className="owned-step">03</span><h2>Contrato individual</h2></div>{contract && <span className="owned-saved-tag">{contract.contractNumber}</span>}</div>
        <p><strong>{enrollment.firstName} {enrollment.lastName}</strong> · {gradeName || `Grado ${enrollment.gradeId}`} · Ciclo {enrollment.schoolYear}</p>
        {!contract ? <>
          <div className="owned-grid"><label>Resolución DIACO<input required value={contractFields.resolutionDiaco} onChange={(event) => setContractField("resolutionDiaco", event.target.value)} /></label><label>Nivel educativo<input required value={contractFields.educationLevel} onChange={(event) => setContractField("educationLevel", event.target.value)} /></label><label>Cuota mensual (Q)<input required type="number" min="0.01" step="0.01" value={contractFields.monthlyFee} onChange={(event) => setContractField("monthlyFee", event.target.value)} /></label><label>Carrera<input value={contractFields.career} onChange={(event) => setContractField("career", event.target.value)} /></label><label>Jornada / plan<input required value={contractFields.schedulePlan} onChange={(event) => setContractField("schedulePlan", event.target.value)} /></label></div>
          <div className="owned-row"><button className="button button-primary" disabled={busy || !contractIsComplete()} onClick={() => void previewContract()}>{busy ? "Preparando…" : "Ver vista previa del contrato"}</button><span>La vista previa lleva marca de agua y no es válida para firma.</span></div>
        </> : <>
          <p>Este contrato ya fue emitido con una copia fija de los datos. Si necesita correcciones, solicita al colegio que anule y vuelva a emitirlo.</p>
          <div className="owned-row"><a className="button button-primary" href={`/api/operations/v2/enrollments/${enrollment.id}/contract.pdf`} target="_blank" rel="noreferrer">Imprimir contrato oficial</a>{contract.signedAt && <span className="owned-saved-tag">Firmado el {new Date(contract.signedAt).toLocaleDateString("es-GT")}</span>}</div>
          {!contract.signedAt && <div className="owned-sign-box"><label>Fecha de firma en papel<input type="date" max={localToday()} value={paperSignatureDate} onChange={(event) => setPaperSignatureDate(event.target.value)} /></label><label className="owned-check"><input type="checkbox" checked={paperConfirmed} onChange={(event) => setPaperConfirmed(event.target.checked)} /> Confirmo que el representante firmó el contrato impreso</label><button className="button button-primary" disabled={busy || !paperConfirmed || !paperSignatureDate} onClick={() => void recordPaperSignature()}>Marcar contrato como firmado</button></div>}
        </>}
      </section>

      <section className="owned-card"><div className="owned-section-title"><div><span className="owned-step">04</span><h2>Estado y pago de inscripción</h2></div><span className={`owned-saved-tag ${enrollment.status === "ACTIVO" ? "is-green" : ""}`}>{enrollment.status.replaceAll("_", " ")}</span></div>
        <p>Expediente del alumno: <code>{enrollment.id}</code></p><p>Fecha de nacimiento: {enrollment.birthDate || "Sin registrar"}</p><p>Cargo: Q {Number(charge?.amount ?? enrollment.enrollmentFee ?? 0).toFixed(2)} · Pagado: Q {Number(charge?.paidAmount ?? 0).toFixed(2)}</p>
        {!charge?.paid && <div className="owned-row"><label>Referencia del pago recibido<input value={reference} onChange={(event) => setReference(event.target.value)} /></label><button className="button button-primary" disabled={busy || !reference.trim()} onClick={() => void confirmPayment()}>Confirmar pago manual</button></div>}
        {enrollment.status === "ACTIVO" && <div className="owned-row owned-product-links"><Link className="button" href={`/libros?studentUuid=${encodeURIComponent(enrollment.studentUuid)}`}>Generar ticket de libros</Link><Link className="button" href={`/uniformes?studentUuid=${encodeURIComponent(enrollment.studentUuid)}`}>Generar ticket de uniformes</Link></div>}
      </section>
    </>}
    <div className="owned-flow-footer"><Link className="button" href="/">Regresar al tablero</Link><Link className="button" href="/inscripciones/nueva">Inscribir otro alumno</Link></div>

    {previewUrl && <div className="owned-preview-backdrop" role="presentation"><section className="owned-preview-dialog" role="dialog" aria-modal="true" aria-label="Vista previa del contrato"><header><div><span className="eyebrow">VISTA PREVIA · BORRADOR</span><h2>Revisa los datos del contrato</h2></div><button className="button" type="button" onClick={() => setPreviewUrl("")}>Cerrar</button></header><iframe title="Vista previa del borrador de contrato" src={previewUrl} /><footer><a className="button" href={previewUrl} download={`borrador-contrato-${enrollment?.firstName ?? "alumno"}.pdf`}>Descargar borrador</a><button className="button button-primary" disabled={busy} onClick={() => void issueContract()}>{busy ? "Emitiendo…" : "Emitir contrato oficial"}</button></footer></section></div>}
  </div>;
}
