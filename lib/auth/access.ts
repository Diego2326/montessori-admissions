import { redirect } from "next/navigation";
import { admissionsApiBase } from "@/lib/admissions/repository";

export type StaffAccess = {
  isAdmin: boolean;
  admissions: boolean;
  workflow: boolean;
  enrollments: boolean;
  finance: boolean;
  sales: boolean;
  userName: string;
  permissions: string[];
};

type ApiUser = { username?: string | null; email: string; role?: string; isAdmin?: boolean; permissions?: string[] };

const allAccess: StaffAccess = {
  isAdmin: true, admissions: true, workflow: true, enrollments: true, finance: true, sales: true,
  userName: "Demostración", permissions: ["ADMISSIONS_MANAGE", "ENROLLMENTS_MANAGE", "FINANCE_MANAGE"],
};

export async function getStaffAccess(token: string, demoMode = false): Promise<StaffAccess> {
  if (demoMode) return allAccess;
  const base = admissionsApiBase();
  if (!base) throw new Error("No se pudo verificar el acceso del personal.");
  const response = await fetch(`${base}/users/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (response.status === 401) redirect("/login");
  if (!response.ok) throw new Error("No se pudieron verificar los permisos de la cuenta.");
  const user = await response.json() as ApiUser;
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const isAdmin = user.isAdmin === true || user.role?.toUpperCase() === "ADMIN";
  const has = (permission: string) => isAdmin || permissions.includes(permission);
  const admissions = has("ADMISSIONS_MANAGE");
  const enrollments = has("ENROLLMENTS_MANAGE");
  const workflow = admissions && enrollments;
  return {
    isAdmin,
    admissions,
    workflow,
    enrollments,
    finance: has("FINANCE_MANAGE"),
    // In the current LMS, ADMISSIONS_MANAGE grants sales API access. Accounts with
    // that scope and without enrollment access are treated as sales-only in this UI.
    sales: isAdmin || (admissions && !enrollments),
    userName: user.username?.trim() || user.email,
    permissions,
  };
}

export function firstStaffDestination(access: StaffAccess): string {
  if (access.workflow) return "/";
  if (access.sales) return "/libros";
  if (access.finance) return "/caja";
  return "/sin-acceso";
}
