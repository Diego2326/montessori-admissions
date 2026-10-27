import { requireAdmissionsSession } from "@/lib/auth/session";
import { SignOutButton } from "@/components/SignOutButton";

export const dynamic = "force-dynamic";

export default async function NoStaffAccessPage() {
  await requireAdmissionsSession();
  return <main className="no-access-page"><section><span className="eyebrow">ACCESO DEL PERSONAL</span><h1>Tu cuenta todavía no tiene un área asignada</h1><p>Solicita a administración que te habilite Inscripciones, Ventas o Contabilidad según las tareas que necesitas realizar.</p><SignOutButton /></section></main>;
}
