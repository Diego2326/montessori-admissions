import { redirect } from "next/navigation";
import { requireAdmissionsSession } from "@/lib/auth/session";
import { getAdmissionsOverview } from "@/lib/admissions/repository";
import { AdmissionsWorkspace } from "@/features/admissions/AdmissionsWorkspace";
import { firstStaffDestination, getStaffAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export default async function ImportedFamiliesPage() {
  const token = await requireAdmissionsSession();
  const access = await getStaffAccess(token);
  if (!access.workflow) redirect(firstStaffDestination(access));
  const overview = await getAdmissionsOverview(token);
  if (overview.connection === "unauthorized") redirect("/login");
  return <AdmissionsWorkspace overview={overview} access={access} />;
}
