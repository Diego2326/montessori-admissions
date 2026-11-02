"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { operation } from "@/lib/operations/client";
import type { Enrollment } from "@/lib/operations/types";

export function EnrollmentContractPreview({
  enrollmentIds,
  initialEnrollmentId,
  familyId,
}: {
  enrollmentIds: number[];
  initialEnrollmentId: number;
  familyId: number | null;
}) {
  const [selectedId, setSelectedId] = useState(initialEnrollmentId);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [insurancePdfUrl, setInsurancePdfUrl] = useState<string | null>(null);
  const [insurancePdfLoading, setInsurancePdfLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void Promise.all(enrollmentIds.map((id) => operation<Enrollment>(`enrollments/${id}`)))
      .then((items) => { if (active) setEnrollments(items); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar los datos de los contratos."); })
      .finally(() => { if (active) setDetailsLoading(false); });
    return () => { active = false; };
  }, [enrollmentIds]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const abortController = new AbortController();
    setPdfUrl(null);
    setPdfLoading(true);
    setError("");

    void fetch(`/api/operations/enrollments/${selectedId}/contract.pdf`, { cache: "no-store", signal: abortController.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
          throw new Error(payload?.error || payload?.message || "No se pudo preparar el contrato.");
        }
        const blob = await response.blob();
        if (blob.type !== "application/pdf") throw new Error("La respuesta no contiene un PDF de contrato.");
        objectUrl = URL.createObjectURL(blob);
        if (active) setPdfUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((cause) => {
        if (active && cause instanceof Error && cause.name !== "AbortError") setError(cause.message || "No se pudo preparar el contrato.");
      })
      .finally(() => { if (active) setPdfLoading(false); });

    return () => {
      active = false;
      abortController.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedId]);

  const enrollment = enrollments.find((item) => item.id === selectedId);
  const insuranceSelection = String(enrollment?.profile?.insuranceSelection ?? "");
  const otherInsuranceName = String(enrollment?.profile?.otherInsuranceName ?? "");
  const studentName = enrollment
    ? `${enrollment.studentFirstName ?? ""} ${enrollment.studentLastName ?? ""}`.trim()
    : `Contrato ${selectedId}`;
  const returnHref = familyId ? `/inscripciones/familias/${familyId}` : "/";

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    const abortController = new AbortController();
    setInsurancePdfUrl(null);
    if (insuranceSelection !== "SCHOOL") {
      setInsurancePdfLoading(false);
      return () => { active = false; abortController.abort(); };
    }
    setInsurancePdfLoading(true);
    void fetch(`/api/operations/enrollments/${selectedId}/insurance.pdf`, { cache: "no-store", signal: abortController.signal })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { error?: string; message?: string } | null;
          throw new Error(payload?.error || payload?.message || "No se pudo preparar el formulario del seguro.");
        }
        const blob = await response.blob();
        if (blob.type !== "application/pdf") throw new Error("La respuesta no contiene un PDF del seguro.");
        objectUrl = URL.createObjectURL(blob);
        if (active) setInsurancePdfUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((cause) => {
        if (active && cause instanceof Error && cause.name !== "AbortError") setError(cause.message || "No se pudo preparar el formulario del seguro.");
      })
      .finally(() => { if (active) setInsurancePdfLoading(false); });
    return () => {
      active = false;
      abortController.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selectedId, insuranceSelection]);

  return (
    <>
      <header className="admissions-brand-header">
        <div className="admissions-brand">
          <Image unoptimized src="/logo-colegio.png" width={46} height={46} alt="" />
          <span><small>Colegio Bilingüe</small><strong>Montessori</strong><em>Zacapa</em></span>
        </div>
      </header>
      <main className="contract-preview-page">
        <div className="contract-preview-wrap">
          <Link className="family-sheet-back" href={returnHref}>← Volver a la ficha familiar</Link>
          <section className="contract-preview-card" aria-labelledby="contract-preview-title">
            <div className="contract-preview-heading">
              <div>
                <p className="family-sheet-label">{enrollment?.profile?.familyName ? `FAMILIA · ${enrollment.profile.familyName}` : "CONTRATO DE INSCRIPCIÓN"}</p>
                <h1 id="contract-preview-title">{studentName}</h1>
                <p>Revisa el contrato definitivo. Está listo para imprimir y firmar en el colegio.</p>
              </div>
              {enrollmentIds.length > 1 && <label className="contract-preview-select-label">Contrato del alumno
                <select value={selectedId} onChange={(event) => setSelectedId(Number(event.target.value))}>
                  {enrollmentIds.map((id) => {
                    const row = enrollments.find((item) => item.id === id);
                    const name = `${row?.studentFirstName ?? "Alumno"} ${row?.studentLastName ?? ""}`.trim();
                    return <option key={id} value={id}>{detailsLoading ? `Cargando alumno ${id}…` : name}</option>;
                  })}
                </select>
              </label>}
            </div>

            {error && <p className="contract-preview-error" role="alert">{error}</p>}
            {pdfLoading && <div className="contract-preview-loading" role="status">Preparando la vista previa del contrato…</div>}
            {!pdfLoading && pdfUrl && <iframe className="contract-preview-frame" title={`Contrato de ${studentName}`} src={pdfUrl} />}

            <div className="contract-preview-actions">
              <Link className="contract-preview-button secondary" href={returnHref}>Volver a la ficha</Link>
              {pdfUrl && <a className="contract-preview-button secondary" href={pdfUrl} download={`contrato-${selectedId}.pdf`}>Descargar PDF</a>}
              {pdfUrl && <button className="contract-preview-button primary" type="button" onClick={() => window.open(pdfUrl, "_blank", "noopener,noreferrer")}>Imprimir contrato</button>}
            </div>

            <section className="insurance-preview-section" aria-labelledby="insurance-preview-title">
              <div className="insurance-preview-heading"><div><p className="family-sheet-label">DOCUMENTO DEL ALUMNO</p><h2 id="insurance-preview-title">Seguro estudiantil</h2></div></div>
              {insuranceSelection === "SCHOOL" ? <>
                <p>Se generó el formulario de Seguro Escolar Banrural con los datos de este alumno y su representante.</p>
                {insurancePdfLoading && <div className="contract-preview-loading" role="status">Preparando el formulario del seguro…</div>}
                {insurancePdfUrl && <iframe className="contract-preview-frame insurance-preview-frame" title={`Formulario de seguro de ${studentName}`} src={insurancePdfUrl} />}
                <div className="contract-preview-actions insurance-preview-actions">
                  {insurancePdfUrl && <a className="contract-preview-button secondary" href={insurancePdfUrl} download={`seguro-escolar-${selectedId}.pdf`}>Descargar formulario</a>}
                  {insurancePdfUrl && <button className="contract-preview-button primary" type="button" onClick={() => window.open(insurancePdfUrl, "_blank", "noopener,noreferrer")}>Imprimir seguro</button>}
                </div>
              </> : insuranceSelection === "OTHER" ? <p className="insurance-external-note">La familia indicó cobertura con <strong>{otherInsuranceName || "otra aseguradora"}</strong>. No se genera formulario de Banrural.</p> : <p className="insurance-external-note">El seguro todavía no está registrado en la inscripción.</p>}
            </section>
          </section>
        </div>
      </main>
    </>
  );
}
