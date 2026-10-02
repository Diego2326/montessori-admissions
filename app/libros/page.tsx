import { StationLanding } from "@/components/StationLanding";
import { requireAdmissionsSession } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export default async function Page() { await requireAdmissionsSession(); return <StationLanding station="Libros" />; }
