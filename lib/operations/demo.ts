import type { AdmissionCandidate, AdmissionsOverview } from "@/lib/admissions/types";
import type {
  Bootstrap, BookPackageItem, Enrollment, EnrollmentProfile, FamilyIntake,
  CheckoutCharge, FamilySummary, LegacyContractAssignment, Order, Product,
  PreEnrollmentSubmissionPage, Receipt, Student,
} from "@/lib/operations/types";

export function isDemoMode() {
  return process.env.NEXT_PUBLIC_ADMISSIONS_DEMO_MODE === "true";
}

const demoCandidates: AdmissionCandidate[] = [
  { id: 101, firstName: "Sofía", lastName: "Méndez López", currentGrade: "Preparatoria", proposedGrade: "Primero primaria", familyId: 1, familyName: "Méndez López", familyReviewStatus: "PENDING", representativeName: "Andrea López", historicalContracts: 1, status: "PROMOTION" },
  { id: 102, firstName: "Mateo", lastName: "Méndez López", currentGrade: "Segundo primaria", proposedGrade: "Tercero primaria", familyId: 1, familyName: "Méndez López", familyReviewStatus: "PENDING", representativeName: "Andrea López", historicalContracts: 1, status: "PROMOTION" },
  { id: 103, firstName: "Valentina", lastName: "Ruiz Castillo", currentGrade: "Primero primaria", proposedGrade: "Segundo primaria", familyId: 2, familyName: "Ruiz Castillo", familyReviewStatus: "REVIEWED", representativeName: "Carlos Ruiz", historicalContracts: 1, status: "PROMOTION" },
  { id: 104, firstName: "Sebastián", lastName: "Morales Díaz", currentGrade: "Sexto primaria", proposedGrade: "Primero básico", familyId: 3, familyName: "Morales Díaz", familyReviewStatus: "PENDING", representativeName: "Lucía Díaz", historicalContracts: 1, status: "PROMOTION" },
  { id: 105, firstName: "Camila", lastName: "Pérez García", currentGrade: null, proposedGrade: "Primero primaria", familyId: null, familyName: null, familyReviewStatus: null, representativeName: null, historicalContracts: 0, status: "REVIEW" },
  { id: 106, firstName: "Diego", lastName: "Herrera Soto", currentGrade: null, proposedGrade: "Kinder", familyId: null, familyName: null, familyReviewStatus: null, representativeName: null, historicalContracts: 0, status: "REVIEW" },
];

const familyProfiles = new Map<number, EnrollmentProfile>([
  [1, { address: "Colonia Los Álamos, Zacapa", city: "Zacapa", motherName: "Andrea López", motherPhone: "5555-0101", motherEmail: "andrea.demo@example.com", fatherName: "Javier Méndez", fatherPhone: "5555-0102", emergencyContactName: "María López", emergencyContactPhone: "5555-0103", representativeType: "MOTHER", representativeFirstName: "Andrea", representativeLastName: "López", representativeDocumentType: "DPI", representativeDocument: "0000 00000 0000", representativeNationality: "Guatemalteca", representativeCivilStatus: "Casado" }],
  [2, { address: "Barrio El Centro, Zacapa", city: "Zacapa", motherName: "Patricia Castillo", motherPhone: "5555-0201", fatherName: "Carlos Ruiz", fatherPhone: "5555-0202", representativeType: "FATHER", representativeFirstName: "Carlos", representativeLastName: "Ruiz", representativeDocumentType: "DPI", representativeNationality: "Guatemalteca" }],
  [3, { address: "Aldea La Fragua, Zacapa", city: "Zacapa", motherName: "Lucía Díaz", motherPhone: "5555-0301", fatherName: "Roberto Morales", representativeType: "MOTHER", representativeFirstName: "Lucía", representativeLastName: "Díaz", representativeDocumentType: "DPI", representativeNationality: "Guatemalteca" }],
]);

let families: FamilySummary[] = [
  { id: 1, name: "Méndez López", reviewStatus: "PENDING" },
  { id: 2, name: "Ruiz Castillo", reviewStatus: "REVIEWED" },
  { id: 3, name: "Morales Díaz", reviewStatus: "PENDING" },
];
let enrollments: Enrollment[] = [
  { id: 401, studentId: 101, studentFirstName: "Sofía", studentLastName: "Méndez López", schoolYearId: 2026, schoolYear: 2026, gradeId: 2, gradeName: "Preparatoria", section: "A", status: "ACTIVO", profile: { ...familyProfiles.get(1), birthDate: "2019-04-12", studentDpi: "0000 00000 0000", studentPhone: "5555-0104", representativeAge: 36, representativeOccupation: "Comerciante" } },
  { id: 402, studentId: 102, studentFirstName: "Mateo", studentLastName: "Méndez López", schoolYearId: 2026, schoolYear: 2026, gradeId: 4, gradeName: "Segundo primaria", section: "B", status: "ACTIVO", profile: { ...familyProfiles.get(1), birthDate: "2017-09-02", studentDpi: "0000 00000 0001", studentPhone: "5555-0105" } },
  { id: 403, studentId: 103, studentFirstName: "Valentina", studentLastName: "Ruiz Castillo", schoolYearId: 2026, schoolYear: 2026, gradeId: 3, gradeName: "Primero primaria", section: "A", status: "ACTIVO", profile: { ...familyProfiles.get(2), birthDate: "2018-11-20", studentDpi: "0000 00000 0002" } },
  { id: 404, studentId: 104, studentFirstName: "Sebastián", studentLastName: "Morales Díaz", schoolYearId: 2026, schoolYear: 2026, gradeId: 8, gradeName: "Sexto primaria", section: "A", status: "ACTIVO", profile: { ...familyProfiles.get(3), birthDate: "2013-02-15", studentDpi: "0000 00000 0003" } },
  { id: 501, studentId: 101, studentFirstName: "Sofía", studentLastName: "Méndez López", schoolYearId: 2027, schoolYear: 2027, gradeId: 3, gradeName: "Primero primaria", section: "A", status: "ACTIVO", profile: { ...familyProfiles.get(1), birthDate: "2019-04-12", representativeType: "MOTHER", enrollmentFee: "450", monthlyFee: "650" } },
  { id: 502, studentId: 102, studentFirstName: "Mateo", studentLastName: "Méndez López", schoolYearId: 2027, schoolYear: 2027, gradeId: 5, gradeName: "Tercero primaria", section: "B", status: "PENDIENTE_FIRMA", profile: { ...familyProfiles.get(1), birthDate: "2017-09-02", enrollmentFee: "450", monthlyFee: "700" } },
  { id: 503, studentId: 103, studentFirstName: "Valentina", studentLastName: "Ruiz Castillo", schoolYearId: 2027, schoolYear: 2027, gradeId: 4, gradeName: "Segundo primaria", section: "A", status: "ACTIVO", profile: { ...familyProfiles.get(2), birthDate: "2018-11-20", enrollmentFee: "450", monthlyFee: "650" } },
];

const gradeLevels = ["Kinder", "Preparatoria", "Primero primaria", "Segundo primaria", "Tercero primaria", "Cuarto primaria", "Quinto primaria", "Sexto primaria", "Primero básico", "Segundo básico", "Tercero básico", "Cuarto bachillerato", "Quinto bachillerato"].map((name, index) => ({ id: index + 1, name }));
const products: Product[] = [
  { id: 1, station: "BOOKS", sku: "LIB-PRI-01", name: "Paquete de libros · Primaria", gradeId: 3, gradeName: "Segundo primaria", size: null, unitPrice: "875.00", stockQuantity: 35, active: true },
  { id: 2, station: "BOOKS", sku: "LIB-PRI-02", name: "Cuaderno de trabajo", gradeId: 3, gradeName: "Segundo primaria", size: null, unitPrice: "125.00", stockQuantity: 40, active: true },
  { id: 3, station: "UNIFORMS", sku: "UNI-POLO-8", name: "Polo institucional", gradeId: null, gradeName: null, size: "8", unitPrice: "135.00", stockQuantity: 12, active: true },
  { id: 4, station: "UNIFORMS", sku: "UNI-SUD-10", name: "Sudadero", gradeId: null, gradeName: null, size: "10", unitPrice: "220.00", stockQuantity: 8, active: true },
];
let orders: Order[] = [
  { id: 31, station: "BOOKS", studentId: 102, studentName: "Mateo Méndez López", schoolYearId: 2027, chargeId: 9001, chargeStatus: "PENDING", balance: "875.00", status: "PENDING", version: 1, total: "875.00", notes: "", createdAt: "2026-10-19T15:00:00Z", items: [{ id: 31, productId: 1, name: "Paquete de libros · Primaria", sku: "LIB-PRI-01", size: null, quantity: 1, reservedQuantity: 1, preparedQuantity: 0, pendingNote: null, deliveredQuantity: 0, unitPrice: "875.00", subtotal: "875.00" }] },
  { id: 32, station: "UNIFORMS", studentId: 101, studentName: "Sofía Méndez López", schoolYearId: 2027, chargeId: 9002, chargeStatus: "PAID", balance: "0.00", status: "PENDING", version: 1, total: "355.00", notes: "", createdAt: "2026-10-18T15:00:00Z", items: [{ id: 32, productId: 3, name: "Polo institucional", sku: "UNI-POLO-8", size: "8", quantity: 1, reservedQuantity: 1, preparedQuantity: 1, pendingNote: null, deliveredQuantity: 0, unitPrice: "135.00", subtotal: "135.00" }, { id: 33, productId: 4, name: "Sudadero", sku: "UNI-SUD-10", size: "10", quantity: 1, reservedQuantity: 1, preparedQuantity: 1, pendingNote: null, deliveredQuantity: 0, unitPrice: "220.00", subtotal: "220.00" }] },
];
let charges: CheckoutCharge[] = [
  { id: 9001, studentId: 102, studentName: "Mateo Méndez López", familyId: 1, familyName: "Méndez López", description: "Paquete de libros", amount: "875.00", source: "BOOKS" },
  { id: 9003, studentId: 102, studentName: "Mateo Méndez López", familyId: 1, familyName: "Méndez López", description: "Cuota de inscripción", amount: "450.00", source: "ENROLLMENT" },
  { id: 9004, studentId: 101, studentName: "Sofía Méndez López", familyId: 1, familyName: "Méndez López", description: "Cuota de inscripción", amount: "450.00", source: "ENROLLMENT" },
  { id: 9005, studentId: 104, studentName: "Sebastián Morales Díaz", familyId: 3, familyName: "Morales Díaz", description: "Cuota de inscripción", amount: "450.00", source: "ENROLLMENT" },
];
let receipts: Receipt[] = [{ id: 41, receiptNumber: "REC-DEMO-0041", documentKind: "RECEIPT", amount: "450.00", method: "TRANSFER", externalReference: "DEMO-1029", paidAt: "2026-10-17T17:20:00Z", lines: [{ studentId: 103, studentName: "Valentina Ruiz Castillo", description: "Cuota de inscripción", amount: "450.00" }] }];
let nextFamilyId = 4;
let nextEnrollmentId = 504;
let nextOrderId = 1;

export function getDemoOverview(): AdmissionsOverview {
  return { connection: "connected", candidates: demoCandidates };
}

function familyDetail(id: number): FamilyIntake | undefined {
  const family = families.find((item) => item.id === id);
  return family ? { ...family, profile: familyProfiles.get(id) ?? {} } : undefined;
}

function json<T>(value: T): T {
  return structuredClone(value);
}

export function demoOperation<T>(path: string): T {
  const route = path.replace(/^\//, "").split("?")[0];
  const query = new URLSearchParams(path.split("?")[1] ?? "");
  if (route === "country-codes") return json([
    ["GT", "Guatemala", "+502", 8], ["SV", "El Salvador", "+503", 8], ["HN", "Honduras", "+504", 8], ["NI", "Nicaragua", "+505", 8], ["CR", "Costa Rica", "+506", 8], ["PA", "Panamá", "+507", 8], ["BZ", "Belice", "+501", 7], ["MX", "México", "+52", 10], ["US", "Estados Unidos", "+1", 10], ["CA", "Canadá", "+1", 10], ["CO", "Colombia", "+57", 10], ["ES", "España", "+34", 9], ["GB", "Reino Unido", "+44", 10], ["BR", "Brasil", "+55", 11], ["AR", "Argentina", "+54", 10], ["CL", "Chile", "+56", 9], ["PE", "Perú", "+51", 9], ["FR", "Francia", "+33", 9], ["DE", "Alemania", "+49", 10], ["IT", "Italia", "+39", 10], ["JP", "Japón", "+81", 10], ["IN", "India", "+91", 10], ["AU", "Australia", "+61", 9], ["ZA", "Sudáfrica", "+27", 9],
  ].map(([countryCode, countryName, dialCode, phoneDigits]) => ({ countryCode, countryName, dialCode, phoneDigits }))) as T;
  if (route === "enrollments/bootstrap") return json({
    schoolYears: [{ id: 2027, year: 2027, active: true }], gradeLevels,
    students: demoCandidates.map(({ id, firstName, lastName }) => ({ id, firstName, lastName })),
    courseOfferings: gradeLevels.flatMap((grade) => ["A", "B"].map((section) => ({ schoolYearId: 2027, gradeId: grade.id, section, active: true }))),
  } satisfies Bootstrap) as T;
  if (route === "school-years") return json([{ id: 2027, year: 2027, active: true }]) as T;
  if (route === "admission-workflow/2027/overview") return json({ candidates: demoCandidates }) as T;
  if (route === "admission-workflow/families") return json(families) as T;
  if (route === "admission-workflow/pre-enrollment-responses") {
    const submissions: PreEnrollmentSubmissionPage["items"] = [{
      id: 701,
      linkId: 601,
      familyId: 1,
      familyName: "Méndez López",
      recipientType: "MOTHER",
      recipientName: "Andrea López",
      wantsEnroll: true,
      selectedStudentPublicIds: ["demo-student-101", "demo-student-102"],
      submittedAt: "2026-10-20T15:30:00Z",
      profile: {},
      students: [
        { publicId: "demo-student-101", firstName: "Sofía", lastName: "Méndez López", birthDate: null, selected: true, currentGrade: "Preparatoria" },
        { publicId: "demo-student-102", firstName: "Mateo", lastName: "Méndez López", birthDate: null, selected: true, currentGrade: "Segundo primaria" },
      ],
    }];
    const page = Math.max(1, Number(query.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.get("pageSize")) || 20));
    const start = (page - 1) * pageSize;
    return json({ items: submissions.slice(start, start + pageSize), page, pageSize, total: submissions.length } satisfies PreEnrollmentSubmissionPage) as T;
  }
  if (route === "admission-workflow/legacy-contracts") return json([
    { contractId: 81, contractDate: "2026-01-08", sourceStudentId: 101, studentName: "Sofía Méndez López", sourceRepresentativeId: 15, representativeName: "Andrea López", matchedStudentId: 101, matchStatus: "MATCHED" },
    { contractId: 82, contractDate: "2026-01-08", sourceStudentId: 102, studentName: "Mateo Méndez López", sourceRepresentativeId: 15, representativeName: "Andrea López", matchedStudentId: 102, matchStatus: "MATCHED" },
  ] satisfies LegacyContractAssignment[]) as T;
  if (route.startsWith("admission-workflow/families/")) {
    const idText = route.split("/")[2];
    const result = familyDetail(Number(idText));
    if (result) return json(result) as T;
  }
  if (route.startsWith("admission-workflow/students/") && route.endsWith("/legacy-contract")) {
    const studentId = Number(route.split("/")[2]);
    const student = demoCandidates.find((item) => item.id === studentId);
    const [firstName = "", ...lastName] = (student?.representativeName ?? "Representante Demo").split(" ");
    return json({ contractId: 80 + studentId, representativeFirstName: firstName, representativeLastName: lastName.join(" "), representativeAge: 35, representativeCivilStatus: "Casado", representativeNationality: "Guatemalteca", representativeOccupation: "Comerciante", representativeDocumentType: "DPI", representativeDocument: "0000 00000 0000", representativeResidence: "Zacapa", representativeHomePhone: null, representativeOfficePhone: null, representativeMobilePhone: "5555-0000", studyPlan: "DIARIO" }) as T;
  }
  if (route.startsWith("admission-workflow/students/") && route.endsWith("/historical-intakes")) {
    const studentId = Number(route.split("/")[2]);
    const student = demoCandidates.find((item) => item.id === studentId);
    return json(student && studentId === 104 ? [{ id: 1, sourceRowId: 12, schoolYear: 2026, firstName: student.firstName, lastName: student.lastName, birthDate: "2014-04-12", intakeDocumentNumber: null, sourceGrade: "Sexto primaria", motherName: "Lucía Díaz", motherWorkplace: "Comercio local", motherMobile: "5555-0301", motherDpi: null, fatherName: "Roberto Morales", fatherOccupation: "Comerciante", fatherWorkplace: "Comercio local", fatherMobile: "5555-0302", address: "Aldea La Fragua, Zacapa", city: "Zacapa", otherContact: null, contactMobile: "5555-0303", attendedBy: null, matchedStudentId: null }] : []) as T;
  }
  if (route === "enrollments") {
    const yearId = Number(query.get("schoolYearId"));
    return json(yearId ? enrollments.filter((item) => item.schoolYearId === yearId) : enrollments) as T;
  }
  if (/^students\/\d+\/enrollments$/.test(route)) return json(enrollments.filter((item) => item.studentId === Number(route.split("/")[1]))) as T;
  if (/^admission-stations\/(BOOKS|UNIFORMS)\/products$/.test(route)) return json(products.filter((item) => item.station === route.split("/")[1])) as T;
  if (/^admission-stations\/book-package\/\d+$/.test(route)) {
    const gradeId = Number(route.split("/").at(-1));
    const matching = products.filter((item) => item.station === "BOOKS" && item.gradeId === gradeId);
    return json(matching.map((item, index) => ({ id: item.id, gradeId, productId: item.id, productName: item.name, quantity: index + 1, active: true } satisfies BookPackageItem))) as T;
  }
  if (/^admission-stations\/(BOOKS|UNIFORMS)\/orders$/.test(route)) return json(orders.filter((item) => item.station === route.split("/")[1])) as T;
  if (route === "admission-stations/students") return json(demoCandidates.map((candidate): Student => {
    const enrollment = enrollments.find((item) => item.studentId === candidate.id);
    const grade = gradeLevels.find((item) => item.name === (enrollment?.gradeName ?? candidate.proposedGrade));
    return { id: candidate.id, firstName: candidate.firstName, lastName: candidate.lastName, gradeId: grade?.id ?? 1, gradeName: grade?.name ?? "Kinder", schoolYearId: 2027, familyName: candidate.familyName };
  })) as T;
  if (route === "admission-checkout/charges") return json(charges) as T;
  if (route === "admission-checkout/receipts") return json(receipts) as T;
  throw new Error(`Ruta no disponible en modo demo: ${route}`);
}

export function demoSave<T>(path: string, body: unknown, method: "POST" | "PUT" = "POST"): T {
  const route = path.replace(/^\//, "").split("?")[0];
  const data = (body ?? {}) as Record<string, unknown>;
  if (route === "admission-workflow/intakes") {
    const requestedStudents = Array.isArray(data.students) ? data.students as { enrollment: Record<string, unknown>; historicalIntakeId?: number | null }[] : [];
    if (!requestedStudents.length) throw new Error("Agrega al menos un alumno.");
    for (const student of requestedStudents) {
      const id = Number(student.enrollment.studentId);
      if (id && enrollments.some((item) => item.studentId === id && item.schoolYear === 2027)) throw new Error("El alumno ya tiene inscripción para 2027.");
    }
    const existingId = Number(data.familyId) || null;
    const family = existingId ? demoSave<FamilyIntake>(`admission-workflow/families/${existingId}`, { name: data.familyName, profile: data.profile }, "PUT")
      : demoSave<FamilyIntake>("admission-workflow/families", { name: data.familyName });
    if (!existingId) demoSave<FamilyIntake>(`admission-workflow/families/${family.id}`, { name: data.familyName, profile: data.profile }, "PUT");
    const savedEnrollments = requestedStudents.map((student) => demoSave<Enrollment>("enrollments", { ...student.enrollment, familyId: family.id }));
    return json({ family: familyDetail(family.id), enrollments: savedEnrollments }) as T;
  }
  if (/^admission-workflow\/students\/\d+\/historical-intakes\/\d+\/confirm$/.test(route)) return json({ confirmed: true }) as T;
  if (route === "admission-workflow/families" && method === "POST") {
    const family: FamilySummary = { id: nextFamilyId++, name: String(data.name ?? "Nueva familia"), reviewStatus: "PENDING" };
    families = [family, ...families];
    familyProfiles.set(family.id, {});
    if (typeof data.studentId === "number" && data.studentId > 0) {
      const student = demoCandidates.find((item) => item.id === data.studentId);
      if (student) { student.familyId = family.id; student.familyName = family.name; }
    }
    return json(familyDetail(family.id)) as T;
  }
  const familyEdit = route.match(/^admission-workflow\/families\/(\d+)$/);
  if (familyEdit && method === "PUT") {
    const id = Number(familyEdit[1]);
    const family = families.find((item) => item.id === id);
    if (!family) throw new Error("Familia demo no encontrada");
    family.name = String(data.name ?? family.name);
    family.reviewStatus = "REVIEWED";
    familyProfiles.set(id, json((data.profile ?? {}) as EnrollmentProfile));
    demoCandidates.filter((item) => item.familyId === id).forEach((item) => { item.familyName = family.name; });
    return json(familyDetail(id)) as T;
  }
  const attach = route.match(/^admission-workflow\/families\/(\d+)\/students\/(\d+)$/);
  if (attach) {
    const family = families.find((item) => item.id === Number(attach[1]));
    const student = demoCandidates.find((item) => item.id === Number(attach[2]));
    if (!family || !student) throw new Error("Familia o alumno demo no encontrado");
    student.familyId = family.id; student.familyName = family.name;
    return undefined as T;
  }
  if (route === "enrollments" || /^enrollments\/\d+$/.test(route)) {
    const existingId = route === "enrollments" ? null : Number(route.split("/")[1]);
    const studentId = typeof data.studentId === "number" ? data.studentId : -(nextEnrollmentId);
    const grade = gradeLevels.find((item) => item.id === Number(data.gradeId));
    const candidate = demoCandidates.find((item) => item.id === studentId);
    const enrollment: Enrollment = {
      id: existingId ?? nextEnrollmentId++, studentId,
      studentFirstName: String(data.firstName ?? candidate?.firstName ?? "Nuevo"),
      studentLastName: String(data.lastName ?? candidate?.lastName ?? "Alumno"),
      schoolYearId: Number(data.schoolYearId ?? 2027), schoolYear: 2027,
      gradeId: Number(data.gradeId), gradeName: grade?.name ?? null,
      section: data.section ? String(data.section) : null,
      status: String(data.status ?? "PENDIENTE_FIRMA"), profile: json((data.profile ?? {}) as EnrollmentProfile),
    };
    const index = enrollments.findIndex((item) => item.id === enrollment.id || (item.studentId === enrollment.studentId && item.schoolYearId === enrollment.schoolYearId));
    if (index >= 0) enrollments[index] = enrollment; else enrollments = [enrollment, ...enrollments];
    const linkedCandidate: AdmissionCandidate = candidate ?? { id: studentId, firstName: enrollment.studentFirstName ?? "Nuevo", lastName: enrollment.studentLastName ?? "Alumno", currentGrade: null, proposedGrade: enrollment.gradeName, familyId: null, familyName: null, familyReviewStatus: null, representativeName: String(enrollment.profile?.representativeName ?? "") || null, historicalContracts: 0, status: "REVIEW" };
    if (!candidate) demoCandidates.unshift(linkedCandidate);
    const familyId = typeof data.familyId === "number" ? data.familyId : linkedCandidate.familyId;
    if (familyId) {
      const family = families.find((item) => item.id === familyId);
      if (family) { linkedCandidate.familyId = familyId; linkedCandidate.familyName = family.name; }
    }
    return json(enrollment) as T;
  }
  if (/^admission-stations\/(BOOKS|UNIFORMS)\/orders$/.test(route)) {
    const station = route.split("/")[1] as "BOOKS" | "UNIFORMS";
    const student = demoCandidates.find((item) => item.id === Number(data.studentId));
    const items = Array.isArray(data.items) ? data.items as { productId: number; quantity: number }[] : [];
    const order: Order = { id: nextOrderId++, station, studentId: Number(data.studentId), studentName: student ? `${student.firstName} ${student.lastName}` : "Alumno demo", schoolYearId: 2027, chargeId: nextOrderId, chargeStatus: "PENDIENTE", balance: "0.00", status: "PENDING", version: 1, total: "0.00", notes: null, createdAt: new Date().toISOString(), items: items.map((item) => { const product = products.find((row) => row.id === item.productId)!; const subtotal = Number(product?.unitPrice ?? 0) * item.quantity; return { id: item.productId, productId: item.productId, name: product?.name ?? "Producto demo", sku: product?.sku ?? "DEMO", size: product?.size ?? null, quantity: item.quantity, reservedQuantity: item.quantity, preparedQuantity: 0, pendingNote: null, deliveredQuantity: 0, unitPrice: product?.unitPrice ?? "0.00", subtotal: subtotal.toFixed(2) }; }) };
    order.total = order.items.reduce((sum, item) => sum + Number(item.subtotal), 0).toFixed(2);
    orders = [order, ...orders];
    return json(order) as T;
  }
  if (route === "admission-checkout/pay") {
    const studentIds = Array.isArray(data.studentIds) ? data.studentIds as number[] : [];
    const paidLines = charges.filter((item) => studentIds.includes(item.studentId));
    const amount = paidLines.reduce((sum, item) => sum + Number(item.amount), 0);
    const receipt: Receipt = { id: Date.now(), receiptNumber: `REC-DEMO-${String(receipts.length + 42).padStart(4, "0")}`, documentKind: "RECEIPT", amount: amount.toFixed(2), method: String(data.method ?? "CASH"), externalReference: typeof data.externalReference === "string" ? data.externalReference : null, paidAt: new Date().toISOString(), lines: paidLines.map((item) => ({ studentId: item.studentId, studentName: item.studentName, description: item.description, amount: item.amount })) };
    receipts = [receipt, ...receipts];
    const paidChargeIds = new Set(paidLines.map((item) => item.id));
    charges = charges.filter((item) => !paidChargeIds.has(item.id));
    orders.forEach((order) => { if (studentIds.includes(order.studentId) && order.chargeStatus !== "PAID") { order.chargeStatus = "PAID"; order.balance = "0.00"; } });
    return json(receipt) as T;
  }
  const orderAction = route.match(/^admission-stations\/(BOOKS|UNIFORMS)\/orders\/(\d+)\/(prepare|deliver)$/);
  if (orderAction) {
    const order = orders.find((item) => item.id === Number(orderAction[2]));
    if (!order) throw new Error("Orden demo no encontrada");
    const rows = Array.isArray(data.items) ? data.items as { itemId: number; quantity: number; pendingNote?: string | null }[] : [];
    rows.forEach((row) => {
      const item = order.items.find((candidate) => candidate.id === row.itemId);
      if (!item) return;
      if (orderAction[3] === "prepare") { item.preparedQuantity = row.quantity; item.pendingNote = row.pendingNote ?? null; }
      else item.deliveredQuantity = Math.min(item.preparedQuantity, item.deliveredQuantity + row.quantity);
    });
    order.version += 1;
    return json(order) as T;
  }
  throw new Error(`Guardado no disponible en modo demo: ${route}`);
}
