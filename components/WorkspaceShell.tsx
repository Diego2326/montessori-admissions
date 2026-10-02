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
        <span><strong>Montessori</strong><small>Zacapa · Admisiones</small></span>
      </Link>
      <nav className="station-nav" aria-label="Estaciones">{stations.map((station) =>
        <Link key={station.href} href={station.href} aria-current={current === station.label ? "page" : undefined}>{station.label}</Link>
      )}</nav>
      <div className="header-actions"><span className="cycle-pill">2027</span><SignOutButton /></div>
    </div></header>
    <main className="main-content">{children}</main>
  </div>;
}
