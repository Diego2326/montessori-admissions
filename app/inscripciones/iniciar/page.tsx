import Image from "next/image";
import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { requireAdmissionsSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/operations/demo";
import { firstStaffDestination, getStaffAccess } from "@/lib/auth/access";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StartAdmissionPage() {
  if (!isDemoMode()) {
    const token = await requireAdmissionsSession();
    const access = await getStaffAccess(token);
    if (!access.admissions || !access.enrollments) redirect(firstStaffDestination(access));
  }

  return (
    <main className="registration-standalone">
      <header className="registration-brand">
        <Link href="/" className="registration-logo">
          <Image src="/logo-colegio.png" alt="" width={52} height={52} priority />
          <strong>Colegio Bilingüe Montessori Zacapa</strong>
        </Link>
        <span>INSCRIPCIONES · CICLO 2027</span>
      </header>
      <div className="registration-heading">
        <Link className="text-button" href="/">← Volver a inscripciones</Link>
        <span className="eyebrow">CICLO ESCOLAR 2027</span>
        <h1>Iniciar inscripción</h1>
        <p>Selecciona el proceso que deseas realizar.</p>
      </div>
      <section className="registration-panel" aria-label="Tipo de inscripción">
        <div className="registration-content">
          <div className="form-intro">
            <span className="intro-icon blue"><AppIcon name="users" size={26} /></span>
            <div>
              <h3>¿Qué necesitas registrar?</h3>
              <p>Cada opción abre el formulario con los pasos correspondientes.</p>
            </div>
          </div>
          <div className="entry-choice-grid">
            <Link className="entry-choice" href="/inscripciones/nueva?mode=new">
              <span className="stat-icon mint"><AppIcon name="plus" /></span>
              <strong>Inscripción</strong>
              <small>Alumno nuevo. Inicia con los datos de la familia, padres, representante y alumnos.</small>
              <span className="button button-primary">Continuar <AppIcon name="arrow" size={18} /></span>
            </Link>
            <Link className="entry-choice" href="/inscripciones/reinscripcion">
              <span className="stat-icon blue"><AppIcon name="check" /></span>
              <strong>Reinscripción</strong>
              <small>Alumno existente. Busca al alumno para recuperar sus datos y continuar el proceso.</small>
              <span className="button button-soft">Continuar <AppIcon name="arrow" size={18} /></span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
