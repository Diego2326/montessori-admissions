import { requireAdmissionsSession } from "@/lib/auth/session";
import { CashierWorkspace } from "@/features/cashier/CashierWorkspace";
export const dynamic = "force-dynamic";
export default async function Page() { await requireAdmissionsSession(); return <CashierWorkspace />; }
