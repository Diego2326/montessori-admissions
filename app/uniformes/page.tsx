import { requireAdmissionsSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/operations/demo";
import { StationWorkspace } from "@/features/stations/StationWorkspace";
import { firstStaffDestination, getStaffAccess } from "@/lib/auth/access";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ studentUuid?: string }> }) {
  const demo = isDemoMode();
  const access = demo ? await getStaffAccess("", true) : await getStaffAccess(await requireAdmissionsSession());
  if (!access.sales) redirect(firstStaffDestination(access));
  const params = await searchParams;
  return <StationWorkspace station="UNIFORMS" initialStudentUuid={params.studentUuid} access={access} />;
}
