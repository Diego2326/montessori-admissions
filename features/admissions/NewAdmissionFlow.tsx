"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AppIcon } from "@/components/AppIcon";
import { SearchableSelect } from "@/components/SearchableSelect";
import { operation, save } from "@/lib/operations/client";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import type { Bootstrap, CountryCallingCode, Enrollment, EnrollmentProfile, FamilyIntake, FamilySummary, PreEnrollmentSubmissionPage } from "@/lib/operations/types";
import { DatePartsField } from "./DatePartsField";
import { guatemalaLocations } from "./guatemalaLocations";
import { civilStatusOptions, nationalityOptions, optionsWithExistingValue, representativeTypeOptions } from "./normalizedOptions";

type EntryType = "REINSCRIPTION" | "NEW_INCOME";
type EmergencyContact = { name: string; phone: string; alternatePhone: string };
type StudentDraft = { key: string; studentId?: number; studentUuid?: string; historicalIntakeId?: number; firstName: string; lastName: string; currentGrade: string; gradeId: number; birthDate: string; studentDpi: string; phone: string; phoneCountryCode?: string; imported: boolean; enroll: boolean; alreadyEnrolled?: boolean };
type HistoricalIntake = { id: number; sourceRowId: number; schoolYear: number; firstName: string; lastName: string; birthDate: string | null; intakeDocumentNumber: string | null; sourceGrade: string | null; motherName: string | null; motherWorkplace: string | null; motherMobile: string | null; motherDpi: string | null; fatherName: string | null; fatherOccupation: string | null; fatherWorkplace: string | null; fatherMobile: string | null; address: string | null; city: string | null; otherContact: string | null; contactMobile: string | null; attendedBy: string | null; matchedStudentId: number | null };
const publicDocumentTypeOptions = [{ value: "DPI", label: "DPI" }, { value: "PASAPORTE", label: "Pasaporte" }] as const;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const orderedOptions: Record<string, readonly (string | { value: string; label: string })[]> = {
  representativeType: representativeTypeOptions,
  representativeCivilStatus: civilStatusOptions,
  representativeNationality: nationalityOptions,
  representativeDocumentType: publicDocumentTypeOptions,
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
  if (digits.length <= 9) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  return `${digits.slice(0, 4)} ${digits.slice(4, 9)} ${digits.slice(9)}`;
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

async function latestPreEnrollmentForFamily(familyId: number) {
  const pageSize = 100;
  const firstPage = await operation<PreEnrollmentSubmissionPage>(`admission-workflow/pre-enrollment-responses?page=1&pageSize=${pageSize}&decision=all&sort=newest`);
  const pageCount = Math.ceil(firstPage.total / pageSize);
  const findLatest = (items: PreEnrollmentSubmissionPage["items"]) => items
    .filter((item) => item.familyId === familyId)
    .sort((left, right) => Date.parse(right.submittedAt) - Date.parse(left.submittedAt) || right.id - left.id)[0] ?? null;
  const firstMatch = findLatest(firstPage.items);
  if (firstMatch || pageCount <= 1) return firstMatch;
  for (let startPage = 2; startPage <= pageCount; startPage += 5) {
    const pageNumbers = Array.from({ length: Math.min(5, pageCount - startPage + 1) }, (_, index) => startPage + index);
    const pages = await Promise.all(pageNumbers.map((page) => operation<PreEnrollmentSubmissionPage>(`admission-workflow/pre-enrollment-responses?page=${page}&pageSize=${pageSize}&decision=all&sort=newest`)));
    const match = findLatest(pages.flatMap((page) => page.items));
    if (match) return match;
  }
  return null;
}

function hydrateParentRepresentative(profile: EnrollmentProfile): EnrollmentProfile {
  const type = String(profile.representativeType ?? "").toUpperCase();
  const prefix = ["MOTHER", "MADRE", "MAMA"].includes(type) ? "mother" : ["FATHER", "PADRE", "PAPA"].includes(type) ? "father" : null;
  const normalizedProfile: EnrollmentProfile = { ...profile, city: profile.municipality || profile.city, municipality: profile.municipality || profile.city };
  if (!prefix) return ["OTHER", "OTRO"].includes(type) ? { ...normalizedProfile, representativeType: "OTHER" } : normalizedProfile;
  const parentName = String(normalizedProfile[`${prefix}Name`] ?? "").trim();
  const [firstName = "", ...lastNames] = parentName.split(/\s+/);
  return {
    ...normalizedProfile,
    representativeType: prefix === "mother" ? "MOTHER" : "FATHER",
    representativeName: normalizedProfile.representativeName || parentName,
    representativeFirstName: normalizedProfile.representativeFirstName || firstName,
    representativeLastName: normalizedProfile.representativeLastName || lastNames.join(" "),
    representativeBirthDate: normalizedProfile[`${prefix}BirthDate`] || normalizedProfile.representativeBirthDate,
    representativeAge: calculateAgeValue(String(normalizedProfile[`${prefix}BirthDate`] || normalizedProfile.representativeBirthDate || "")),
    representativeEmail: normalizedProfile[`${prefix}Email`] || normalizedProfile.representativeEmail,
    representativeWorkplace: normalizedProfile[`${prefix}Workplace`] || normalizedProfile.representativeWorkplace,
    representativeOccupation: normalizedProfile[`${prefix}Occupation`] || normalizedProfile.representativeOccupation,
    representativeDocumentType: normalizedProfile[`${prefix}Dpi`] ? "DPI" : normalizedProfile.representativeDocumentType,
    representativeDocument: normalizedProfile[`${prefix}Dpi`] || normalizedProfile.representativeDocument,
    representativeResidence: normalizedProfile.address || normalizedProfile.representativeResidence,
    representativeMobilePhone: normalizedProfile[`${prefix}Phone`] || normalizedProfile.representativeMobilePhone,
    representativeHomePhone: normalizedProfile[`${prefix}HomePhone`] || normalizedProfile.representativeHomePhone,
    representativeOfficePhone: normalizedProfile[`${prefix}OfficePhone`] || normalizedProfile.representativeOfficePhone,
  };
}

function calculateAgeValue(value: string): number | null {
  if (!value) return null;
  const birthDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export function NewAdmissionFlow({ initialFamilyId = null, initialStudentId = null, initialMode = null }: { initialFamilyId?: number | null; initialStudentId?: number | null; initialMode?: EntryType | null }) {
  const router = useRouter();
  const entryType = initialMode ?? "NEW_INCOME";
  const [candidates, setCandidates] = useState<AdmissionCandidate[]>([]);
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [countryCodes, setCountryCodes] = useState<CountryCallingCode[]>([]);
  const [phoneCountries, setPhoneCountries] = useState<Record<string, string>>({});
  const [familyId, setFamilyId] = useState<number | null>(initialFamilyId);
  const [familyName, setFamilyName] = useState("");
  const [profile, setProfile] = useState<EnrollmentProfile>({ submissionDate: localDate() });
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([{ name: "", phone: "", alternatePhone: "" }]);
  const [search, setSearch] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(initialStudentId);
  const [draft, setDraft] = useState<StudentDraft>({ key: "student-1", firstName: "", lastName: "", currentGrade: "", gradeId: 0, birthDate: "", studentDpi: "", phone: "", phoneCountryCode: "GT", imported: false, enroll: true });
  const [students, setStudents] = useState<StudentDraft[]>([]);
  const [historicalIntakes, setHistoricalIntakes] = useState<HistoricalIntake[]>([]);
  const [historicalSearch, setHistoricalSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    void Promise.all([
      operation<FamilySummary[]>("admission-workflow/families"),
      operation<{ candidates: AdmissionCandidate[] }>("admission-workflow/2027/overview"),
      operation<Bootstrap>("enrollments/bootstrap"),
      operation<CountryCallingCode[]>("country-codes"),
    ]).then(async ([familyRows, overview, setup, countryRows]) => {
      if (!active) return;
      setCandidates(overview.candidates); setBootstrap(setup);
      setCountryCodes(countryRows);
      setPhoneCountries(Object.fromEntries(["motherPhone", "motherHomePhone", "motherOfficePhone", "fatherPhone", "fatherHomePhone", "fatherOfficePhone", "emergencyPhone", "emergencyContactPhone", "representativeHomePhone", "representativeOfficePhone", "representativeMobilePhone"].map((key) => [key, "GT"])));
      const family = familyRows.find((item) => item.id === initialFamilyId);
      if (family) setFamilyName(family.name);
      if (initialStudentId) {
        const candidate = overview.candidates.find((item) => item.id === initialStudentId);
        if (candidate) {
          setSearch(`${candidate.firstName} ${candidate.lastName}`);
          if (entryType === "REINSCRIPTION" && candidate.familyId) {
            await loadFamilyStudents(candidate, overview.candidates, setup, familyRows);
          } else {
            await importStudent(initialStudentId, overview.candidates, setup);
          }
        }
      }
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar los datos demo"));
    return () => { active = false; };
  // The initial URL values are fixed for this page instance.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const gradeOptions = bootstrap?.gradeLevels ?? [];
  const departmentOptions = Object.keys(guatemalaLocations).sort((a, b) => a.localeCompare(b, "es"));
  const municipalityOptions = profile.department && profile.department in guatemalaLocations
    ? guatemalaLocations[profile.department as keyof typeof guatemalaLocations]
    : [];
  const year = bootstrap?.schoolYears.find((item) => item.year === 2027);
  const filteredCandidates = useMemo(() => candidates.filter((candidate) => {
    const needle = search.trim().toLocaleLowerCase("es");
    if (!needle) return false;
    if (familyId && candidate.familyId !== familyId) return false;
    if (students.some((student) => student.studentId === candidate.id)) return false;
    const searchable = `${candidate.firstName} ${candidate.lastName} ${candidate.id}`.toLocaleLowerCase("es");
    return searchable.includes(needle);
  }), [candidates, familyId, search, students, year]);

  async function loadFamilyStudents(selectedCandidate: AdmissionCandidate, candidateRows: AdmissionCandidate[], setup: Bootstrap, familyRows: FamilySummary[]) {
    const selectedFamilyId = selectedCandidate.familyId;
    if (!selectedFamilyId) return;
    setFamilyId(selectedFamilyId);
    const family = familyRows.find((item) => item.id === selectedFamilyId);
    setFamilyName(family?.name ?? selectedCandidate.familyName ?? "");
    setProfile({ submissionDate: localDate() });
    setEmergencyContacts([{ name: "", phone: "", alternatePhone: "" }]);

    let submission: PreEnrollmentSubmissionPage["items"][number] | null = null;
    const warnings: string[] = [];
    try {
      const latestSubmission = await latestPreEnrollmentForFamily(selectedFamilyId);
      submission = latestSubmission;
      if (latestSubmission) {
        setFamilyName(latestSubmission.familyName || family?.name || selectedCandidate.familyName || "");
        setProfile(hydrateParentRepresentative({ submissionDate: localDate(), ...latestSubmission.profile }));
        const savedContacts = (latestSubmission.profile as EnrollmentProfile & { emergencyContacts?: EmergencyContact[] }).emergencyContacts;
        const normalizedContacts = Array.isArray(savedContacts) && savedContacts.length
          ? savedContacts.map((contact) => ({ name: contact.name ?? "", phone: formatPhone(contact.phone ?? ""), alternatePhone: formatPhone(contact.alternatePhone ?? "") }))
          : latestSubmission.profile.emergencyContactName || latestSubmission.profile.emergencyContactPhone
            ? [{ name: String(latestSubmission.profile.emergencyContactName ?? ""), phone: formatPhone(String(latestSubmission.profile.emergencyContactPhone ?? "")), alternatePhone: formatPhone(String(latestSubmission.profile.emergencyPhone ?? "")) }]
            : [{ name: "", phone: "", alternatePhone: "" }];
        setEmergencyContacts(normalizedContacts);
      }
    } catch {
      warnings.push("No se pudo consultar la respuesta de preinscripción; se cargaron los datos del expediente escolar.");
    }

    const familyCandidates = candidateRows.filter((candidate) => candidate.familyId === selectedFamilyId && candidate.status !== "GRADUATED");
    const members = familyCandidates.some((candidate) => candidate.id === selectedCandidate.id)
      ? familyCandidates
      : [selectedCandidate, ...familyCandidates];
    const savedPreEnrollment = submission;
    const loadedMembers = await Promise.all(members.map(async (candidate) => {
      try {
        return { candidate, history: await operation<Enrollment[]>(`students/${candidate.id}/enrollments`) };
      } catch {
        warnings.push(`No se pudo cargar el historial de ${candidate.firstName} ${candidate.lastName}.`);
        return { candidate, history: [] as Enrollment[] };
      }
    }));

    const loadedStudents = loadedMembers.map(({ candidate, history }) => {
      const previous = history.filter((enrollment) => (enrollment.schoolYear ?? 0) < 2027).sort((left, right) => (right.schoolYear ?? 0) - (left.schoolYear ?? 0))[0];
      const alreadyEnrolled = history.some((enrollment) => enrollment.schoolYear === 2027);
      const candidateName = `${candidate.firstName} ${candidate.lastName}`.trim().toLocaleLowerCase("es");
      const preEnrollmentStudent = savedPreEnrollment?.students.find((student) =>
        (candidate.uuid && student.publicId.toLocaleLowerCase() === candidate.uuid.toLocaleLowerCase()) ||
        `${student.firstName} ${student.lastName}`.trim().toLocaleLowerCase("es") === candidateName,
      );
      const currentGrade = preEnrollmentStudent?.currentGrade || candidate.currentGrade || previous?.gradeName || "";
      const proposedGradeId = setup.gradeLevels.find((grade) => normalizeGrade(grade.name) === normalizeGrade(candidate.proposedGrade ?? ""))?.id ?? 0;
      const publicId = preEnrollmentStudent?.publicId ?? candidate.uuid;
      const selectedByFamily = Boolean(savedPreEnrollment?.wantsEnroll && (
        preEnrollmentStudent?.selected || (publicId && savedPreEnrollment.selectedStudentPublicIds.some((id) => id.toLocaleLowerCase() === publicId.toLocaleLowerCase()))
      ));
      return {
        key: `student-${candidate.id}`,
        studentId: candidate.id,
        studentUuid: candidate.uuid ?? preEnrollmentStudent?.publicId,
        firstName: preEnrollmentStudent?.firstName.trim() || candidate.firstName.trim(),
        lastName: preEnrollmentStudent?.lastName.trim() || candidate.lastName.trim(),
        currentGrade,
        gradeId: promotedGrade(currentGrade, setup.gradeLevels) || proposedGradeId,
        birthDate: String(preEnrollmentStudent?.birthDate ?? candidate.birthDate ?? previous?.profile?.birthDate ?? ""),
        studentDpi: String(previous?.profile?.studentDpi ?? ""),
        phone: formatPhone(String(previous?.profile?.studentPhone ?? "")),
        phoneCountryCode: "GT",
        imported: Boolean(preEnrollmentStudent || previous),
        enroll: alreadyEnrolled ? false : savedPreEnrollment ? selectedByFamily : candidate.id === selectedCandidate.id,
        alreadyEnrolled,
      } satisfies StudentDraft;
    });

    setStudents(loadedStudents);
    setSelectedCandidateId(selectedCandidate.id);
    setDraft({ key: "student-draft", firstName: "", lastName: "", currentGrade: "", gradeId: 0, birthDate: "", studentDpi: "", phone: "", phoneCountryCode: "GT", imported: false, enroll: true });
    setSearch("");
    setHistoricalIntakes([]);
    if (warnings.length) setError(warnings.join(" "));
  }

  function calculateAge(value: string) {
    const birthDate = new Date(`${value}T00:00:00`);
    if (Number.isNaN(birthDate.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    if (today.getMonth() < birthDate.getMonth() || (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())) age -= 1;
    return age >= 0 ? age : null;
  }
  function setValue(key: string, value: string | number | null) {
    setProfile((current) => {
      const next: EnrollmentProfile = { ...current, [key]: value };
      if (key === "department") { next.city = ""; next.municipality = ""; }
      if (key === "city" || key === "municipality") { next.city = value; next.municipality = value; }
      if (key === "address" && current.representativeType) next.representativeResidence = value;
      if (key === "representativeResidence") next.address = value;
      const parentPrefix = current.representativeType === "MOTHER" ? "mother" : current.representativeType === "FATHER" ? "father" : null;
      const mirroredKeys: Record<string, string> = { phone: "representativeMobilePhone", email: "representativeEmail", occupation: "representativeOccupation", workplace: "representativeWorkplace", homePhone: "representativeHomePhone", officePhone: "representativeOfficePhone" };
      if (parentPrefix && key.startsWith(parentPrefix)) {
        const field = key.slice(parentPrefix.length);
        const normalizedField = field ? field[0].toLocaleLowerCase() + field.slice(1) : "";
        if (mirroredKeys[normalizedField]) next[mirroredKeys[normalizedField]] = value;
      }
      if (key === "motherBirthDate" && current.representativeType === "MOTHER") { next.representativeBirthDate = value; next.representativeAge = typeof value === "string" ? calculateAge(value) : null; }
      if (key === "fatherBirthDate" && current.representativeType === "FATHER") { next.representativeBirthDate = value; next.representativeAge = typeof value === "string" ? calculateAge(value) : null; }
      if (key === "representativeBirthDate") next.representativeAge = typeof value === "string" ? calculateAge(value) : null;
      if ((key === "representativeFirstName" || key === "representativeLastName") && parentPrefix) {
        const first = String(next.representativeFirstName ?? "").trim();
        const last = String(next.representativeLastName ?? "").trim();
        next[`${parentPrefix}Name`] = `${first} ${last}`.trim();
      }
      return next;
    });
  }
  function countryForPhone(key: string) {
    const parentPhone = profile.representativeType === "MOTHER" ? "motherPhone" : profile.representativeType === "FATHER" ? "fatherPhone" : null;
    const code = key === "representativeMobilePhone" && parentPhone ? phoneCountries[parentPhone] : phoneCountries[key];
    return countryCodes.find((country) => country.countryCode === code) ?? countryCodes.find((country) => country.countryCode === "GT");
  }

  function selectRepresentativeType(value: string) {
    setProfile((current) => {
      const isMother = value === "MOTHER" || value === "MADRE";
      const isFather = value === "FATHER" || value === "PADRE";
      if (!isMother && !isFather) return {
        ...current, representativeType: value, representativeName: "", representativeFirstName: "", representativeLastName: "", representativeAge: null,
        representativeBirthDate: "", representativeCivilStatus: "", representativeNationality: "Guatemala", representativeOccupation: "",
        representativeWorkplace: "", representativeDocument: "", representativeDocumentType: "", representativeEmail: "",
        representativeMobilePhone: "", representativeHomePhone: "", representativeOfficePhone: "", representativeResidence: "",
      };
      const prefix = isMother ? "mother" : "father";
      const sameRepresentative = current.representativeType === value;
      const fullName = String(current[`${prefix}Name`] || "").trim();
      const [representativeFirstName = "", ...representativeLastNames] = fullName.split(/\s+/);
      return {
        ...current,
        representativeType: value,
        representativeName: fullName,
        representativeFirstName,
        representativeLastName: representativeLastNames.join(" "),
        representativeBirthDate: current[`${prefix}BirthDate`] || (sameRepresentative ? current.representativeBirthDate : ""),
        representativeEmail: current[`${prefix}Email`] || (sameRepresentative ? current.representativeEmail : ""),
        representativeCivilStatus: sameRepresentative ? current.representativeCivilStatus : "",
        representativeNationality: sameRepresentative && current.representativeNationality ? current.representativeNationality : "Guatemala",
        representativeWorkplace: current[`${prefix}Workplace`] || (sameRepresentative ? current.representativeWorkplace : ""),
        representativeOccupation: current[`${prefix}Occupation`] || (sameRepresentative ? current.representativeOccupation : ""),
        representativeDocumentType: current[`${prefix}Dpi`] ? "DPI" : sameRepresentative ? current.representativeDocumentType : "",
        representativeDocument: current[`${prefix}Dpi`] || (sameRepresentative ? current.representativeDocument : ""),
        representativeResidence: current.address || (sameRepresentative ? current.representativeResidence : ""),
        representativeHomePhone: current[`${prefix}HomePhone`] || current[`${prefix}Phone`] || (sameRepresentative ? current.representativeHomePhone : ""),
        representativeOfficePhone: current[`${prefix}OfficePhone`] || (sameRepresentative ? current.representativeOfficePhone : ""),
        representativeMobilePhone: current[`${prefix}Phone`] || (sameRepresentative ? current.representativeMobilePhone : ""),
        representativeAge: calculateAge(String(current[`${prefix}BirthDate`] || (sameRepresentative ? current.representativeBirthDate : "") || "")),
      };
    });
  }

  async function importStudent(candidateId: number, candidateRows = candidates, setup = bootstrap) {
    const candidate = candidateRows.find((item) => item.id === candidateId);
    if (!candidate || !setup) return;
    if (candidate.status === "GRADUATED") { setError("Quinto bachillerato es el último grado. Revisa el caso antes de iniciar una reinscripción."); return; }
    if (candidate.familyId && familyId && candidate.familyId !== familyId) { setError("Este alumno pertenece a otra familia. Revisa el vínculo antes de importarlo."); return; }
    let yearEnrollments: Enrollment[];
    try { yearEnrollments = await operation<Enrollment[]>(`students/${candidate.id}/enrollments`); }
    catch { setError("No se pudo consultar el historial del alumno. Intenta de nuevo antes de importarlo."); return; }
    const previous = yearEnrollments.filter((item) => (item.schoolYear ?? 0) < 2027).sort((a, b) => (b.schoolYear ?? 0) - (a.schoolYear ?? 0))[0];
    const targetEnrollment = yearEnrollments.find((item) => item.schoolYear === 2027);
    if (targetEnrollment) { setError(`${candidate.firstName} ${candidate.lastName} ya tiene una inscripción para 2027. Ábrela desde la ficha familiar para revisarla.`); return; }
    if (!candidate.familyId && familyId) { setError("Este alumno no tiene familia vinculada. Confirma que pertenece a la familia seleccionada antes de guardar."); }
    const currentGrade = candidate.currentGrade ?? previous?.gradeName ?? "";
    const targetGradeId = promotedGrade(currentGrade, setup.gradeLevels) || (setup.gradeLevels.find((grade) => normalizeGrade(grade.name) === normalizeGrade(candidate.proposedGrade ?? ""))?.id ?? 0);
    setDraft({
      key: `student-${candidate.id}`, studentId: candidate.id, studentUuid: candidate.uuid ?? undefined,
      firstName: candidate.firstName.trim(), lastName: candidate.lastName.trim(),
      currentGrade, gradeId: targetGradeId,
      birthDate: String(previous?.profile?.birthDate ?? candidate.birthDate ?? ""),
      studentDpi: String(previous?.profile?.studentDpi ?? ""),
      phone: formatPhone(String(previous?.profile?.studentPhone ?? "")), phoneCountryCode: "GT", imported: Boolean(previous), enroll: true,
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
    setDraft({ key, firstName: "", lastName: "", currentGrade: "", gradeId: 0, birthDate: "", studentDpi: "", phone: "", phoneCountryCode: "GT", imported: false, enroll: true });
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

  function updateEmergencyContact(index: number, key: keyof EmergencyContact, value: string) {
    const nextValue = key === "phone" || key === "alternatePhone" ? formatPhone(value) : value;
    setEmergencyContacts((current) => current.map((contact, contactIndex) => contactIndex === index ? { ...contact, [key]: nextValue } : contact));
  }

  function addEmergencyContact() { setEmergencyContacts((current) => [...current, { name: "", phone: "", alternatePhone: "" }]); }

  function removeEmergencyContact(index: number) {
    setEmergencyContacts((current) => current.length > 1 ? current.filter((_, contactIndex) => contactIndex !== index) : [{ name: "", phone: "", alternatePhone: "" }]);
  }

  async function submit() {
    setFieldErrors({});
    const enrollmentStudents = entryType === "REINSCRIPTION"
      ? students.filter((student) => student.enroll && !student.alreadyEnrolled)
      : [...students];
    const hasDraftStudent = Boolean(draft.firstName.trim() || draft.lastName.trim() || draft.studentId);
    if (hasDraftStudent) {
      const student = validateStudentDraft();
      if (!student) return;
      enrollmentStudents.push(student);
    }
    if (!entryType || !enrollmentStudents.length || !year) { setError(entryType === "REINSCRIPTION" ? "Selecciona al menos un alumno que continuará en 2027." : "Agrega al menos un alumno y confirma el ciclo 2027."); return; }
    if (entryType === "REINSCRIPTION" && enrollmentStudents.some((student) => !student.studentId)) { setError("En reinscripción todos los alumnos deben importarse desde el registro existente."); return; }
    const parentPrefix = profile.representativeType === "MOTHER" ? "mother" : profile.representativeType === "FATHER" ? "father" : null;
    if (parentPrefix && !String(profile[`${parentPrefix}Name`] ?? "").trim()) { setError("Completa el nombre del padre o madre seleccionado como representante."); return; }
    if (!profile.representativeType || (!parentPrefix && !String(profile.representativeFirstName || profile.representativeName || "").trim())) { setError("Selecciona y completa los datos del representante."); return; }
    const parentRepresentativeName = parentPrefix ? String(profile[`${parentPrefix}Name`] ?? "").trim() : "";
    const [parentRepresentativeFirstName = "", ...parentRepresentativeLastNames] = parentRepresentativeName.split(/\s+/);
    const effectiveProfile: EnrollmentProfile = parentPrefix ? {
      ...profile,
      representativeName: parentRepresentativeName,
      representativeFirstName: parentRepresentativeFirstName,
      representativeLastName: parentRepresentativeLastNames.join(" "),
      representativeBirthDate: profile[`${parentPrefix}BirthDate`] || profile.representativeBirthDate,
      representativeEmail: profile[`${parentPrefix}Email`] || profile.representativeEmail,
      representativeWorkplace: profile[`${parentPrefix}Workplace`] || profile.representativeWorkplace,
      representativeDocumentType: profile[`${parentPrefix}Dpi`] ? "DPI" : profile.representativeDocumentType,
      representativeDocument: profile[`${parentPrefix}Dpi`] || null,
      representativeOccupation: profile[`${parentPrefix}Occupation`] || null,
      representativeResidence: profile.representativeResidence || profile.address || null,
      representativeMobilePhone: profile[`${parentPrefix}Phone`] || null,
      representativeHomePhone: profile[`${parentPrefix}HomePhone`] || null,
      representativeOfficePhone: profile[`${parentPrefix}OfficePhone`] || null,
      representativeAge: calculateAge(String(profile[`${parentPrefix}BirthDate`] || profile.representativeBirthDate || "")),
    } : profile;
    const representativeBirthDate = String(effectiveProfile.representativeBirthDate ?? "").trim();
    const representativeOccupation = String(effectiveProfile.representativeOccupation ?? "").trim();
    const representativeWorkplace = String(effectiveProfile.representativeWorkplace ?? "").trim();
    const representativeResidence = String(effectiveProfile.representativeResidence || effectiveProfile.address || "").trim();
    const requiredRepresentativePhoneKeys = parentPrefix === "mother"
      ? ["motherPhone", "motherHomePhone", "motherOfficePhone"]
      : parentPrefix === "father"
        ? ["fatherPhone", "fatherHomePhone", "fatherOfficePhone"]
        : ["representativeMobilePhone", "representativeHomePhone", "representativeOfficePhone"];
    const requiredPhones = [
      ...requiredRepresentativePhoneKeys.map((key) => String(effectiveProfile[key] ?? "")),
      ...emergencyContacts.flatMap((contact) => [contact.phone, ...(contact.alternatePhone ? [contact.alternatePhone] : [])]),
    ];
    if (enrollmentStudents.some((student) => !student.birthDate.trim())) { setError("Completa la fecha de nacimiento de cada alumno."); return; }
    if (!emergencyContacts.length || emergencyContacts.some((contact) => !contact.name.trim() || !contact.phone.trim())) { setError("Agrega al menos un contacto de emergencia con nombre y teléfono."); return; }
    if (!effectiveProfile.department || !(effectiveProfile.municipality || effectiveProfile.city) || !effectiveProfile.representativeCivilStatus || !effectiveProfile.representativeNationality) { setError("Completa departamento, municipio, estado civil y nacionalidad."); return; }
    if (!representativeBirthDate || !representativeOccupation || !representativeWorkplace || !representativeResidence) { setError("Completa fecha de nacimiento, ocupación, lugar de trabajo y residencia del representante."); return; }
    if (!effectiveProfile.representativeDocumentType || !effectiveProfile.representativeDocument) { setError("Completa el tipo y número de documento del representante."); return; }
    if (requiredPhones.some((phone) => formatPhone(phone).replace(/\D/g, "").length !== 8)) { setError("Todos los teléfonos requeridos deben tener ocho dígitos."); return; }
    const requiredEmailKey = parentPrefix ? `${parentPrefix}Email` : "representativeEmail";
    const requiredEmail = String(effectiveProfile[requiredEmailKey] ?? "").trim();
    if (!requiredEmail || !emailPattern.test(requiredEmail)) {
      setFieldErrors({ [requiredEmailKey]: requiredEmail ? "Revisa el formato del correo." : "Este correo es obligatorio." });
      setError(requiredEmail ? "Revisa el formato del correo marcado." : "Completa el correo electrónico del representante.");
      return;
    }
    const birthDates = [effectiveProfile.motherBirthDate, effectiveProfile.fatherBirthDate, representativeBirthDate, ...enrollmentStudents.map((student) => student.birthDate)];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (birthDates.some((value) => {
      if (!value) return false;
      const birthDate = new Date(`${value}T00:00:00`);
      return Number.isNaN(birthDate.getTime()) || birthDate > today;
    })) { setError("Revisa las fechas de nacimiento; deben ser válidas y no posteriores a hoy."); return; }
    const invalidEmailKeys = (["motherEmail", "fatherEmail", "representativeEmail"] as const).filter((key) => {
      const value = effectiveProfile[key];
      return typeof value === "string" && value.trim() !== "" && !emailPattern.test(value.trim());
    });
    const invalidEmail = invalidEmailKeys.length > 0;
    const invalidPhone = Object.entries(effectiveProfile).some(([key, value]) => key.toLowerCase().includes("phone") && value && value !== "N/A" && value !== "NA" && value !== "n/a" && value !== "na" && value !== "-" && formatPhone(String(value), countryForPhone(key)?.dialCode, countryForPhone(key)?.phoneDigits).replace(/\D/g, "").length !== (countryForPhone(key)?.phoneDigits ?? 8));
    const invalidStudentData = enrollmentStudents.some((student) => {
      const country = countryCodes.find((item) => item.countryCode === student.phoneCountryCode) ?? countryCodes.find((item) => item.countryCode === "GT");
      return Boolean((student.studentDpi && formatDpi(student.studentDpi).replace(/\D/g, "").length !== 13) || (student.phone && formatPhone(student.phone, country?.dialCode, country?.phoneDigits).replace(/\D/g, "").length !== (country?.phoneDigits ?? 8)));
    });
    if (invalidEmail) {
      setFieldErrors(Object.fromEntries(invalidEmailKeys.map((key) => [key, "Revisa el formato del correo."])));
      setError("Revisa el formato de los correos marcados.");
      return;
    }
    if (invalidPhone || invalidStudentData || (effectiveProfile.representativeDocumentType === "DPI" && effectiveProfile.representativeDocument && formatDpi(String(effectiveProfile.representativeDocument)).replace(/\D/g, "").length !== 13) || (effectiveProfile.motherDpi && formatDpi(String(effectiveProfile.motherDpi)).replace(/\D/g, "").length !== 13) || (effectiveProfile.fatherDpi && formatDpi(String(effectiveProfile.fatherDpi)).replace(/\D/g, "").length !== 13)) {
      setError("Revisa teléfonos (8 dígitos) y DPI (13 dígitos) antes de guardar.");
      return;
    }
    setBusy(true); setError("");
    try {
      const primaryEmergencyContact = emergencyContacts[0] ?? { name: "", phone: "", alternatePhone: "" };
      const timestampedProfile: EnrollmentProfile = {
        ...effectiveProfile,
        submissionDate: localDate(),
        emergencyContactName: primaryEmergencyContact.name,
        emergencyContactPhone: primaryEmergencyContact.phone ? `+502 ${formatPhone(primaryEmergencyContact.phone)}` : null,
        emergencyPhone: primaryEmergencyContact.alternatePhone ? `+502 ${formatPhone(primaryEmergencyContact.alternatePhone)}` : null,
      };
      for (const [key, selectedCode] of Object.entries(phoneCountries)) {
        const code = key === "representativeMobilePhone" && parentPrefix ? phoneCountries[`${parentPrefix}Phone`] : selectedCode;
        const value = timestampedProfile[key];
        const country = countryCodes.find((item) => item.countryCode === code);
        if (value && country) timestampedProfile[key] = `${country.dialCode} ${formatPhone(String(value), country.dialCode, country.phoneDigits)}`;
      }
      for (const student of enrollmentStudents) {
        if (!student.studentId) continue;
        const existing = await operation<Enrollment[]>(`students/${student.studentId}/enrollments`);
        if (existing.some((item) => item.schoolYear === 2027)) throw new Error(`${student.firstName} ${student.lastName} ya está inscrito en 2027. Actualiza su inscripción desde la ficha existente.`);
      }
      const representativeFullName = `${effectiveProfile.representativeFirstName ?? ""} ${effectiveProfile.representativeLastName ?? ""}`.trim();
      const defaultName = String(familyName || profile.motherName || profile.fatherName || representativeFullName || "Nueva familia").trim();
      const saved = await save<{ family: FamilyIntake; enrollments: Enrollment[] }>("admission-workflow/intakes", {
        familyId, familyName: defaultName,
        profile: { ...timestampedProfile, emergencyContacts: emergencyContacts.map((contact) => ({ name: contact.name.trim(), phone: contact.phone.trim(), alternatePhone: contact.alternatePhone.trim() || null })) },
        students: enrollmentStudents.map((student) => ({ historicalIntakeId: student.historicalIntakeId ?? null, enrollment: {
          ...(student.studentId ? { studentId: student.studentId, studentUuid: student.studentUuid } : {}),
          firstName: student.firstName, lastName: student.lastName,
          schoolYearId: year.id, gradeId: student.gradeId, section: null,
          rejectExisting: true,
          status: "PENDIENTE_FIRMA",
          profile: { ...timestampedProfile, contractNumber: null, familyName: defaultName, birthDate: student.birthDate || null, studentDpi: student.studentDpi || null, studentPhone: student.phone ? `${countryCodes.find((item) => item.countryCode === student.phoneCountryCode)?.dialCode ?? "+502"} ${formatPhone(student.phone, countryCodes.find((item) => item.countryCode === student.phoneCountryCode)?.dialCode, countryCodes.find((item) => item.countryCode === student.phoneCountryCode)?.phoneDigits)}` : timestampedProfile.representativeMobilePhone || null, currentGrade: student.currentGrade || null },
        } })),
      });
      if (!saved.enrollments?.length) throw new Error("La inscripción se guardó, pero no se generó el contrato.");
      const enrollmentIds = saved.enrollments.map((enrollment) => enrollment.id);
      const previewParams = new URLSearchParams({ ids: enrollmentIds.join(",") });
      const savedFamilyId = saved.family?.id ?? familyId;
      if (savedFamilyId) previewParams.set("familyId", String(savedFamilyId));
      router.replace(`/inscripciones/contrato/${enrollmentIds[0]}?${previewParams.toString()}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la inscripción demo"); }
    finally { setBusy(false); }
  }

  function dateField(key: string, label: string, required = false, optional = false) {
    return <DatePartsField key={key} label={label} value={String(profile[key] ?? "") || null} minYear={1900} maxYear={new Date().getFullYear()} order="day-month-year" required={required} optional={optional} onChange={(value) => setValue(key, value)} />;
  }
  function profileField(key: string, label: string, type = "text", required = false) {
    if (key.endsWith("BirthDate")) return dateField(key, label, required, !required);
    const resolvedType = type !== "text" ? type : key.toLowerCase().includes("email") ? "email" : key.toLowerCase().includes("phone") ? "tel" : "text";
    return orderedOptions[key] ? selectField(key, label, required) : textField(key, label, resolvedType, required);
  }
  function textField(key: string, label: string, type = "text", required = false) {
    const normalizedKey = key.toLowerCase();
    const isPhone = normalizedKey.includes("phone");
    const country = isPhone ? countryForPhone(key) : undefined;
    const formatter = normalizedKey.includes("dpi") || (normalizedKey === "representativedocument" && profile.representativeDocumentType === "DPI") ? formatDpi : isPhone ? (value: string) => formatPhone(value, country?.dialCode, country?.phoneDigits) : null;
    const fieldError = fieldErrors[key];
    return <label className={`field-label public-pre-field ${fieldError ? "has-error" : ""}`} key={key}><span>{label}{required && <b className="public-pre-required" aria-hidden="true"> *</b>}</span><input type={type} inputMode={formatter ? "numeric" : undefined} maxLength={isPhone ? (country?.phoneDigits ?? 8) + 1 : normalizedKey.includes("dpi") || normalizedKey === "representativedocument" ? 15 : undefined} placeholder={isPhone ? "1234-5678" : formatter ? "1234 56789 0123" : undefined} value={formatter ? formatter(String(profile[key] ?? "")) : profile[key] ?? ""} aria-invalid={Boolean(fieldError)} aria-describedby={fieldError ? `${key}-error` : undefined} onChange={(event) => {
      const nextValue = event.target.value;
      setValue(key, type === "number" ? Number(nextValue) || null : formatter ? formatter(nextValue) : nextValue);
      if (type === "email") setFieldErrors((current) => {
        const next = { ...current };
        const normalized = nextValue.trim();
        if (!normalized && required) next[key] = "Este correo es obligatorio.";
        else if (normalized && !emailPattern.test(normalized)) next[key] = "Revisa el formato del correo.";
        else delete next[key];
        return next;
      });
    }} required={required} />{fieldError && <small className="public-pre-field-error" id={`${key}-error`}>{fieldError}</small>}</label>;
  }
  function selectField(key: string, label: string, required = false) {
    const options = orderedOptions[key] ?? [];
    const value = String(profile[key] ?? "");
    return <label className="field-label public-pre-field" key={key}><span>{label}{required && <b className="public-pre-required" aria-hidden="true"> *</b>}</span><SearchableSelect value={value} options={optionsWithExistingValue(options, value)} onChange={(next) => setValue(key, next || null)} placeholder="Buscar en el catálogo…" /></label>;
  }

  function locationField(key: "department" | "city", label: string, options: readonly string[], required = false) {
    const value = String(profile[key] ?? "");
    return <label className="field-label public-pre-field" key={key}><span>{label}{required && <b className="public-pre-required" aria-hidden="true"> *</b>}</span><select value={value} onChange={(event) => setValue(key, event.target.value)} required={required} disabled={key === "city" && !profile.department}><option value="">Seleccione</option>{optionsWithExistingValue(options, value).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>;
  }

  const draftGradeName = gradeOptions.find((grade) => grade.id === draft.gradeId)?.name ?? "Grado para 2027";
  const submitForm = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); void submit(); };

  return <main className="public-boleta-page public-boleta-site public-pre-enrollment-page admission-public-replica">
    <header className="public-boleta-site-header">
      <div className="public-boleta-site-brand"><Image unoptimized src="/logo-colegio.png" alt="Escudo Colegio Bilingüe Montessori Zacapa" width={44} height={44} priority /><span><small>COLEGIO BILINGÜE</small><strong>MONTESSORI ZACAPA</strong></span></div>
    </header>

    <div className="public-boleta-site-content">
      <div className="admission-page-nav"><button type="button" className="admission-back-button" onClick={() => router.push(entryType === "REINSCRIPTION" ? "/inscripciones/reinscripcion" : "/inscripciones/iniciar")}>← Volver a inscripciones</button></div>
      <section className="public-boleta-site-hero public-pre-hero">
        <h1>{entryType === "REINSCRIPTION" ? <>Reinscripción <em>2027.</em></> : <>Inscripción <em>2027.</em></>}</h1>
        <p className="public-pre-greeting">{familyName ? `Familia ${familyName}` : "Nueva familia"}</p>
        <p className="public-pre-intro">{entryType === "REINSCRIPTION" ? "Revisa la respuesta de preinscripción más reciente y confirma los datos de cada alumno para continuar el proceso del ciclo 2027." : "Ingresa la información de la familia, los padres, el representante y cada alumno para preparar la inscripción del ciclo 2027."}</p>
      </section>

      <form className="public-boleta-card public-pre-card" onSubmit={submitForm} noValidate>
        <div className="public-pre-form-heading">
          <div><p className="public-pre-eyebrow">Nombre de la familia: <strong>{familyName || "Nueva familia"}</strong></p><h2>Revise y actualice su información</h2></div>
          <p>Revise y actualice los datos. Todos los teléfonos son obligatorios y deben escribirse como 1234-5678.</p>
        </div>

        <section className="public-pre-section public-pre-representative-choice">
          <h3>Representante familiar</h3>
          <p>¿Quién será el representante familiar durante el proceso de inscripción?</p>
          <div className="public-pre-representative-options" role="radiogroup" aria-label="Representante familiar">
            {representativeTypeOptions.map((option, index) => <label className={`public-pre-representative-option ${profile.representativeType === option.value ? "is-selected" : ""}`} key={option.value}>
              <input type="radio" name="representativeType" value={option.value} checked={profile.representativeType === option.value} onChange={() => selectRepresentativeType(option.value)} required={index === 0} />
              <span>{option.label === "Otro" ? "Otra persona" : option.label}</span>
            </label>)}
          </div>
          <p className="public-pre-representative-help">El representante debe proporcionar sus datos de identificación y contacto.</p>
        </section>

        <div className="public-pre-guardian-grid">
          <section className="public-pre-section">
            <h3>Madre</h3>
            <div className="public-pre-fields">
              {profile.representativeType === "MOTHER" ? <>{profileField("representativeFirstName", "Nombres", "text", true)}{profileField("representativeLastName", "Apellidos", "text", true)}</> : profileField("motherName", "Nombre completo")}
              {profileField("motherBirthDate", "Fecha de nacimiento", "text", profile.representativeType === "MOTHER")}
              {profileField("motherPhone", "Teléfono celular", "tel", profile.representativeType === "MOTHER")}
              {profileField("motherEmail", "Correo electrónico", "email", profile.representativeType === "MOTHER")}
              {profile.representativeType !== "MOTHER" && profileField("motherDpi", "DPI")}
              {profileField("motherOccupation", "Ocupación", "text", profile.representativeType === "MOTHER")}
              {profileField("motherWorkplace", "Lugar de trabajo", "text", profile.representativeType === "MOTHER")}
              {profileField("motherHomePhone", "Teléfono de casa", "tel", profile.representativeType === "MOTHER")}
              {profileField("motherOfficePhone", "Teléfono de oficina", "tel", profile.representativeType === "MOTHER")}
            </div>
            {profile.representativeType === "MOTHER" && <>
              <h4 className="public-pre-subheading">Datos del representante</h4>
              <div className="public-pre-fields">
                {profileField("representativeDocumentType", "Tipo de documento", "text", true)}
                {profileField("representativeDocument", "Número de documento", "text", true)}
                {profileField("representativeCivilStatus", "Estado civil", "text", true)}
                {profileField("representativeNationality", "Nacionalidad", "text", true)}
                {profileField("representativeResidence", "Dirección", "text", true)}
                {locationField("department", "Departamento", departmentOptions, true)}
                {locationField("city", "Municipio", municipalityOptions, true)}
              </div>
            </>}
          </section>

          <section className="public-pre-section">
            <h3>Padre</h3>
            <div className="public-pre-fields">
              {profile.representativeType === "FATHER" ? <>{profileField("representativeFirstName", "Nombres", "text", true)}{profileField("representativeLastName", "Apellidos", "text", true)}</> : profileField("fatherName", "Nombre completo")}
              {profileField("fatherBirthDate", "Fecha de nacimiento", "text", profile.representativeType === "FATHER")}
              {profileField("fatherPhone", "Teléfono celular", "tel", profile.representativeType === "FATHER")}
              {profileField("fatherEmail", "Correo electrónico", "email", profile.representativeType === "FATHER")}
              {profile.representativeType !== "FATHER" && profileField("fatherDpi", "DPI")}
              {profileField("fatherOccupation", "Ocupación", "text", profile.representativeType === "FATHER")}
              {profileField("fatherWorkplace", "Lugar de trabajo", "text", profile.representativeType === "FATHER")}
              {profileField("fatherHomePhone", "Teléfono de casa", "tel", profile.representativeType === "FATHER")}
              {profileField("fatherOfficePhone", "Teléfono de oficina", "tel", profile.representativeType === "FATHER")}
            </div>
            {profile.representativeType === "FATHER" && <>
              <h4 className="public-pre-subheading">Datos del representante</h4>
              <div className="public-pre-fields">
                {profileField("representativeDocumentType", "Tipo de documento", "text", true)}
                {profileField("representativeDocument", "Número de documento", "text", true)}
                {profileField("representativeCivilStatus", "Estado civil", "text", true)}
                {profileField("representativeNationality", "Nacionalidad", "text", true)}
                {profileField("representativeResidence", "Dirección", "text", true)}
                {locationField("department", "Departamento", departmentOptions, true)}
                {locationField("city", "Municipio", municipalityOptions, true)}
              </div>
            </>}
          </section>
        </div>

        {profile.representativeType === "OTHER" && <section className="public-pre-section">
          <h3>Datos del representante</h3>
          <div className="public-pre-fields">
            {profileField("representativeFirstName", "Nombres", "text", true)}
            {profileField("representativeLastName", "Apellidos", "text", true)}
            {profileField("representativeBirthDate", "Fecha de nacimiento", "text", true)}
            {profileField("representativeCivilStatus", "Estado civil", "text", true)}
            {profileField("representativeNationality", "Nacionalidad", "text", true)}
            {profileField("representativeDocumentType", "Tipo de documento", "text", true)}
            {profileField("representativeDocument", "Número de documento", "text", true)}
            {profileField("representativeEmail", "Correo electrónico", "email", true)}
            {profileField("representativeMobilePhone", "Teléfono celular", "tel", true)}
            {profileField("representativeOccupation", "Ocupación", "text", true)}
            {profileField("representativeWorkplace", "Lugar de trabajo", "text", true)}
            {profileField("representativeResidence", "Dirección", "text", true)}
            {locationField("department", "Departamento", departmentOptions, true)}
            {locationField("city", "Municipio", municipalityOptions, true)}
            {profileField("representativeHomePhone", "Teléfono de casa", "tel", true)}
            {profileField("representativeOfficePhone", "Teléfono de oficina", "tel", true)}
          </div>
        </section>}

        <section className="public-pre-section">
          <h3>Contactos para emergencias</h3>
          {emergencyContacts.map((contact, index) => <div className="public-pre-emergency-contact" key={`emergency-${index}`}>
            <div className="public-pre-fields">
              <label className="field-label public-pre-field"><span>Nombre completo del contacto <b className="public-pre-required" aria-hidden="true"> *</b></span><input value={contact.name} onChange={(event) => updateEmergencyContact(index, "name", event.target.value)} required /></label>
              <label className="field-label public-pre-field"><span>Teléfono <b className="public-pre-required" aria-hidden="true"> *</b></span><input type="tel" inputMode="numeric" placeholder="1234-5678" value={contact.phone} onChange={(event) => updateEmergencyContact(index, "phone", event.target.value)} required /></label>
              <label className="field-label public-pre-field"><span>Teléfono alternativo <small className="public-pre-optional">Opcional</small></span><input type="tel" inputMode="numeric" placeholder="1234-5678" value={contact.alternatePhone} onChange={(event) => updateEmergencyContact(index, "alternatePhone", event.target.value)} /></label>
            </div>
            {index > 0 && <button type="button" className="btn btn-secondary" onClick={() => removeEmergencyContact(index)}>Quitar contacto</button>}
          </div>)}
          <button type="button" className="btn btn-secondary" onClick={addEmergencyContact}>Añadir otro contacto</button>
        </section>

        <section className="public-pre-section public-pre-students-section">
          <div><h3>Alumnos de esta familia</h3><p>{entryType === "REINSCRIPTION" ? "Se cargan los alumnos de la familia y la respuesta más reciente de preinscripción. Marca quién continuará en 2027 y confirma su grado." : "Agrega a cada alumno y selecciona el grado al que ingresará en 2027."}</p></div>
          {entryType === "REINSCRIPTION" && !draft.studentId && <div className="student-search-block">
            <label className="field-label public-pre-field"><span>Buscar alumno existente</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, apellido o código escolar" /></label>
            <div className="student-search-results">{filteredCandidates.slice(0, 8).map((candidate) => {
              const nextGrade = candidate.currentGrade ? gradeOptions.find((grade) => grade.id === promotedGrade(candidate.currentGrade!, gradeOptions))?.name : candidate.proposedGrade;
              return <button type="button" key={candidate.id} className={selectedCandidateId === candidate.id ? "student-search-result selected" : "student-search-result"} onClick={() => { setError(""); setSelectedCandidateId(candidate.id); void importStudent(candidate.id); }}><span><strong>{candidate.firstName} {candidate.lastName}</strong><small>{candidate.currentGrade || "Grado actual por confirmar"} → {nextGrade || "Grado por definir"}</small></span><span className="status-pill success">Importar datos</span></button>;
            })}</div>
          </div>}
          {entryType === "REINSCRIPTION" && draft.studentId && <details className="student-extra-details"><summary>Buscar otra ficha histórica de este alumno</summary><div className="student-search-block"><label className="field-label public-pre-field"><span>Nombre o DPI consignado</span><input value={historicalSearch} onChange={(event) => setHistoricalSearch(event.target.value)} placeholder="Al menos tres caracteres" /></label><button type="button" className="btn btn-secondary" onClick={() => void searchHistoricalIntakes()}>Buscar ficha histórica</button></div></details>}
          {historicalIntakes.length > 0 && <div className="public-pre-student-list"><h4 className="public-pre-subheading">Fichas históricas disponibles</h4>{historicalIntakes.map((row) => <article className="public-pre-student" key={row.id}><div className="public-pre-student-top"><div><span className="public-pre-student-kicker">Ciclo {row.schoolYear}</span><strong>{row.firstName} {row.lastName}</strong></div><span className="public-pre-grade"><span>{row.sourceGrade || "Grado sin registrar"}</span></span></div><p className="public-pre-form-note">Fila {row.sourceRowId}{row.intakeDocumentNumber ? ` · DPI ${formatDpi(row.intakeDocumentNumber)}` : " · sin DPI válido"}</p><button type="button" className="btn btn-secondary" onClick={() => importHistoricalIntake(row)}>{row.matchedStudentId === draft.studentId ? "Completar datos faltantes" : "Vincular e importar"}</button></article>)}</div>}
          {students.length > 0 && <div className="public-pre-student-list">{students.map((student, index) => <article className="public-pre-student" key={student.key}>
            <div className="public-pre-student-top"><div><span className="public-pre-student-kicker">Alumno {index + 1}{student.imported ? " · datos importados" : ""}</span><strong>{student.firstName} {student.lastName}</strong></div>{entryType === "REINSCRIPTION" && <label className={`public-pre-enrollment-choice ${student.alreadyEnrolled ? "is-disabled" : ""}`}><input type="checkbox" checked={student.enroll} disabled={student.alreadyEnrolled} onChange={(event) => setStudents((current) => current.map((item) => item.key === student.key ? { ...item, enroll: event.target.checked } : item))} /><span>{student.alreadyEnrolled ? "Ya inscrito en 2027" : student.enroll ? "Inscribir en 2027" : "No inscribir"}</span></label>}<span className="public-pre-grade"><span>{student.currentGrade ? `${student.currentGrade} → ` : ""}{gradeOptions.find((grade) => grade.id === student.gradeId)?.name || "Grado pendiente"}</span></span></div>
            <div className="public-pre-fields">
              <label className="field-label public-pre-field"><span>Nombres <b className="public-pre-required" aria-hidden="true"> *</b></span><input value={student.firstName} onChange={(event) => setStudents((current) => current.map((item) => item.key === student.key ? { ...item, firstName: event.target.value } : item))} required={entryType !== "REINSCRIPTION" || student.enroll} /></label>
              <label className="field-label public-pre-field"><span>Apellidos <b className="public-pre-required" aria-hidden="true"> *</b></span><input value={student.lastName} onChange={(event) => setStudents((current) => current.map((item) => item.key === student.key ? { ...item, lastName: event.target.value } : item))} required={entryType !== "REINSCRIPTION" || student.enroll} /></label>
              <DatePartsField label="Fecha de nacimiento" value={student.birthDate || null} minYear={1900} maxYear={new Date().getFullYear()} order="day-month-year" required={entryType !== "REINSCRIPTION" || student.enroll} onChange={(value) => setStudents((current) => current.map((item) => item.key === student.key ? { ...item, birthDate: value ?? "" } : item))} />
              <label className="field-label public-pre-field"><span>Grado para 2027 <b className="public-pre-required" aria-hidden="true"> *</b></span><select value={student.gradeId || ""} onChange={(event) => setStudents((current) => current.map((item) => item.key === student.key ? { ...item, gradeId: Number(event.target.value) } : item))} required={entryType !== "REINSCRIPTION" || student.enroll}><option value="">Seleccione</option>{gradeOptions.map((grade) => <option value={grade.id} key={grade.id}>{grade.name}</option>)}</select></label>
            </div>
            {entryType !== "REINSCRIPTION" && <button type="button" className="btn btn-secondary" onClick={() => setStudents((current) => current.filter((item) => item.key !== student.key))}>Quitar alumno</button>}
          </article>)}</div>}
          {(entryType !== "REINSCRIPTION" || Boolean(draft.studentId || draft.firstName.trim() || draft.lastName.trim())) && <article className="public-pre-student admission-student-draft">
            <div className="public-pre-student-top"><div><span className="public-pre-student-kicker">Alumno {students.length + 1}{draft.imported ? " · datos importados" : ""}</span><strong>{`${draft.firstName} ${draft.lastName}`.trim() || "Nuevo alumno"}</strong></div><span className="public-pre-grade"><span>{draft.currentGrade ? `${draft.currentGrade} → ` : ""}{draft.gradeId ? draftGradeName : "Grado para 2027"}</span></span></div>
            <div className="public-pre-fields">
              <label className="field-label public-pre-field"><span>Nombres <b className="public-pre-required" aria-hidden="true"> *</b></span><input value={draft.firstName} onChange={(event) => setDraft((current) => ({ ...current, firstName: event.target.value }))} required /></label>
              <label className="field-label public-pre-field"><span>Apellidos <b className="public-pre-required" aria-hidden="true"> *</b></span><input value={draft.lastName} onChange={(event) => setDraft((current) => ({ ...current, lastName: event.target.value }))} required /></label>
              <DatePartsField label="Fecha de nacimiento" value={draft.birthDate || null} minYear={1900} maxYear={new Date().getFullYear()} order="day-month-year" required onChange={(value) => setDraft((current) => ({ ...current, birthDate: value ?? "" }))} />
              <label className="field-label public-pre-field"><span>Grado para 2027 <b className="public-pre-required" aria-hidden="true"> *</b></span><select value={draft.gradeId || ""} onChange={(event) => setDraft((current) => ({ ...current, gradeId: Number(event.target.value) }))} required><option value="">Seleccione</option>{gradeOptions.map((grade) => <option value={grade.id} key={grade.id}>{grade.name}{normalizeGrade(grade.name) === "quinto bachillerato" ? " · último grado" : ""}</option>)}</select></label>
            </div>
            {entryType === "REINSCRIPTION" && <p className="public-pre-form-note">Grado actual: {draft.currentGrade || "por confirmar"}. El sistema cargó la información disponible de la preinscripción y el ciclo anterior.</p>}
            <details className="student-extra-details"><summary>Datos adicionales del alumno (CUI y teléfono)</summary><div className="public-pre-fields">
              <label className="field-label public-pre-field"><span>CUI del alumno</span><input inputMode="numeric" maxLength={15} value={draft.studentDpi} onChange={(event) => setDraft((current) => ({ ...current, studentDpi: formatDpi(event.target.value) }))} /></label>
              <label className="field-label public-pre-field"><span>Teléfono de contacto</span><span className="phone-field"><SearchableSelect value={draft.phoneCountryCode ?? "GT"} options={countryCodes.map((item) => ({ value: item.countryCode, label: `${item.dialCode} · ${item.countryName}` }))} onChange={(value) => setDraft((current) => ({ ...current, phoneCountryCode: value }))} placeholder="Código de país" /><input type="tel" inputMode="numeric" maxLength={(countryCodes.find((item) => item.countryCode === draft.phoneCountryCode)?.phoneDigits ?? 8) + 1} value={draft.phone} onChange={(event) => { const country = countryCodes.find((item) => item.countryCode === draft.phoneCountryCode); setDraft((current) => ({ ...current, phone: formatPhone(event.target.value, country?.dialCode, country?.phoneDigits) })); }} /></span></label>
            </div></details>
            {draft.imported && <p className="public-pre-form-note admission-import-note"><AppIcon name="check" size={16} /> Datos del ciclo anterior importados; puedes actualizarlos antes de guardar.</p>}
          </article>}
          {(entryType !== "REINSCRIPTION" || Boolean(draft.studentId || draft.firstName.trim() || draft.lastName.trim())) && <button type="button" className="btn btn-secondary" onClick={queueStudentForContract}><AppIcon name="plus" size={17} /> Agregar otro alumno</button>}
        </section>

        {error && <p className="public-pre-error" role="alert">{error}</p>}
        <div className="public-pre-submit-area">
          <p className="public-pre-privacy">Al guardar, el colegio creará la inscripción del ciclo 2027 con los datos familiares y de cada alumno.</p>
          <button className="btn btn-primary public-pre-submit" type="submit" disabled={busy || !year}>{busy ? "Guardando…" : "Guardar inscripción"}</button>
        </div>
      </form>
    </div>
  </main>;
}
