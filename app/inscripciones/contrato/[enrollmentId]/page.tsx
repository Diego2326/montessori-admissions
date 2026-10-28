import { redirect } from "next/navigation";
import { EnrollmentContractPreview } from "@/features/admissions/EnrollmentContractPreview";
import { firstStaffDestination, getStaffAccess } from "@/lib/auth/access";
import { requireAdmissionsSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/operations/demo";

export const dynamic = "force-dynamic";

export default async function EnrollmentContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ enrollmentId: string }>;
  searchParams: Promise<{ ids?: string; familyId?: string }>;
}) {
  const [{ enrollmentId: enrollmentValue }, query] = await Promise.all([params, searchParams]);
  const enrollmentId = Number(enrollmentValue);
  const enrollmentIds = [...new Set((query.ids ?? String(enrollmentId)).split(",").map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];
  if (!Number.isSafeInteger(enrollmentId) || enrollmentId <= 0 || enrollmentIds.length === 0 || !enrollmentIds.includes(enrollmentId)) redirect("/");
  const parsedFamilyId = Number(query.familyId);
  const familyId = Number.isSafeInteger(parsedFamilyId) && parsedFamilyId > 0 ? parsedFamilyId : null;

  if (isDemoMode()) {
    const access = await getStaffAccess("", true);
    if (!access.workflow) redirect(firstStaffDestination(access));
  } else {
    const token = await requireAdmissionsSession();
    const access = await getStaffAccess(token);
    if (!access.workflow) redirect(firstStaffDestination(access));
  }

  return <EnrollmentContractPreview enrollmentIds={enrollmentIds} initialEnrollmentId={enrollmentId} familyId={familyId} />;
}
