import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FamilyRoute({ searchParams }: { searchParams: Promise<{ familyId?: string }> }) {
  const params = await searchParams;
  const parsedFamilyId = Number(params.familyId);
  const initialFamilyId = Number.isSafeInteger(parsedFamilyId) && parsedFamilyId > 0 ? parsedFamilyId : null;
  if (!initialFamilyId) redirect("/");
  redirect(`/inscripciones/familias/${initialFamilyId}`);
}
