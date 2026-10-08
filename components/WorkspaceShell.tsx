import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { AppIcon } from "./AppIcon";
import { SignOutButton } from "./SignOutButton";
import { LiveUpdatesProvider } from "./LiveUpdatesProvider";
import { LiveIndicator } from "./LiveIndicator";

const stations = [
  { href: "/", label: "Inscripciones", icon: "users" },
  { href: "/libros", label: "Libros", icon: "book" },
  { href: "/uniformes", label: "Uniformes", icon: "shirt" },
  { href: "/caja", label: "Caja", icon: "wallet" },
] as const;

export function WorkspaceShell({
  current,
  children,
}: {
  current: string;
  children: ReactNode;
}) {
  return (
    <LiveUpdatesProvider>
      <div className="workspace">
        <aside className="app-sidebar">
          <Link href="/" className="brand" aria-label="Ir a inscripciones">
            <span className="brand-mark">
              <Image
                unoptimized
                src="/logo-colegio.png"
                width={40}
                height={40}
                alt=""
              />
            </span>
            <span>
              <small>COLEGIO BILINGÜE</small>
              <strong>Montessori</strong>
              <em>Admisiones</em>
            </span>
          </Link>
          <nav className="station-nav" aria-label="Estaciones">
            <span className="nav-caption">ESTACIONES</span>
            {stations.map((station) => (
              <Link
                key={station.href}
                href={station.href}
                aria-current={current === station.label ? "page" : undefined}
              >
                <span className="nav-icon">
                  <AppIcon name={station.icon} />
                </span>
                <span>{station.label}</span>
                {current === station.label && <i className="active-dot" />}
              </Link>
            ))}
          </nav>
          <div className="sidebar-foot">
            <div className="cycle-chip">
              <AppIcon name="spark" size={17} />
              <span>
                Ciclo escolar <strong>2027</strong>
              </span>
            </div>
            <SignOutButton />
          </div>
        </aside>
        <div className="workspace-main">
          <header className="topbar">
            <div>
              <span className="topbar-kicker">MONTESSORI ZACAPA</span>
              <strong>{current}</strong>
            </div>
            <LiveIndicator />
          </header>
          <main className="main-content">{children}</main>
        </div>
        <nav className="mobile-nav" aria-label="Estaciones">
          {stations.map((station) => (
            <Link
              key={station.href}
              href={station.href}
              aria-current={current === station.label ? "page" : undefined}
            >
              <AppIcon name={station.icon} size={21} />
              <span>{station.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </LiveUpdatesProvider>
  );
}
