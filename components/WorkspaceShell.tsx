import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { AppIcon } from "./AppIcon";
import { SignOutButton } from "./SignOutButton";
import { LiveUpdatesProvider } from "./LiveUpdatesProvider";
import { LiveIndicator } from "./LiveIndicator";
import type { StaffAccess } from "@/lib/auth/access";

const stations = [
  { href: "/", label: "Inscripciones", icon: "users", permission: "workflow" },
  { href: "/libros", label: "Libros", icon: "book", permission: "sales" },
  { href: "/uniformes", label: "Uniformes", icon: "shirt", permission: "sales" },
  { href: "/caja", label: "Contabilidad · Caja", icon: "wallet", permission: "finance" },
] as const;

export function WorkspaceShell({
  current,
  children,
  access,
}: {
  current: string;
  children: ReactNode;
  access: StaffAccess;
}) {
  const demoMode = process.env.NEXT_PUBLIC_ADMISSIONS_DEMO_MODE === "true";
  const visibleStations = stations.filter((station) => access[station.permission]);
  const workAreas = [
    access.isAdmin && "Administración",
    access.workflow && "Inscripciones",
    access.sales && "Ventas",
    access.finance && "Contabilidad",
  ].filter((area): area is string => Boolean(area));
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
            <span className="nav-caption">ÁREAS DE TRABAJO</span>
            {workAreas.length > 0 && <div className="staff-work-areas">{workAreas.map((area) => <span key={area}>{area}</span>)}</div>}
            <span className="nav-caption nav-caption-spaced">MÓDULOS</span>
            {visibleStations.map((station) => (
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
            <div className="staff-session"><small>SESIÓN DEL PERSONAL</small><strong>{access.userName}</strong></div>
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
            <div className="topbar-actions">
              <LiveIndicator />
              <span className="mobile-signout"><SignOutButton /></span>
            </div>
          </header>
          <main className="main-content">
            {demoMode && <div className="demo-mode-banner"><span>DEMO</span> Modo demostración · Los cambios son temporales y no se guardan en una base de datos.</div>}
            {children}
          </main>
        </div>
        <nav className="mobile-nav" aria-label="Estaciones">
          {visibleStations.map((station) => (
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
