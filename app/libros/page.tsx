import { requireAdmissionsSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/operations/demo";
import { StationWorkspace } from "@/features/stations/StationWorkspace";
export const dynamic = "force-dynamic";
export default async function Page() { if (!isDemoMode()) await requireAdmissionsSession(); return <StationWorkspace station="BOOKS" />; }
