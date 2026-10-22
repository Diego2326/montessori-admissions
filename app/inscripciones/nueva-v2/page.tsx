import { requireAdmissionsSession } from "@/lib/auth/session";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { OwnedEnrollmentFlow } from "@/features/admissions/OwnedEnrollmentFlow";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewOwnedEnrollmentPage() {
  if (process.env.ENROLLMENT_API_MODE !== "clean" || !process.env.ENROLLMENT_API_URL) notFound();
  await requireAdmissionsSession();
  return <WorkspaceShell current="Inscripciones"><OwnedEnrollmentFlow /></WorkspaceShell>;
}
