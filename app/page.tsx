import Image from "next/image";
import { redirect } from "next/navigation";
import { AdmissionStartMenu } from "@/features/admissions/AdmissionStartMenu";
import { GradeProgressionTables } from "@/features/admissions/GradeProgressionTables";
import { getAdmissionsOverview } from "@/lib/admissions/repository";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import { firstStaffDestination, getStaffAccess } from "@/lib/auth/access";
import { requireAdmissionsSession } from "@/lib/auth/session";
import { getDemoOverview, isDemoMode } from "@/lib/operations/demo";

export const dynamic = "force-dynamic";

export default async function Home() {
  let candidates: AdmissionCandidate[];
  let initialError = "";

  if (isDemoMode()) {
    const access = await getStaffAccess("", true);
    if (!access.workflow) redirect(firstStaffDestination(access));
    candidates = getDemoOverview().candidates;
  } else {
    const token = await requireAdmissionsSession();
    const access = await getStaffAccess(token);
    if (!access.workflow) redirect(firstStaffDestination(access));
    const overview = await getAdmissionsOverview(token);
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
          <Image
            unoptimized
            src="/logo-colegio.png"
            width={46}
            height={46}
            alt=""
          />
          <span>
            <small>Colegio Bilingüe</small>
            <strong>Montessori</strong>
            <em>Zacapa</em>
          </span>
        </div>
      </header>
      <main className="admissions-home">
        <section className="admissions-start-card" aria-labelledby="admissions-title">
          <h1 id="admissions-title">Inscripciones</h1>
          <AdmissionStartMenu />
        </section>
        <GradeProgressionTables initialCandidates={candidates} initialError={initialError} />
      </main>
    </>
  );
}
