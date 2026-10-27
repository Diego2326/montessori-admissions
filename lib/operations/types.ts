export type SchoolYear = { id: number; year: number; active: boolean };
export type Grade = { id: number; name: string };
export type Student = {
  id: number;
  studentUuid?: string | null;
  firstName: string;
  lastName: string;
  gradeId: number;
  gradeName: string;
  schoolYearId: number;
  familyName: string | null;
};
export type Bootstrap = {
  schoolYears: SchoolYear[];
  gradeLevels: Grade[];
  students: { id: number; firstName: string; lastName: string }[];
  courseOfferings?: {
    schoolYearId: number;
    gradeId: number | null;
    section: string | null;
    active: boolean;
  }[];
};
export type CountryCallingCode = { countryCode: string; countryName: string; dialCode: string; phoneDigits: number };
export type EnrollmentProfile = Record<
  string,
  string | number | null | undefined
>;
export type FamilySummary = {
  id: number;
  name: string;
  reviewStatus: string;
  activeStudents?: { firstName: string; lastName: string; currentGrade: string | null; studentId: number | null; linkSource?: string | null }[];
};
export type FamilyIntake = FamilySummary & { profile: EnrollmentProfile };
export type PreEnrollmentLink = {
  id: number;
  familyId: number;
  familyName: string;
  recipientType: string;
  recipientName: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  lastAccessAt?: string | null;
  responseSubmittedAt?: string | null;
  wantsEnroll?: boolean | null;
  status: string;
};
export type CreatedPreEnrollmentLink = Pick<PreEnrollmentLink, "id" | "familyId" | "familyName" | "recipientType" | "recipientName" | "createdAt" | "expiresAt"> & { url: string };
export type PreEnrollmentSubmission = {
  id: number;
  linkId: number;
  familyId: number;
  familyName: string;
  recipientType: string;
  recipientName: string;
  wantsEnroll: boolean;
  selectedStudentPublicIds: string[];
  submittedAt: string;
  profile: EnrollmentProfile;
  students: {
    publicId: string;
    firstName: string;
    lastName: string;
    birthDate: string | null;
    selected: boolean;
    currentGrade: string | null;
  }[];
};
export type PreEnrollmentSubmissionPage = {
  items: PreEnrollmentSubmission[];
  page: number;
  pageSize: number;
  total: number;
};
export type LegacyContractDetails = {
  contractId: number;
  representativeFirstName: string;
  representativeLastName: string;
  representativeAge: number | null;
  representativeCivilStatus: string | null;
  representativeNationality: string | null;
  representativeOccupation: string | null;
  representativeDocumentType: string | null;
  representativeDocument: string | null;
  representativeResidence: string | null;
  representativeHomePhone: string | null;
  representativeOfficePhone: string | null;
  representativeMobilePhone: string | null;
  studyPlan: string | null;
};
export type LegacyContractAssignment = {
  contractId: number;
  contractDate: string;
  sourceStudentId: number;
  studentName: string;
  sourceRepresentativeId: number;
  representativeName: string;
  matchedStudentId: number | null;
  matchStatus: string;
};
export type Enrollment = {
  id: number;
  studentId: number;
  studentUuid?: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  schoolYearId: number;
  schoolYear: number | null;
  gradeId: number;
  gradeName: string | null;
  section: string | null;
  status: string;
  profile: EnrollmentProfile | null;
};
export type Product = {
  id: number;
  station: "BOOKS" | "UNIFORMS";
  sku: string;
  name: string;
  gradeId: number | null;
  gradeName: string | null;
  size: string | null;
  unitPrice: string;
  stockQuantity: number;
  active: boolean;
};
export type BookPackageItem = {
  id: number;
  gradeId: number;
  productId: number;
  productName: string;
  quantity: number;
  active: boolean;
};
export type OrderItem = {
  id: number;
  productId: number;
  name: string;
  sku: string;
  size: string | null;
  quantity: number;
  reservedQuantity: number;
  preparedQuantity: number;
  pendingNote: string | null;
  deliveredQuantity: number;
  unitPrice: string;
  subtotal: string;
};
export type Order = {
  id: number;
  station: "BOOKS" | "UNIFORMS";
  studentId: number;
  studentName: string;
  schoolYearId: number | null;
  chargeId: number;
  chargeStatus: string;
  balance: string;
  status: string;
  version: number;
  total: string;
  notes: string | null;
  createdAt: string;
  items: OrderItem[];
};
export type CheckoutCharge = {
  id: number;
  studentId: number;
  studentName: string;
  familyId: number | null;
  familyName: string | null;
  description: string;
  amount: string;
  source: string;
};
export type ReceiptLine = {
  studentId: number;
  studentName: string;
  description: string;
  amount: string;
};
export type Receipt = {
  id: number;
  receiptNumber: string;
  documentKind: "RECEIPT" | "INVOICE";
  amount: string;
  method: string;
  externalReference: string | null;
  paidAt: string;
  lines: ReceiptLine[];
};
export const money = (value: string | number) =>
  `Q ${Number(value).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const studentName = (student: { firstName: string; lastName: string }) =>
  `${student.firstName} ${student.lastName}`.trim();
export const orderPending = (order: Order) =>
  order.items.some((item) => item.deliveredQuantity < item.quantity);
export const orderPrepared = (order: Order) =>
  order.items.every((item) => item.preparedQuantity >= item.quantity);
