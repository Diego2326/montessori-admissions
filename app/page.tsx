import { AdmissionsWorkspace } from "@/features/admissions/AdmissionsWorkspace";
import { getAdmissionsOverview } from "@/lib/admissions/repository";
import { redirect } from "next/navigation";
import { requireAdmissionsSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const token = await requireAdmissionsSession();
  const overview = await getAdmissionsOverview(token);
  if (overview.connection === "unauthorized") redirect("/login");
  return <AdmissionsWorkspace overview={overview} />;
}
