import { redirect } from "next/navigation";
import { NewAdmissionFlow } from "@/features/admissions/NewAdmissionFlow";
import { firstStaffDestination, getStaffAccess } from "@/lib/auth/access";
import { requireAdmissionsSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/operations/demo";

export const dynamic = "force-dynamic";

export default async function StartStudentReEnrollmentPage({ params }: { params: Promise<{ studentId: string }> }) {
  if (!isDemoMode()) {
    const token = await requireAdmissionsSession();
    const access = await getStaffAccess(token);
    if (!access.admissions || !access.enrollments) redirect(firstStaffDestination(access));
  }

  const { studentId } = await params;
  const id = Number(studentId);
  if (!Number.isSafeInteger(id) || id <= 0) redirect("/inscripciones/reinscripcion");

  return <NewAdmissionFlow initialStudentId={id} initialMode="REINSCRIPTION" />;
}
