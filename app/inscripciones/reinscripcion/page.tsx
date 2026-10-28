import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { GradeProgressionTables } from "@/features/admissions/GradeProgressionTables";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import { firstStaffDestination, getStaffAccess } from "@/lib/auth/access";
import { requireAdmissionsSession } from "@/lib/auth/session";
import { getAdmissionsOverview } from "@/lib/admissions/repository";
import { getDemoOverview, isDemoMode } from "@/lib/operations/demo";

export const dynamic = "force-dynamic";

export default async function ReEnrollmentPage() {
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
          <Image unoptimized src="/logo-colegio.png" width={46} height={46} alt="" />
          <span>
            <small>Colegio Bilingüe</small>
            <strong>Montessori</strong>
            <em>Zacapa</em>
          </span>
        </div>
      </header>
      <main className="admissions-home">
        <section className="admissions-start-card" aria-labelledby="reinscription-title">
          <div>
            <span className="eyebrow">CICLO ESCOLAR 2027</span>
            <h1 id="reinscription-title">Buscar alumno o familia para reinscripción</h1>
            <p>Filtra por nombre del alumno o la familia. Al iniciar, el formulario cargará la respuesta de preinscripción más reciente y los datos disponibles de todos los alumnos de la familia.</p>
          </div>
          <Link className="button button-soft" href="/inscripciones/iniciar">Cambiar proceso</Link>
        </section>
        <GradeProgressionTables initialCandidates={candidates} initialError={initialError} />
      </main>
    </>
  );
}
