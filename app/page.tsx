import { AdmissionsWorkspace } from "@/features/admissions/AdmissionsWorkspace";
import { getAdmissionsOverview } from "@/lib/admissions/repository";
import { redirect } from "next/navigation";
import { requireAdmissionsSession } from "@/lib/auth/session";
import { getDemoOverview, isDemoMode } from "@/lib/operations/demo";
import { firstStaffDestination, getStaffAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ familyId?: string }> }) {
  const params = await searchParams;
  const initialFamilyId = Number(params.familyId) || null;
  if (isDemoMode()) {
    const access = await getStaffAccess("", true);
    return <AdmissionsWorkspace overview={getDemoOverview()} initialFamilyId={initialFamilyId} access={access} />;
  }
  const token = await requireAdmissionsSession();
  const access = await getStaffAccess(token);
  if (!access.workflow) redirect(firstStaffDestination(access));
  const overview = await getAdmissionsOverview(token);
  if (overview.connection === "unauthorized") redirect("/login");
  return <AdmissionsWorkspace overview={overview} initialFamilyId={initialFamilyId} access={access} />;
}
