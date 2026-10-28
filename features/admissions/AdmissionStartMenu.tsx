import Link from "next/link";

export function AdmissionStartMenu() {
  return (
    <Link
      className="button button-primary admission-start-toggle"
      href="/inscripciones/iniciar"
      target="_blank"
      rel="noopener noreferrer"
    >
        Iniciar inscripción
        <span aria-hidden="true">↗</span>
    </Link>
  );
}
