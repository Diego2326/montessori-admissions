import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function requireAdmissionsSession(): Promise<string> {
  const token = (await cookies()).get("admissions_token")?.value;
  if (!token) redirect("/login");
  return token;
}
