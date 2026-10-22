import { requireAdmissionsSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/operations/demo";
import { CashierWorkspace } from "@/features/cashier/CashierWorkspace";
export const dynamic = "force-dynamic";
export default async function Page() { if (!isDemoMode()) await requireAdmissionsSession(); return <CashierWorkspace />; }
