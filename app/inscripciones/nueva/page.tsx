import { requireAdmissionsSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/operations/demo";
import { NewAdmissionFlow } from "@/features/admissions/NewAdmissionFlow";

export const dynamic = "force-dynamic";

type Search = Promise<{ familyId?: string; studentId?: string; mode?: string }>;

export default async function NewAdmissionPage({ searchParams }: { searchParams: Search }) {
  if (!isDemoMode()) await requireAdmissionsSession();
  const params = await searchParams;
  const mode = params.mode === "reinscription" ? "REINSCRIPTION" : params.mode === "new" ? "NEW_INCOME" : null;
  return <NewAdmissionFlow initialFamilyId={Number(params.familyId) || null} initialStudentId={Number(params.studentId) || null} initialMode={mode} />;
}
