import { AdmissionsWorkspace } from "@/features/admissions/AdmissionsWorkspace";
import { getAdmissionsOverview } from "@/lib/admissions/repository";
import { redirect } from "next/navigation";
import { requireAdmissionsSession } from "@/lib/auth/session";
import { getDemoOverview, isDemoMode } from "@/lib/operations/demo";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ familyId?: string }> }) {
  const params = await searchParams;
  const initialFamilyId = Number(params.familyId) || null;
  if (isDemoMode()) {
    return <AdmissionsWorkspace overview={getDemoOverview()} initialFamilyId={initialFamilyId} />;
  }
  const token = await requireAdmissionsSession();
  const overview = await getAdmissionsOverview(token);
  if (overview.connection === "unauthorized") redirect("/login");
  return <AdmissionsWorkspace overview={overview} initialFamilyId={initialFamilyId} cleanEnrollmentEnabled={process.env.ENROLLMENT_API_MODE === "clean" && !!process.env.ENROLLMENT_API_URL} />;
}
