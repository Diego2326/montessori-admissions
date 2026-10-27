"use client";

import { useEffect, useRef, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { operation } from "@/lib/operations/client";
import type { PreEnrollmentSubmissionPage } from "@/lib/operations/types";

const PAGE_SIZE = 20;
const UNASSIGNED_GRADE = "__UNASSIGNED__";

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-GT", { dateStyle: "medium", timeStyle: "short" });
}

export function PreEnrollmentResponsesPanel({ grades, onOpenFamily }: { grades: string[]; onOpenFamily: (familyId: number) => void }) {
  const [data, setData] = useState<PreEnrollmentSubmissionPage | null>(null);
  const [search, setSearch] = useState("");
  const [grade, setGrade] = useState("");
  const [decision, setDecision] = useState("all");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");
      const query = new URLSearchParams({
        page: String(page), pageSize: String(PAGE_SIZE), search, grade, decision, sort,
      });
      void operation<PreEnrollmentSubmissionPage>(`admission-workflow/pre-enrollment-responses?${query}`)
        .then((result) => { if (requestId.current === id) setData(result); })
        .catch((cause) => { if (requestId.current === id) setError(cause instanceof Error ? cause.message : "No se pudieron cargar las respuestas de las familias."); })
        .finally(() => { if (requestId.current === id) setLoading(false); });
    }, 180);
    return () => clearTimeout(timer);
  }, [page, search, grade, decision, sort]);

  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const changeFilter = (change: () => void) => { change(); setPage(1); };

  return (
    <section className="work-section home-responses">
      <div className="section-heading">
        <div><span className="eyebrow">FORMULARIOS COMPLETADOS EN CASA</span><h2>Respuestas por revisar</h2><p className="muted">Las familias pueden completar la preinscripción desde casa. El personal revisa aquí cada respuesta y continúa el trámite desde el expediente.</p></div>
        <span className="response-total">{data?.total ?? "—"} respuestas</span>
      </div>

      <div className="response-filters">
        <label className="search-field queue-search"><AppIcon name="search" size={19} /><input value={search} onChange={(event) => changeFilter(() => setSearch(event.target.value))} placeholder="Familia, alumno o representante" /></label>
        <label className="field-label">Grado
          <select value={grade} onChange={(event) => changeFilter(() => setGrade(event.target.value))}>
            <option value="">Todos los grados</option>
            {grades.map((item) => <option key={item} value={item}>{item}</option>)}
            <option value={UNASSIGNED_GRADE}>Grado sin asignar</option>
          </select>
        </label>
        <label className="field-label">Decisión familiar
          <select value={decision} onChange={(event) => changeFilter(() => setDecision(event.target.value))}>
            <option value="all">Todas</option><option value="yes">Continuará</option><option value="no">No continuará</option>
          </select>
        </label>
        <label className="field-label">Orden
          <select value={sort} onChange={(event) => changeFilter(() => setSort(event.target.value))}>
            <option value="newest">Más recientes</option><option value="oldest">Más antiguas</option><option value="family_asc">Familia A–Z</option><option value="family_desc">Familia Z–A</option><option value="student_asc">Alumno A–Z</option><option value="student_desc">Alumno Z–A</option>
          </select>
        </label>
      </div>

      {error && <p className="alert-error" role="alert">{error}</p>}
      {loading && <p className="muted" role="status">Cargando respuestas…</p>}
      {!loading && !error && data?.items.length === 0 && <div className="empty-state"><h3>No hay respuestas con estos filtros</h3><p>Prueba otro grado o amplía la búsqueda.</p></div>}

      <div className="response-list" aria-busy={loading}>
        {data?.items.map((submission) => {
          const selected = submission.students.filter((student) => student.selected);
          const contact = String(submission.profile.representativeEmail || submission.profile.motherEmail || submission.profile.fatherEmail || "");
          return <article className="response-card" key={submission.id}>
            <div className="response-card-head"><div><span className="eyebrow">{dateLabel(submission.submittedAt)}</span><h3>{submission.familyName}</h3><p>{submission.recipientName ? `Respondió ${submission.recipientName}` : "Respuesta familiar"}{contact ? ` · ${contact}` : ""}</p></div>
              <span className={`status-pill ${submission.wantsEnroll ? "success" : "waiting"}`}>{submission.wantsEnroll ? "Continuará en 2027" : "No continuará"}</span></div>
            <div className="response-students"><strong>{selected.length} de {submission.students.length} alumno{submission.students.length === 1 ? "" : "s"} seleccionado{selected.length === 1 ? "" : "s"}</strong>
              <ul>{submission.students.map((student) => <li key={student.publicId} className={student.selected ? "selected" : "not-selected"}><span>{student.firstName} {student.lastName}</span><small>{student.currentGrade || "Grado por confirmar"}</small><em>{student.selected ? "Continúa" : "No seleccionado"}</em></li>)}</ul>
            </div>
            <div className="response-card-foot"><span className="muted">Revisar datos y continuar con el trámite por alumno.</span><button className="button button-primary" type="button" onClick={() => onOpenFamily(submission.familyId)}>Abrir expediente <AppIcon name="arrow" size={17} /></button></div>
          </article>;
        })}
      </div>

      {data && data.total > PAGE_SIZE && <div className="response-pagination"><button className="button button-soft" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>← Anterior</button><span>Página {page} de {pageCount}</span><button className="button button-soft" type="button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Siguiente →</button></div>}
    </section>
  );
}
