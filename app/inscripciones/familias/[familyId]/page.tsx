import { redirect } from "next/navigation";
import { FamilyDataSheet } from "@/features/admissions/FamilyDataSheet";
import { firstStaffDestination, getStaffAccess } from "@/lib/auth/access";
import { requireAdmissionsSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/operations/demo";

export const dynamic = "force-dynamic";

export default async function FamilyDataSheetPage({ params }: { params: Promise<{ familyId: string }> }) {
  const { familyId: familyIdValue } = await params;
  const familyId = Number(familyIdValue);
  if (!Number.isSafeInteger(familyId) || familyId <= 0) redirect("/");

  if (isDemoMode()) {
    const access = await getStaffAccess("", true);
    if (!access.workflow) redirect(firstStaffDestination(access));
    return <FamilyDataSheet familyId={familyId} />;
  }

  const token = await requireAdmissionsSession();
  const access = await getStaffAccess(token);
  if (!access.workflow) redirect(firstStaffDestination(access));
  return <FamilyDataSheet familyId={familyId} />;
}
