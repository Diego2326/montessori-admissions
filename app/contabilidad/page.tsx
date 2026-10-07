import { requireAdmissionsSession } from "@/lib/auth/session";
import { AccountingWorkspace } from "@/features/accounting/AccountingWorkspace";
export const dynamic = "force-dynamic";
export default async function Page() { await requireAdmissionsSession(); return <AccountingWorkspace />; }
