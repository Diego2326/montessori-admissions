import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/SignOutButton";
import { EnrollmentStatsDashboard } from "@/features/admissions/EnrollmentStatsDashboard";
import { AdminPreEnrollmentLinkGenerator } from "@/features/admissions/AdminPreEnrollmentLinkGenerator";
import { getStaffAccess } from "@/lib/auth/access";
import { requireAdmissionsSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/operations/demo";

export const dynamic = "force-dynamic";

export default async function AdmissionsAdministrationPage() {
  const access = isDemoMode()
    ? await getStaffAccess("", true)
    : await getStaffAccess(await requireAdmissionsSession());
  if (!access.isAdmin) redirect("/");

  return (
    <>
      <header className="admissions-brand-header">
        <div className="admissions-brand">
          <Image unoptimized src="/logo-colegio.png" width={46} height={46} alt="" />
          <span><small>Colegio Bilingüe</small><strong>Montessori</strong><em>Zacapa</em></span>
        </div>
        <div className="admissions-header-actions">
          <Link className="admissions-admin-link" href="/">Inscripciones</Link>
          <SignOutButton />
        </div>
      </header>
      <main className="admissions-home">
        <AdminPreEnrollmentLinkGenerator />
        <EnrollmentStatsDashboard />
      </main>
    </>
  );
}
