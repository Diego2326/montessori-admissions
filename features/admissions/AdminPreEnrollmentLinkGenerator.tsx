"use client";

import { useEffect, useState } from "react";
import type { AdmissionCandidate } from "@/lib/admissions/types";
import { operation } from "@/lib/operations/client";
import type { Bootstrap, Enrollment } from "@/lib/operations/types";
import { GradeBatchPreEnrollmentLinks } from "@/features/admissions/GradeProgressionTables";

async function loadEnrollments() {
  const rows: Enrollment[] = [];
  let offset = 0;
  const seen = new Set<string>();
  for (let page = 0; page < 1000; page++) {
    const batch = await operation<Enrollment[]>(`enrollments?schoolYear=2027&summary=true&limit=200&offset=${offset}`);
    const fresh = batch.filter((enrollment) => {
      const id = String(enrollment.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    rows.push(...fresh);
    if (batch.length < 200) return rows;
    // Older API deployments ignore limit/offset and return the same list.
    // Stop once a page adds no new records instead of looping forever.
    if (fresh.length === 0) return rows;
    offset += batch.length;
  }
  throw new Error("La API no completó la paginación de inscripciones.");
}

export function AdminPreEnrollmentLinkGenerator() {
  const [candidates, setCandidates] = useState<AdmissionCandidate[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [gradeOrder, setGradeOrder] = useState<string[]>([]);
  const [submittedFamilyIds, setSubmittedFamilyIds] = useState<Set<number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [overview, nextEnrollments, bootstrap, familyIds] = await Promise.all([
          operation<{ candidates: AdmissionCandidate[] }>("admission-workflow/2027/overview"),
          loadEnrollments(),
          operation<Bootstrap>("enrollments/bootstrap?summary=true"),
          operation<number[]>("admission-workflow/pre-enrollment-family-status"),
        ]);
        if (!active) return;
        setCandidates(overview.candidates ?? []);
        setEnrollments(nextEnrollments);
        setGradeOrder(bootstrap.gradeLevels.map((grade) => grade.name));
        setSubmittedFamilyIds(new Set(familyIds));
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar los datos para generar enlaces.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  if (loading) return <p className="admissions-stats-loading" role="status">Cargando familias y estados de preinscripción…</p>;
  if (error || !submittedFamilyIds) return <p className="admissions-stats-error" role="alert">{error || "No se pudo consultar el estado de preinscripción."}</p>;

  return <GradeBatchPreEnrollmentLinks
    candidates={candidates}
    enrollments={enrollments}
    submittedFamilyIds={submittedFamilyIds}
    preEnrollmentStatusReady
    gradeOrder={gradeOrder}
  />;
}
