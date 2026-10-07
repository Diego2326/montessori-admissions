import { requireAdmissionsSession } from "@/lib/auth/session";
import { StationWorkspace } from "@/features/stations/StationWorkspace";
export const dynamic = "force-dynamic";
export default async function Page() { await requireAdmissionsSession(); return <StationWorkspace station="UNIFORMS" />; }
