"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { useLiveUpdates } from "@/components/LiveUpdatesProvider";
import { operation } from "@/lib/operations/client";
import type {
  AdmissionCandidate,
  AdmissionsOverview,
} from "@/lib/admissions/types";
import type { Bootstrap, Enrollment } from "@/lib/operations/types";
import { EnrollmentWizard } from "./EnrollmentWizard";

type Filter = "all" | "pending" | "enrolled";
export function AdmissionsWorkspace({
  overview,
}: {
  overview: AdmissionsOverview;
}) {
  const [bootstrap, setBootstrap] = useState<Bootstrap | null>(null);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("pending");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selected, setSelected] = useState<AdmissionCandidate | null>(null);
  const [error, setError] = useState("");
  const { version, area } = useLiveUpdates();
  const reload = useCallback(async () => {
    try {
      const next = await operation<Bootstrap>("enrollments/bootstrap");
      setBootstrap(next);
      const year = next.schoolYears.find((item) => item.year === 2027);
      setEnrollments(
        year
          ? await operation<Enrollment[]>(`enrollments?schoolYearId=${year.id}`)
          : [],
      );
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudieron cargar las inscripciones",
      );
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  useEffect(() => {
    if (!version || (area && area !== "ENROLLMENTS")) return;
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [version, area, reload]);
  const allCandidates = useMemo(() => {
    const existing = new Set(
      overview.candidates.map((candidate) => candidate.id),
    );
    const newcomers = enrollments
      .filter((item) => !existing.has(item.studentId))
      .map(
        (item): AdmissionCandidate => ({
          id: item.studentId,
          firstName: item.studentFirstName || "Alumno",
          lastName: item.studentLastName || "",
          currentGrade: null,
          proposedGrade: item.gradeName,
          familyId: null,
          familyName: String(item.profile?.familyName || "") || null,
          familyReviewStatus: null,
          representativeName:
            String(item.profile?.representativeName || "") || null,
          historicalContracts: 0,
          status: "REVIEW",
        }),
      );
    return [...overview.candidates, ...newcomers];
  }, [overview.candidates, enrollments]);
  const enrolledIds = useMemo(
    () => new Set(enrollments.map((item) => item.studentId)),
    [enrollments],
  );
  const visible = allCandidates
    .filter((candidate) => {
      if (
        (filter === "pending" && enrolledIds.has(candidate.id)) ||
        (filter === "enrolled" && !enrolledIds.has(candidate.id))
      )
        return false;
      return `${candidate.firstName} ${candidate.lastName} ${candidate.familyName ?? ""} ${candidate.currentGrade ?? ""}`
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es"));
    })
    .slice(0, 150);
  function open(candidate: AdmissionCandidate | null) {
    setSelected(candidate);
    setWizardOpen(true);
  }
  return (
    <WorkspaceShell current="Inscripciones">
      <div className="hero hero-admissions">
        <div className="hero-copy">
          <span className="eyebrow">CICLO ESCOLAR 2027</span>
          <h1>Inscripciones</h1>
          <button
            className="button button-primary"
            onClick={() => open(null)}
            disabled={!bootstrap}
          >
            <AppIcon name="plus" size={19} /> Nueva inscripción
          </button>
        </div>
        <div className="hero-art">
          <div className="art-ring">
            <AppIcon name="users" size={68} />
          </div>
          <span className="art-spark">
            <AppIcon name="spark" size={25} />
          </span>
        </div>
      </div>
      <div className="station-stats">
        <div>
          <span className="stat-icon blue">
            <AppIcon name="users" />
          </span>
          <span>
            <small>Alumnos</small>
            <strong>{allCandidates.length}</strong>
          </span>
        </div>
        <div>
          <span className="stat-icon coral">
            <AppIcon name="clock" />
          </span>
          <span>
            <small>Por inscribir</small>
            <strong>
              {allCandidates.filter((item) => !enrolledIds.has(item.id)).length}
            </strong>
          </span>
        </div>
        <div>
          <span className="stat-icon mint">
            <AppIcon name="check" />
          </span>
          <span>
            <small>Inscritos</small>
            <strong>{enrollments.length}</strong>
          </span>
        </div>
      </div>
      <section className="work-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ATENCIÓN EN MOSTRADOR</span>
            <h2>Busca un expediente</h2>
          </div>
          <label className="search-field queue-search">
            <AppIcon name="search" size={19} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, familia o grado"
            />
          </label>
        </div>
        <div className="large-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={filter === "pending"}
            onClick={() => setFilter("pending")}
          >
            Por inscribir{" "}
            <span>
              {allCandidates.filter((item) => !enrolledIds.has(item.id)).length}
            </span>
          </button>
          <button
            role="tab"
            aria-selected={filter === "enrolled"}
            onClick={() => setFilter("enrolled")}
          >
            Inscritos <span>{enrollments.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Todos <span>{allCandidates.length}</span>
          </button>
        </div>
        {overview.connection !== "connected" && (
          <p className="alert-error" role="alert">
            {overview.error ||
              "La lista de alumnos no está disponible para esta cuenta."}
          </p>
        )}
        {error && (
          <p className="alert-error" role="alert">
            {error}
          </p>
        )}
        <div className="student-grid">
          {visible.map((candidate) => {
            const enrolled = enrolledIds.has(candidate.id);
            return (
              <button
                className="student-card"
                type="button"
                key={candidate.id}
                onClick={() => open(candidate)}
              >
                <span className={`avatar ${enrolled ? "mint" : "blue"}`}>
                  {candidate.firstName.slice(0, 1)}
                  {candidate.lastName.slice(0, 1)}
                </span>
                <span className="student-card-copy">
                  <strong>
                    {candidate.firstName} {candidate.lastName}
                  </strong>
                  <small>
                    {candidate.familyName || "Familia por completar"}
                  </small>
                  <em>
                    {enrolled
                      ? "Inscrito 2027"
                      : candidate.currentGrade
                        ? `${candidate.currentGrade} → ${candidate.proposedGrade || "Revisar grado"}`
                        : "Nuevo alumno"}
                  </em>
                </span>
                <span
                  className={`status-pill ${enrolled ? "success" : "waiting"}`}
                >
                  {enrolled ? "Inscrito" : "Pendiente"}
                </span>
                <AppIcon name="arrow" size={18} />
              </button>
            );
          })}
        </div>
        {visible.length === 0 && (
          <div className="empty-state">
            <span>
              <AppIcon name="search" size={34} />
            </span>
            <h3>No encontramos alumnos</h3>
            <p>Prueba otra búsqueda o crea una inscripción nueva.</p>
            <button className="button button-soft" onClick={() => open(null)}>
              Nuevo alumno
            </button>
          </div>
        )}
      </section>
      {wizardOpen && (
        <EnrollmentWizard
          key={selected?.id ?? "new"}
          candidate={selected}
          bootstrap={bootstrap}
          enrollment={
            enrollments.find((item) => item.studentId === selected?.id) ?? null
          }
          onClose={() => {
            setWizardOpen(false);
            setSelected(null);
            void reload();
          }}
          onSaved={reload}
        />
      )}
    </WorkspaceShell>
  );
}
