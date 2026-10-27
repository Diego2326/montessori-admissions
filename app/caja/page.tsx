import { requireAdmissionsSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/operations/demo";
import { CashierWorkspace } from "@/features/cashier/CashierWorkspace";
import { firstStaffDestination, getStaffAccess } from "@/lib/auth/access";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function Page() {
  const demo = isDemoMode();
  const access = demo ? await getStaffAccess("", true) : await getStaffAccess(await requireAdmissionsSession());
  if (!access.finance) redirect(firstStaffDestination(access));
  return <CashierWorkspace access={access} />;
}
