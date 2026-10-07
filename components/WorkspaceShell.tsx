import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { SignOutButton } from "./SignOutButton";
import { LiveUpdatesProvider } from "./LiveUpdatesProvider";

const stations = [
  { href: "/", label: "Inscripciones", icon: "◫" },
  { href: "/contabilidad", label: "Contabilidad", icon: "▤" },
  { href: "/libros", label: "Libros", icon: "▣" },
  { href: "/uniformes", label: "Uniformes", icon: "◈" },
];

export function WorkspaceShell({ current, children }: { current: string; children: ReactNode }) {
  return <div className="workspace">
    <aside className="site-header">
      <Link href="/" className="brand" aria-label="Ir a inscripciones">
        <Image unoptimized src="/logo-colegio.png" width={42} height={42} alt="" className="brand-logo" />
        <span><small>COLEGIO BILINGÜE</small><strong>Montessori</strong><small>Admisiones · Zacapa</small></span>
      </Link>
      <div className="sidebar-content"><p className="nav-caption">OPERACIONES</p><nav className="station-nav" aria-label="Estaciones">{stations.map((station) =>
        <Link key={station.href} href={station.href} aria-current={current === station.label ? "page" : undefined}><span className="nav-symbol" aria-hidden="true">{station.icon}</span>{station.label}</Link>
      )}</nav></div>
      <div className="header-actions"><span className="cycle-pill">Ciclo 2027</span><SignOutButton /></div>
    </aside>
    <main className="main-content"><LiveUpdatesProvider>{children}</LiveUpdatesProvider></main>
  </div>;
}
