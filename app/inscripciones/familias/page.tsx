import { redirect } from "next/navigation";
import { requireAdmissionsSession } from "@/lib/auth/session";
import { getAdmissionsOverview } from "@/lib/admissions/repository";
import { AdmissionsWorkspace } from "@/features/admissions/AdmissionsWorkspace";

export const dynamic = "force-dynamic";

export default async function ImportedFamiliesPage() {
  const token = await requireAdmissionsSession();
  const overview = await getAdmissionsOverview(token);
  if (overview.connection === "unauthorized") redirect("/login");
  return <AdmissionsWorkspace overview={overview} cleanEnrollmentEnabled />;
}
