import { requireAdmissionsSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/operations/demo";
import { StationWorkspace } from "@/features/stations/StationWorkspace";
export const dynamic = "force-dynamic";
export default async function Page({ searchParams }: { searchParams: Promise<{ studentUuid?: string }> }) { if (!isDemoMode()) await requireAdmissionsSession(); const params = await searchParams; return <StationWorkspace station="UNIFORMS" initialStudentUuid={params.studentUuid} />; }
