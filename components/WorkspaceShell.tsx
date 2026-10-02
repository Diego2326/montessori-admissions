import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "./SignOutButton";

const stations = [
  { href: "/", label: "Inscripciones" },
  { href: "/caja", label: "Caja" },
  { href: "/libros", label: "Libros" },
  { href: "/uniformes", label: "Uniformes" },
];

export function WorkspaceShell({ current, children }: { current: string; children: ReactNode }) {
  return <div className="workspace">
    <header className="site-header"><div className="site-header-inner">
      <Link href="/" className="brand" aria-label="Ir a Inscripciones 2027">
        <img src="/logo-colegio.png" alt="" className="brand-logo" />
        <span><strong>Montessori</strong><small>Gestión de admisiones</small></span>
      </Link>
      <nav className="station-nav" aria-label="Estaciones">{stations.map((station) =>
        <Link key={station.href} href={station.href} aria-current={current === station.label ? "page" : undefined}>{station.label}</Link>
      )}</nav>
      <div className="header-actions"><span className="cycle-pill">Ciclo 2027</span><SignOutButton /></div>
    </div></header>
    <main className="main-content">{children}</main>
    <footer className="site-footer"><span>Colegio Bilingüe Montessori</span><span>Proceso de admisiones · 2027</span></footer>
  </div>;
}
