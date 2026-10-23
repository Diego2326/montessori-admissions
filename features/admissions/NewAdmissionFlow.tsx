"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AppIcon } from "@/components/AppIcon";
import { SearchableSelect } from "@/components/SearchableSelect";
import { operation, save } from "@/lib/operations/client";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import type { Bootstrap, CountryCallingCode, Enrollment, EnrollmentProfile, FamilyIntake, FamilySummary } from "@/lib/operations/types";
import { DatePartsField } from "./DatePartsField";
import { attendedByOptions, civilStatusOptions, nationalityOptions, optionsWithExistingValue, representativeDocumentTypeOptions, representativeTypeOptions, zacapaMunicipalityOptions } from "./normalizedOptions";

type EntryType = "REINSCRIPTION" | "NEW_INCOME";
type StudentDraft = { key: string; studentId?: number; studentUuid?: string; historicalIntakeId?: number; firstName: string; lastName: string; currentGrade: string; gradeId: number; section: string; birthDate: string; studentDpi: string; phone: string; phoneCountryCode?: string; imported: boolean };
type HistoricalIntake = { id: number; sourceRowId: number; schoolYear: number; firstName: string; lastName: string; birthDate: string | null; intakeDocumentNumber: string | null; sourceGrade: string | null; motherName: string | null; motherWorkplace: string | null; motherMobile: string | null; motherDpi: string | null; fatherName: string | null; fatherOccupation: string | null; fatherWorkplace: string | null; fatherMobile: string | null; address: string | null; city: string | null; otherContact: string | null; contactMobile: string | null; attendedBy: string | null; matchedStudentId: number | null };
const motherFields = [
  ["motherName", "Nombre completo de la madre"], ["motherDpi", "DPI de la madre"], ["motherPhone", "Celular de la madre"], ["motherEmail", "Correo de la madre"], ["motherOccupation", "Ocupación de la madre"], ["motherWorkplace", "Lugar de trabajo de la madre"],
] as const;
const fatherFields = [
  ["fatherName", "Nombre completo del padre"], ["fatherDpi", "DPI del padre"], ["fatherPhone", "Celular del padre"], ["fatherHomePhone", "Teléfono de casa"], ["fatherOccupation", "Ocupación del padre"], ["fatherWorkplace", "Lugar de trabajo del padre"],
] as const;
const homeFields = [
  ["address", "Dirección de residencia"], ["city", "Municipio o ciudad"], ["emergencyContactName", "Contacto de emergencia"], ["emergencyContactPhone", "Teléfono del contacto de emergencia"], ["otherContact", "Nombre de contacto alternativo (opcional)"], ["emergencyPhone", "Teléfono alternativo (opcional)"], ["attendedBy", "Personal que atendió"],
] as const;
const representativeIdentityFields = [
  ["representativeFirstName", "Nombres"], ["representativeLastName", "Apellidos"], ["representativeAge", "Edad"], ["representativeCivilStatus", "Estado civil"], ["representativeNationality", "Nacionalidad"], ["representativeOccupation", "Profesión u oficio"], ["representativeDocumentType", "Tipo de documento"], ["representativeDocument", "Número de documento"],
] as const;
const representativeContactFields = [
  ["representativeResidence", "Dirección de residencia"], ["representativeHomePhone", "Teléfono de casa"], ["representativeOfficePhone", "Teléfono de oficina"], ["representativeMobilePhone", "Celular"],
] as const;
const sharedProfileKeys = ["address", "city", "emergencyPhone", "emergencyContactName", "emergencyContactPhone", "motherName", "motherPhone", "motherEmail", "motherDpi", "motherOccupation", "motherWorkplace", "fatherName", "fatherPhone", "fatherHomePhone", "fatherDpi", "fatherOccupation", "fatherWorkplace", "otherContact", "representativeType", "representativeFirstName", "representativeLastName", "representativeAge", "representativeCivilStatus", "representativeNationality", "representativeOccupation", "representativeDocumentType", "representativeDocument", "representativeResidence", "representativeHomePhone", "representativeOfficePhone", "representativeMobilePhone"] as const;
const orderedOptions: Record<string, readonly (string | { value: string; label: string })[]> = {
  representativeType: representativeTypeOptions,
  representativeCivilStatus: civilStatusOptions,
  representativeNationality: nationalityOptions,
  representativeDocumentType: representativeDocumentTypeOptions,
  city: zacapaMunicipalityOptions,
  attendedBy: attendedByOptions,
};
const promotion = ["Nursery", "Prekinder", "Kinder", "Preparatoria", "Primero primaria", "Segundo primaria", "Tercero primaria", "Cuarto primaria", "Quinto primaria", "Sexto primaria", "Primero básico", "Segundo básico", "Tercero básico", "Cuarto bachillerato", "Quinto bachillerato"];
const localDate = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`; };
const formatPhone = (raw: string, dialCode = "+502", expectedDigits = 8) => {
  let digits = raw.replace(/\D/g, "");
  const dialDigits = dialCode.replace(/\D/g, "");
  if (dialDigits && digits.startsWith(dialDigits) && digits.length > expectedDigits) digits = digits.slice(dialDigits.length);
  digits = digits.slice(0, expectedDigits);
  return dialCode === "+502" && digits.length > 4 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : digits;
};
const formatDpi = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 4) return digits;
  if (digits.length <= 9) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 9)}-${digits.slice(9)}`;
};
const normalizeGrade = (value: string) => value.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\./g, "").trim();
function promotedGrade(current: string, grades: Bootstrap["gradeLevels"]) {
  const currentKey = normalizeGrade(current);
  const aliases: Record<string, string> = { "1ro primaria": "primero primaria", "2do primaria": "segundo primaria", "3ro primaria": "tercero primaria", "4to primaria": "cuarto primaria", "5to primaria": "quinto primaria", "6to primaria": "sexto primaria", "1ro basico": "primero basico", "2do basico": "segundo basico", "3ro basico": "tercero basico", "4to bach": "cuarto bachillerato", "4to bachillerato": "cuarto bachillerato", "5to bach": "quinto bachillerato", "5to bachillerato": "quinto bachillerato" };
  const key = aliases[currentKey] ?? currentKey;
  const index = promotion.findIndex((grade) => normalizeGrade(grade) === key);
  if (index < 0) return grades.find((grade) => normalizeGrade(grade.name) === normalizeGrade(current))?.id ?? 0;
  if (index === promotion.length - 1) return 0;
  const next = promotion[index + 1];
  return grades.find((grade) => normalizeGrade(grade.name) === normalizeGrade(next))?.id ?? 0;
}

export function NewAdmissionFlow({ initialFamilyId = null, initialStudentId = null, initialMode = null }: { initialFamilyId?: number | null; initialStudentId?: number | null; initialMode?: EntryType | null }) {
  const router = useRouter();
  const [entryType, setEntryType] = useState<EntryType | null>(initialMode);
  const [step, setStep] = useState(initialMode === "REINSCRIPTION" ? 7 : initialMode ? 1 : 0);
  const [families, setFamilies] = useState<FamilySummary[]>([]);
  const [candidates, setCandidates] = useState<AdmissionCandidate[]>([]);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [countryCodes, setCountryCodes] = useState<CountryCallingCode[]>([]);
  const [phoneCountries, setPhoneCountries] = useState<Record<string, string>>({});
  const [familyId, setFamilyId] = useState<number | null>(initialFamilyId);
  const [familyName, setFamilyName] = useState("");
  const [profile, setProfile] = useState<EnrollmentProfile>({ submissionDate: localDate() });
  const [search, setSearch] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(initialStudentId);
  const [draft, setDraft] = useState<StudentDraft>({ key: "student-1", firstName: "", lastName: "", currentGrade: "", gradeId: 0, section: "", birthDate: "", studentDpi: "", phone: "", phoneCountryCode: "GT", imported: false });
  const [students, setStudents] = useState<StudentDraft[]>([]);
  const [historicalIntakes, setHistoricalIntakes] = useState<HistoricalIntake[]>([]);
  const [historicalSearch, setHistoricalSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all([
      operation<FamilySummary[]>("admission-workflow/families"),
      operation<{ candidates: AdmissionCandidate[] }>("admission-workflow/2027/overview"),
      operation<Bootstrap>("enrollments/bootstrap"),
      operation<CountryCallingCode[]>("country-codes"),
    ]).then(([familyRows, overview, setup, countryRows]) => {
      if (!active) return;
      setFamilies(familyRows); setCandidates(overview.candidates); setBootstrap(setup);
      setCountryCodes(countryRows);
      setPhoneCountries(Object.fromEntries(["motherPhone", "fatherPhone", "fatherHomePhone", "emergencyPhone", "emergencyContactPhone", "representativeHomePhone", "representativeOfficePhone", "representativeMobilePhone"].map((key) => [key, "GT"])));
      const family = familyRows.find((item) => item.id === initialFamilyId);
      if (family) setFamilyName(family.name);
      if (initialFamilyId) void chooseFamily(initialFamilyId, familyRows);
      if (initialStudentId) {
        const candidate = overview.candidates.find((item) => item.id === initialStudentId);
        if (candidate) setSearch(`${candidate.firstName} ${candidate.lastName}`);
      }
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar los datos demo"));
    return () => { active = false; };
  // The initial URL values are fixed for this page instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gradeOptions = bootstrap?.gradeLevels ?? [];
  const year = bootstrap?.schoolYears.find((item) => item.year === 2027);
  const representativeFromParent = profile.representativeType === "MOTHER" || profile.representativeType === "FATHER";
  const flowSteps = (entryType === "REINSCRIPTION" ? [0, 7, 1, 2, 3, 4, 5, 6, 8] : [0, 1, 2, 3, 4, 5, 6, 7, 8]).filter((page) => page !== 6 || !representativeFromParent);
  const flowPosition = flowSteps.indexOf(step);
  const previousStep = flowSteps[Math.max(0, flowPosition - 1)] ?? 0;
  const nextStep = flowSteps[flowPosition + 1];
  const filteredCandidates = useMemo(() => candidates.filter((candidate) => {
    const needle = search.trim().toLocaleLowerCase("es");
    if (!needle) return false;
    if (familyId && candidate.familyId && candidate.familyId !== familyId) return false;
    if (students.some((student) => student.studentId === candidate.id)) return false;
    const searchable = `${candidate.firstName} ${candidate.lastName} ${candidate.id}`.toLocaleLowerCase("es");
    return searchable.includes(needle);
  }), [candidates, familyId, search, students, year]);

  async function chooseFamily(id: number, rows = families) {
    setFamilyId(id);
    const family = rows.find((item) => item.id === id);
    if (family) setFamilyName(family.name);
    try {
      const detail = await operation<FamilyIntake>(`admission-workflow/families/${id}`);
      setProfile((current) => ({ ...current, ...detail.profile }));
      setFamilyName(detail.name);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron importar los datos familiares"); }
  }

  function setValue(key: string, value: string | number | null) { setProfile((current) => ({ ...current, [key]: value })); }
  function countryForPhone(key: string) {
    const parentPhone = profile.representativeType === "MOTHER" ? "motherPhone" : profile.representativeType === "FATHER" ? "fatherPhone" : null;
    const code = key === "representativeMobilePhone" && parentPhone ? phoneCountries[parentPhone] : phoneCountries[key];
    return countryCodes.find((country) => country.countryCode === code) ?? countryCodes.find((country) => country.countryCode === "GT");
  }

  function selectRepresentativeType(value: string) {
    setProfile((current) => {
      const isMother = value === "MOTHER" || value === "MADRE";
      const isFather = value === "FATHER" || value === "PADRE";
      if (!isMother && !isFather) {
        const previouslyParent = current.representativeType === "MOTHER" || current.representativeType === "FATHER";
        return previouslyParent ? { ...current, representativeType: value, representativeName: "", representativeFirstName: "", representativeLastName: "", representativeDocument: "", representativeMobilePhone: "", representativeHomePhone: "" } : { ...current, representativeType: value };
      }
      const prefix = isMother ? "mother" : "father";
      const fullName = String(current[`${prefix}Name`] || "").trim();
      return {
        ...current,
        representativeType: value,
        representativeName: fullName,
        representativeFirstName: fullName,
        representativeLastName: "",
        representativeDocumentType: current[`${prefix}Dpi`] ? "DPI" : current.representativeDocumentType,
        representativeDocument: current[`${prefix}Dpi`] || current.representativeDocument,
        representativeOccupation: current[`${prefix}Occupation`] || current.representativeOccupation,
        representativeResidence: current.address || current.representativeResidence,
        representativeHomePhone: isFather ? current.fatherHomePhone || current.fatherPhone || current.representativeHomePhone : current.motherPhone || current.representativeHomePhone,
        representativeMobilePhone: isFather ? current.fatherPhone || current.representativeMobilePhone : current.motherPhone || current.representativeMobilePhone,
      };
    });
  }

  async function importStudent(candidateId: number) {
    const candidate = candidates.find((item) => item.id === candidateId);
    if (!candidate || !bootstrap) return;
    if (candidate.status === "GRADUATED") { setError("Quinto bachillerato es el último grado. Revisa el caso antes de iniciar una reinscripción."); return; }
    if (candidate.familyId && familyId && candidate.familyId !== familyId) { setError("Este alumno pertenece a otra familia. Revisa el vínculo antes de importarlo."); return; }
    let yearEnrollments: Enrollment[];
    try { yearEnrollments = await operation<Enrollment[]>(`students/${candidate.id}/enrollments`); }
    catch { setError("No se pudo consultar el historial del alumno. Intenta de nuevo antes de importarlo."); return; }
    const previous = yearEnrollments.filter((item) => (item.schoolYear ?? 0) < 2027).sort((a, b) => (b.schoolYear ?? 0) - (a.schoolYear ?? 0))[0];
    const targetEnrollment = yearEnrollments.find((item) => item.schoolYear === 2027);
    if (targetEnrollment) { setError(`${candidate.firstName} ${candidate.lastName} ya tiene una inscripción para 2027. Ábrela desde la ficha familiar para revisarla.`); return; }
    const legacy = await operation<{ representativeFirstName: string; representativeLastName: string; representativeAge: number | null; representativeCivilStatus: string | null; representativeNationality: string | null; representativeOccupation: string | null; representativeDocumentType: string | null; representativeDocument: string | null; representativeResidence: string | null; representativeHomePhone: string | null; representativeOfficePhone: string | null; representativeMobilePhone: string | null; studyPlan: string | null }>(`admission-workflow/students/${candidate.id}/legacy-contract`).catch(() => null);
    if (legacy) {
      const importedRepresentative: EnrollmentProfile = {
        representativeFirstName: legacy.representativeFirstName,
        representativeLastName: legacy.representativeLastName,
        representativeAge: legacy.representativeAge,
        representativeCivilStatus: legacy.representativeCivilStatus,
        representativeNationality: legacy.representativeNationality,
        representativeOccupation: legacy.representativeOccupation,
        representativeDocumentType: legacy.representativeDocumentType,
        representativeDocument: legacy.representativeDocument,
        representativeResidence: legacy.representativeResidence,
        representativeHomePhone: legacy.representativeHomePhone,
        representativeOfficePhone: legacy.representativeOfficePhone,
        representativeMobilePhone: legacy.representativeMobilePhone,
        studyPlan: legacy.studyPlan,
      };
      if (!familyId && students.length === 0) setProfile((current) => ({ ...current, ...Object.fromEntries(Object.entries(importedRepresentative).filter(([key, value]) => !current[key] && value != null)) }));
    }
    if (candidate.familyId && !familyId) await chooseFamily(candidate.familyId);
    if (!candidate.familyId && familyId) { setError("Este alumno no tiene familia vinculada. Confirma que pertenece a la familia seleccionada antes de guardar."); }
    if (previous?.profile && students.length === 0) {
      const shared = Object.fromEntries(sharedProfileKeys.map((key) => [key, previous.profile?.[key]]).filter(([, value]) => value != null && value !== ""));
      setProfile((current) => ({ ...shared, ...Object.fromEntries(Object.entries(current).filter(([, value]) => value != null && value !== "")) }));
    }
    const currentGrade = candidate.currentGrade ?? previous?.gradeName ?? "";
    const targetGradeId = promotedGrade(currentGrade, bootstrap.gradeLevels) || (bootstrap.gradeLevels.find((grade) => normalizeGrade(grade.name) === normalizeGrade(candidate.proposedGrade ?? ""))?.id ?? 0);
    setDraft({
      key: `student-${candidate.id}`, studentId: candidate.id, studentUuid: candidate.uuid ?? undefined,
      firstName: candidate.firstName.trim(), lastName: candidate.lastName.trim(),
      currentGrade, gradeId: targetGradeId, section: "",
      birthDate: String(previous?.profile?.birthDate ?? candidate.birthDate ?? ""),
      studentDpi: String(previous?.profile?.studentDpi ?? ""),
      phone: formatPhone(String(previous?.profile?.studentPhone ?? "")), phoneCountryCode: "GT", imported: Boolean(previous || legacy),
    });
    setSelectedCandidateId(candidate.id);
    setHistoricalIntakes(await operation<HistoricalIntake[]>(`admission-workflow/students/${candidate.id}/historical-intakes`).catch(() => []));
  }

  function importHistoricalIntake(row: HistoricalIntake) {
    if (row.matchedStudentId && row.matchedStudentId !== draft.studentId) { setError("Esta ficha histórica está vinculada a otro alumno."); return; }
    const imported: EnrollmentProfile = {
      motherName: row.motherName, motherWorkplace: row.motherWorkplace,
      motherPhone: row.motherMobile, motherDpi: row.motherDpi,
      fatherName: row.fatherName, fatherOccupation: row.fatherOccupation,
      fatherWorkplace: row.fatherWorkplace, fatherPhone: row.fatherMobile,
      address: row.address, city: row.city, otherContact: row.otherContact,
      attendedBy: row.attendedBy,
    };
    setProfile((current) => ({ ...current, ...Object.fromEntries(Object.entries(imported).filter(([key, value]) => value && !current[key])) }));
    setDraft((current) => ({ ...current, historicalIntakeId: row.id, birthDate: current.birthDate || row.birthDate || "", phone: current.phone || formatPhone(row.contactMobile || ""), imported: true }));
    setHistoricalIntakes([]);
    setError("");
  }

  async function searchHistoricalIntakes() {
    if (!draft.studentId || historicalSearch.trim().length < 3) { setError("Escribe al menos tres caracteres para buscar una ficha histórica."); return; }
    try {
      setHistoricalIntakes(await operation<HistoricalIntake[]>(`admission-workflow/students/${draft.studentId}/historical-intakes?search=${encodeURIComponent(historicalSearch.trim())}`));
      setError("");
    } catch { setError("No se pudo buscar en las inscripciones históricas."); }
  }

  function validateStudentDraft() {
    const fullFirst = draft.firstName.trim();
    const fullLast = draft.lastName.trim();
    if (!fullFirst || !fullLast || !draft.gradeId) { setError("Completa nombres, apellidos y grado del alumno."); return null; }
    if (entryType === "REINSCRIPTION" && !draft.studentId) { setError("Selecciona e importa un alumno existente para reinscribirlo."); return null; }
    if (students.some((student) => student.studentId && student.studentId === draft.studentId)) { setError("Este alumno ya está agregado."); return null; }
    return { ...draft, firstName: fullFirst, lastName: fullLast };
  }

  function resetDraftStudent(key: string) {
    setDraft({ key, firstName: "", lastName: "", currentGrade: "", gradeId: 0, section: "", birthDate: "", studentDpi: "", phone: "", phoneCountryCode: "GT", imported: false });
    setSelectedCandidateId(null); setSearch("");
    setHistoricalIntakes([]);
    setHistoricalSearch("");
  }

  function queueStudentForContract() {
    const student = validateStudentDraft();
    if (!student) return;
    setError("");
    setStudents((current) => [...current, student]);
    resetDraftStudent(`student-${students.length + 2}`);
  }

  function reviewAdmission() { setError(""); setStep(8); }

  function continueFromStudents() {
    const hasDraft = Boolean(draft.firstName.trim() || draft.lastName.trim() || draft.studentId);
    let nextStudents = students;
    if (hasDraft) {
      const student = validateStudentDraft();
      if (!student) return;
      nextStudents = [...students, student];
      setStudents(nextStudents);
      resetDraftStudent(`student-${students.length + 2}`);
    }
    if (!nextStudents.length) { setError("Agrega al menos un alumno para continuar."); return; }
    setError("");
    if (entryType === "REINSCRIPTION") setStep(1);
    else reviewAdmission();
  }

  async function submit() {
    if (!entryType || !students.length || !year) { setError("Selecciona el tipo de ingreso, agrega al menos un alumno y confirma el ciclo 2027."); return; }
    if (entryType === "REINSCRIPTION" && students.some((student) => !student.studentId)) { setError("En reinscripción todos los alumnos deben importarse desde el registro existente."); return; }
    const parentPrefix = profile.representativeType === "MOTHER" ? "mother" : profile.representativeType === "FATHER" ? "father" : null;
    if (parentPrefix && !String(profile[`${parentPrefix}Name`] ?? "").trim()) { setError("Completa el nombre del padre o madre seleccionado como representante."); return; }
    if (!profile.representativeType || (!parentPrefix && !String(profile.representativeFirstName || profile.representativeName || "").trim())) { setError("Selecciona y completa los datos del representante."); return; }
    const effectiveProfile: EnrollmentProfile = parentPrefix ? {
      ...profile,
      representativeName: profile[`${parentPrefix}Name`],
      representativeFirstName: profile[`${parentPrefix}Name`],
      representativeLastName: "",
      representativeDocumentType: profile[`${parentPrefix}Dpi`] ? "DPI" : profile.representativeDocumentType,
      representativeDocument: profile[`${parentPrefix}Dpi`] || null,
      representativeOccupation: profile[`${parentPrefix}Occupation`] || null,
      representativeResidence: profile.address || null,
      representativeMobilePhone: profile[`${parentPrefix}Phone`] || null,
      representativeHomePhone: parentPrefix === "father" ? profile.fatherHomePhone || null : null,
    } : profile;
    const invalidEmail = Object.entries(effectiveProfile).some(([key, value]) => key.toLowerCase().includes("email") && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim()));
    const invalidPhone = Object.entries(effectiveProfile).some(([key, value]) => key.toLowerCase().includes("phone") && value && value !== "N/A" && value !== "NA" && value !== "n/a" && value !== "na" && value !== "-" && formatPhone(String(value), countryForPhone(key)?.dialCode, countryForPhone(key)?.phoneDigits).replace(/\D/g, "").length !== (countryForPhone(key)?.phoneDigits ?? 8));
    const invalidStudentData = students.some((student) => {
      const country = countryCodes.find((item) => item.countryCode === student.phoneCountryCode) ?? countryCodes.find((item) => item.countryCode === "GT");
      return Boolean((student.studentDpi && formatDpi(student.studentDpi).replace(/\D/g, "").length !== 13) || (student.phone && formatPhone(student.phone, country?.dialCode, country?.phoneDigits).replace(/\D/g, "").length !== (country?.phoneDigits ?? 8)));
    });
    if (invalidEmail || invalidPhone || invalidStudentData || (effectiveProfile.representativeDocumentType === "DPI" && effectiveProfile.representativeDocument && formatDpi(String(effectiveProfile.representativeDocument)).replace(/\D/g, "").length !== 13) || (effectiveProfile.motherDpi && formatDpi(String(effectiveProfile.motherDpi)).replace(/\D/g, "").length !== 13) || (effectiveProfile.fatherDpi && formatDpi(String(effectiveProfile.fatherDpi)).replace(/\D/g, "").length !== 13)) {
      setError(invalidEmail ? "Revisa el formato del correo electrónico." : "Revisa teléfonos (8 dígitos) y DPI (13 dígitos) antes de guardar.");
      return;
    }
    setBusy(true); setError("");
    try {
      const timestampedProfile: EnrollmentProfile = { ...effectiveProfile, submissionDate: localDate() };
      for (const [key, selectedCode] of Object.entries(phoneCountries)) {
        const code = key === "representativeMobilePhone" && parentPrefix ? phoneCountries[`${parentPrefix}Phone`] : selectedCode;
        const value = timestampedProfile[key];
        const country = countryCodes.find((item) => item.countryCode === code);
        if (value && country) timestampedProfile[key] = `${country.dialCode} ${formatPhone(String(value), country.dialCode, country.phoneDigits)}`;
      }
      for (const student of students) {
        if (!student.studentId) continue;
        const existing = await operation<Enrollment[]>(`students/${student.studentId}/enrollments`);
        if (existing.some((item) => item.schoolYear === 2027)) throw new Error(`${student.firstName} ${student.lastName} ya está inscrito en 2027. Actualiza su inscripción desde la ficha existente.`);
      }
      const defaultName = String(profile.motherName || profile.fatherName || "Nueva familia").trim();
      const saved = await save<{ family: FamilyIntake; enrollments: Enrollment[] }>("admission-workflow/intakes", {
        familyId, familyName: familyName.trim() || defaultName, profile: timestampedProfile,
        students: students.map((student) => ({ historicalIntakeId: student.historicalIntakeId ?? null, enrollment: {
          ...(student.studentId ? { studentId: student.studentId, studentUuid: student.studentUuid } : {}),
          firstName: student.firstName, lastName: student.lastName,
          schoolYearId: year.id, gradeId: student.gradeId, section: student.section || null,
          rejectExisting: true,
          status: "PENDIENTE_FIRMA",
          profile: { ...timestampedProfile, contractNumber: null, familyName: familyName.trim() || defaultName, birthDate: student.birthDate || null, studentDpi: student.studentDpi || null, studentPhone: student.phone ? `${countryCodes.find((item) => item.countryCode === student.phoneCountryCode)?.dialCode ?? "+502"} ${formatPhone(student.phone, countryCodes.find((item) => item.countryCode === student.phoneCountryCode)?.dialCode, countryCodes.find((item) => item.countryCode === student.phoneCountryCode)?.phoneDigits)}` : timestampedProfile.representativeMobilePhone || null, currentGrade: student.currentGrade || null },
        } })),
      });
      router.replace(`/?familyId=${saved.family.id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la inscripción demo"); }
    finally { setBusy(false); }
  }

  function textField(key: string, label: string, type = "text") {
    const normalizedKey = key.toLowerCase();
    const isPhone = normalizedKey.includes("phone");
    const country = isPhone ? countryForPhone(key) : undefined;
    const formatter = normalizedKey.includes("dpi") || (normalizedKey === "representativedocument" && profile.representativeDocumentType === "DPI") ? formatDpi : isPhone ? (value: string) => formatPhone(value, country?.dialCode, country?.phoneDigits) : null;
    return <label className="field-label" key={key}>{label}{isPhone && <span className="phone-field"><SearchableSelect value={phoneCountries[key] ?? "GT"} options={countryCodes.map((item) => ({ value: item.countryCode, label: `${item.dialCode} · ${item.countryName}` }))} onChange={(value) => setPhoneCountries((current) => ({ ...current, [key]: value }))} placeholder="Código de país" /><input type={type} inputMode="numeric" maxLength={(country?.phoneDigits ?? 8) + 1} value={formatter!(String(profile[key] ?? ""))} onChange={(event) => setValue(key, formatter!(event.target.value))} /></span>}{!isPhone && <input type={type} inputMode={formatter ? "numeric" : undefined} maxLength={normalizedKey.includes("dpi") || normalizedKey === "representativedocument" ? 15 : undefined} value={formatter ? formatter(String(profile[key] ?? "")) : profile[key] ?? ""} onChange={(event) => setValue(key, type === "number" ? Number(event.target.value) || null : formatter ? formatter(event.target.value) : event.target.value)} />}</label>;
  }
  function selectField(key: string, label: string) {
    const options = orderedOptions[key] ?? [];
    const value = String(profile[key] ?? "");
    return <label className="field-label" key={key}>{label}<SearchableSelect value={value} options={optionsWithExistingValue(options, value)} onChange={(next) => setValue(key, next || null)} placeholder="Buscar en el catálogo…" /></label>;
  }

  const labels: Record<number, string> = { 0: "Tipo", 1: "Familia", 2: "Madre", 3: "Padre", 4: "Domicilio", 5: "Representante", 6: "Contacto", 7: "Alumno", 8: "Revisión" };
  return <main className="registration-standalone">
    <header className="registration-brand"><button type="button" className="registration-logo" onClick={() => router.push("/")}><Image src="/logo-colegio.png" alt="Colegio Bilingüe Montessori Zacapa" width={52} height={52} priority /><strong>Colegio Bilingüe Montessori Zacapa</strong></button><span>INSCRIPCIONES · CICLO 2027</span></header>
    <div className="registration-heading"><button className="text-button" onClick={() => router.push("/")}>← Volver a inscripciones</button><span className="eyebrow">CICLO ESCOLAR 2027</span><h1>Nueva inscripción</h1><p>Completa cada paso para registrar a la familia y sus alumnos.</p></div>
    <nav className="wizard-steps registration-steps" aria-label="Pasos del formulario">{flowSteps.map((page, position) => <button type="button" key={page} className={page === step ? "current" : position < flowPosition ? "completed" : ""} onClick={() => position < flowPosition && setStep(page)}><i>{position < flowPosition ? <AppIcon name="check" size={15} /> : position + 1}</i>{labels[page]}</button>)}</nav>
    <section className="registration-panel">
      {step === 0 && <div className="registration-content"><div className="form-intro"><span className="intro-icon blue"><AppIcon name="users" size={26} /></span><div><h3>¿Qué tipo de inscripción vas a registrar?</h3><p>La reinscripción recupera datos existentes. El nuevo ingreso permite registrar una familia nueva o agregar un hermano.</p></div></div><div className="entry-choice-grid"><button className="entry-choice" onClick={() => { setEntryType("REINSCRIPTION"); setStep(7); }}><span className="stat-icon blue"><AppIcon name="check" /></span><strong>Reinscripción</strong><small>Busca e importa alumnos del ciclo anterior.</small></button><button className="entry-choice" onClick={() => { setEntryType("NEW_INCOME"); setStep(1); if (initialFamilyId) void chooseFamily(initialFamilyId); }}><span className="stat-icon mint"><AppIcon name="plus" /></span><strong>Nuevo ingreso</strong><small>Captura los datos de una familia nueva.</small></button></div></div>}
      {step === 1 && <div className="registration-content"><div className="form-intro"><span className="intro-icon coral"><AppIcon name="users" size={26} /></span><div><h3>Datos de la familia</h3><p>Busca una familia para importar sus datos compartidos o registra una nueva.</p></div></div><div className="form-grid"><label className="field-label">Familia existente {entryType === "NEW_INCOME" && <small>(opcional, si ya hay hermanos)</small>}<SearchableSelect value={String(familyId ?? "")} options={families.map((f) => ({ value: String(f.id), label: f.name }))} onChange={(raw) => { const id = Number(raw) || null; setFamilyId(id); if (id) void chooseFamily(id); else { setFamilyName(""); setProfile({ submissionDate: localDate() }); } }} placeholder="Buscar familia…" /></label>{familyId ? <div className="info-tile"><small>FAMILIA VINCULADA</small><strong>{familyName}</strong></div> : <label className="field-label">Nombre de familia<input value={familyName} onChange={(e) => setFamilyName(e.target.value)} /></label>}</div></div>}
      {step === 2 && <div className="registration-content"><div className="form-intro"><span className="intro-icon coral"><AppIcon name="users" size={26} /></span><div><h3>Datos de la madre</h3><p>Completa los datos de contacto y laborales que correspondan.</p></div></div><div className="form-grid">{motherFields.map(([key, label]) => orderedOptions[key] ? selectField(key, label) : textField(key, label, key.toLowerCase().includes("email") ? "email" : "text"))}</div></div>}
      {step === 3 && <div className="registration-content"><div className="form-intro"><span className="intro-icon blue"><AppIcon name="users" size={26} /></span><div><h3>Datos del padre</h3><p>Completa los datos de contacto y laborales que correspondan.</p></div></div><div className="form-grid">{fatherFields.map(([key, label]) => orderedOptions[key] ? selectField(key, label) : textField(key, label, key.toLowerCase().includes("phone") ? "tel" : "text"))}</div></div>}
      {step === 4 && <div className="registration-content"><div className="form-intro"><span className="intro-icon mint"><AppIcon name="users" size={26} /></span><div><h3>Domicilio y contacto de emergencia</h3><p>Los teléfonos de madre, padre y representante ya están en sus pasos. Aquí registra una persona de emergencia y, si hace falta, un contacto alternativo.</p></div></div><div className="form-grid">{homeFields.map(([key, label]) => orderedOptions[key] ? selectField(key, label) : textField(key, label, key.toLowerCase().includes("phone") ? "tel" : "text"))}</div></div>}
      {step === 5 && <div className="registration-content"><div className="form-intro"><span className="intro-icon mint"><AppIcon name="users" size={26} /></span><div><h3>¿Quién representará al alumno?</h3><p>Si es la madre o el padre, reutilizamos sus datos; solo captura otra persona cuando corresponda.</p></div></div><div className="form-grid"><label className="field-label">Representante<SearchableSelect value={String(profile.representativeType ?? "")} options={representativeTypeOptions} onChange={selectRepresentativeType} placeholder="Seleccionar representante…" /></label></div>{representativeFromParent ? <div className="registration-student-list"><article className="family-child"><span><strong>{String(profile[profile.representativeType === "MOTHER" ? "motherName" : "fatherName"] ?? "Falta el nombre")}</strong><small>{String(profile[profile.representativeType === "MOTHER" ? "motherPhone" : "fatherPhone"] ?? "Sin teléfono registrado")} · Los datos se tomarán del paso de {profile.representativeType === "MOTHER" ? "madre" : "padre"}.</small></span><button type="button" className="text-button" onClick={() => setStep(profile.representativeType === "MOTHER" ? 2 : 3)}>Editar datos</button></article></div> : profile.representativeType === "OTHER" ? <div className="form-grid">{representativeIdentityFields.map(([key, label]) => orderedOptions[key] ? selectField(key, label) : textField(key, label, key === "representativeAge" ? "number" : "text"))}</div> : null}</div>}
      {step === 6 && <div className="registration-content"><div className="form-intro"><span className="intro-icon blue"><AppIcon name="users" size={26} /></span><div><h3>Contacto del representante</h3><p>Indica dónde localizar al representante legal.</p></div></div><div className="form-grid">{representativeContactFields.map(([key, label]) => textField(key, label, key.toLowerCase().includes("phone") ? "tel" : "text"))}</div></div>}
      {step === 7 && <div className="registration-content"><div className="form-intro"><span className="intro-icon blue"><AppIcon name="users" size={26} /></span><div><h3>{students.length ? `Agregar alumno ${students.length + 1}` : "Datos del alumno"}</h3><p>{entryType === "REINSCRIPTION" ? "Busca e importa al alumno existente. Puedes agregar hermanos aquí; después completarás los datos familiares y el contrato de cada alumno." : "Captura nombres y apellidos completos. Puedes agregar varios alumnos a esta inscripción."}</p></div></div>
        {entryType === "REINSCRIPTION" && <div className="student-search-block"><label className="field-label">Buscar alumno existente<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, apellido o código escolar" /></label><div className="student-search-results">{filteredCandidates.slice(0, 8).map((candidate) => { const nextGrade = candidate.currentGrade ? gradeOptions.find((grade) => grade.id === promotedGrade(candidate.currentGrade!, gradeOptions))?.name : candidate.proposedGrade; return <button type="button" key={candidate.id} className={selectedCandidateId === candidate.id ? "student-search-result selected" : "student-search-result"} onClick={() => { setSelectedCandidateId(candidate.id); void importStudent(candidate.id); }}><span><strong>{candidate.firstName} {candidate.lastName}</strong><small>{candidate.currentGrade || "Grado actual por confirmar"} → {nextGrade || "Grado por definir"}</small></span><span className="status-pill success">Importar datos</span></button>; })}</div></div>}
        {entryType === "REINSCRIPTION" && draft.studentId && <details className="student-extra-details"><summary>Buscar otra ficha histórica</summary><div className="student-search-block"><label className="field-label">Nombre o DPI consignado<input value={historicalSearch} onChange={(event) => setHistoricalSearch(event.target.value)} placeholder="Al menos tres caracteres" /></label><button type="button" className="button button-soft" onClick={() => void searchHistoricalIntakes()}>Buscar ficha histórica</button></div></details>}
        {historicalIntakes.length > 0 && <div className="registration-student-list"><h4>Fichas de inscripción de años anteriores</h4><p className="muted">Las fichas ya vinculadas alimentan los datos familiares. Usa una ficha adicional solo si faltan datos o debes revisar una coincidencia.</p>{historicalIntakes.map((row) => <article className="family-child" key={row.id}><span><strong>{row.firstName} {row.lastName}</strong><small>Ciclo {row.schoolYear} · fila {row.sourceRowId}{row.intakeDocumentNumber ? ` · DPI en ficha ${formatDpi(row.intakeDocumentNumber)}` : " · sin DPI válido"}</small></span><button type="button" className="button button-soft" onClick={() => importHistoricalIntake(row)}>{row.matchedStudentId === draft.studentId ? "Completar faltantes" : "Vincular e importar"}</button></article>)}</div>}
        <div className="form-grid"><label className="field-label">Nombres<input value={draft.firstName} onChange={(e) => setDraft((v) => ({ ...v, firstName: e.target.value }))} /></label><label className="field-label">Apellidos<input value={draft.lastName} onChange={(e) => setDraft((v) => ({ ...v, lastName: e.target.value }))} /></label><DatePartsField label="Fecha de nacimiento" value={draft.birthDate || null} minYear={1900} maxYear={new Date().getFullYear()} onChange={(value) => setDraft((v) => ({ ...v, birthDate: value ?? "" }))} /><details className="student-extra-details"><summary>Datos adicionales del alumno (CUI y teléfono)</summary><div className="form-grid"><label className="field-label">CUI del alumno<input inputMode="numeric" maxLength={15} value={draft.studentDpi} onChange={(e) => setDraft((v) => ({ ...v, studentDpi: formatDpi(e.target.value) }))} /></label><label className="field-label">Teléfono de contacto<span className="phone-field"><SearchableSelect value={draft.phoneCountryCode ?? "GT"} options={countryCodes.map((item) => ({ value: item.countryCode, label: `${item.dialCode} · ${item.countryName}` }))} onChange={(value) => setDraft((v) => ({ ...v, phoneCountryCode: value }))} placeholder="Código de país" /><input type="tel" inputMode="numeric" maxLength={(countryCodes.find((item) => item.countryCode === draft.phoneCountryCode)?.phoneDigits ?? 8) + 1} value={draft.phone} onChange={(e) => { const country = countryCodes.find((item) => item.countryCode === draft.phoneCountryCode); setDraft((v) => ({ ...v, phone: formatPhone(e.target.value, country?.dialCode, country?.phoneDigits) })); }} /></span></label></div></details>{entryType === "REINSCRIPTION" && <div className="info-tile"><small>GRADO ACTUAL</small><strong>{draft.currentGrade || "Selecciona un alumno"}</strong></div>}<label className="field-label">Grado para 2027<select value={draft.gradeId || ""} onChange={(e) => setDraft((v) => ({ ...v, gradeId: Number(e.target.value) }))}><option value="">Selecciona un grado</option>{gradeOptions.map((grade) => <option value={grade.id} key={grade.id}>{grade.name}{normalizeGrade(grade.name) === "quinto bachillerato" ? " · último grado" : ""}</option>)}</select></label><label className="field-label">Sección<select value={draft.section} onChange={(e) => setDraft((v) => ({ ...v, section: e.target.value }))}><option value="">Seleccionar sección</option>{optionsWithExistingValue(["A", "B", "C"], draft.section).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label></div>
        {draft.imported && <p className="import-notice"><AppIcon name="check" size={16} /> Datos del ciclo anterior importados; puedes actualizarlos antes de continuar.</p>}
        <button className="button button-soft" type="button" onClick={queueStudentForContract}><AppIcon name="plus" size={17} /> Guardar alumno y agregar otro</button>
        {students.length > 0 && <div className="registration-student-list"><h4>Alumnos incluidos ({students.length})</h4><p className="muted">Puedes registrar varios hermanos en la misma inscripción.</p>{students.map((student) => <article className="family-child" key={student.key}><span><strong>{student.firstName} {student.lastName}</strong><small>{gradeOptions.find((grade) => grade.id === student.gradeId)?.name}</small></span><button type="button" className="text-button" onClick={() => setStudents((current) => current.filter((item) => item.key !== student.key))}>Quitar</button></article>)}</div>}
      </div>}
      {step === 8 && <div className="registration-content"><div className="form-intro"><span className="intro-icon mint"><AppIcon name="check" size={26} /></span><div><h3>Revisar inscripción</h3><p>Los contratos tomarán los datos de la familia, el representante y cada alumno. No hay otro formulario que llenar.</p></div></div><div className="registration-student-list">{students.map((student) => <article className="family-child" key={student.key}><span><strong>{student.firstName} {student.lastName}</strong><small>{gradeOptions.find((grade) => grade.id === student.gradeId)?.name} · Ciclo {year?.year ?? 2027}</small></span></article>)}</div><p className="muted">El correlativo se asigna al generar cada contrato. Las cuotas y datos institucionales se toman de la configuración del ciclo y grado; si faltan, deberán configurarse antes de emitirlo.</p></div>}
      {error && <p className="alert-error" role="alert">{error}</p>}
      <footer className="registration-actions"><button className="button button-soft" type="button" onClick={() => step === 0 ? router.push("/") : setStep(previousStep)}>{step === 0 ? "Cancelar" : "Atrás"}</button>{step === 7 ? <button className="button button-primary" type="button" onClick={continueFromStudents}>Continuar <AppIcon name="arrow" size={18} /></button> : step === 8 ? <button className="button button-primary" type="button" disabled={busy || !students.length} onClick={() => void submit()}>{busy ? "Guardando…" : "Guardar inscripción"}<AppIcon name="check" size={18} /></button> : entryType === "REINSCRIPTION" && (step === 6 || (step === 5 && representativeFromParent)) ? <button className="button button-primary" type="button" onClick={reviewAdmission}>Revisar inscripción <AppIcon name="arrow" size={18} /></button> : <button className="button button-primary" type="button" disabled={step === 0} onClick={() => { setError(""); if (step === 5 && !profile.representativeType) { setError("Selecciona al representante."); return; } if (step === 5 && representativeFromParent && !String(profile[profile.representativeType === "MOTHER" ? "motherName" : "fatherName"] ?? "").trim()) { setError("Completa el nombre del padre o madre seleccionado."); return; } if (nextStep !== undefined) setStep(nextStep); }}>{step === 0 ? "Elige un tipo de ingreso" : "Continuar"}<AppIcon name="arrow" size={18} /></button>}</footer>
    </section>
  </main>;
}
