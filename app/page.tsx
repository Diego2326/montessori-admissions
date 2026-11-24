import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdmissionStartMenu } from "@/features/admissions/AdmissionStartMenu";
import { EnrollmentStatsDashboard } from "@/features/admissions/EnrollmentStatsDashboard";
import { GradeProgressionTables } from "@/features/admissions/GradeProgressionTables";
import { getAdmissionsOverview } from "@/lib/admissions/repository";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import type { StaffAccess } from "@/lib/auth/access";
import { firstStaffDestination, getStaffAccess } from "@/lib/auth/access";
import { requireAdmissionsSession } from "@/lib/auth/session";
import { getDemoOverview, isDemoMode } from "@/lib/operations/demo";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function Home() {
  let candidates: AdmissionCandidate[];
  let access: StaffAccess;
  let initialError = "";

  if (isDemoMode()) {
    access = await getStaffAccess("", true);
    if (!access.workflow) redirect(firstStaffDestination(access));
    candidates = getDemoOverview().candidates;
  } else {
    const token = await requireAdmissionsSession();
    const [nextAccess, overview] = await Promise.all([
      getStaffAccess(token),
      getAdmissionsOverview(token),
    ]);
    access = nextAccess;
    if (!access.workflow) redirect(firstStaffDestination(access));
    if (overview.connection === "unauthorized") redirect("/login");
    candidates = overview.candidates;
    if (overview.connection === "forbidden") {
      initialError = "No tienes permiso para consultar las admisiones.";
    } else if (overview.connection === "error" || overview.connection === "not_configured") {
      initialError = overview.error || "No se pudo cargar la información de admisiones.";
    }
  }

  return (
    <>
      <header className="admissions-brand-header">
        <div className="admissions-brand">
          <Image unoptimized src="/logo-colegio.png" width={46} height={46} alt="" />
          <span>
            <small>Colegio Bilingüe</small>
            <strong>Montessori</strong>
            <em>Zacapa</em>
          </span>
        </div>
        <div className="admissions-header-actions">
          {access.isAdmin && <Link className="admissions-admin-link" href="/administracion">Administración</Link>}
          <SignOutButton />
        </div>
      </header>
      <main className="admissions-home">
        <section className="admissions-start-card" aria-labelledby="admissions-title">
          <h1 id="admissions-title">Inscripciones</h1>
          <AdmissionStartMenu />
        </section>
        {access.isAdmin && <EnrollmentStatsDashboard />}
        <GradeProgressionTables initialCandidates={candidates} initialError={initialError} />
      </main>
    </>
  );
}
