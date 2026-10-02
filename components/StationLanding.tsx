import { WorkspaceShell } from "./WorkspaceShell";

type Station = "Caja" | "Libros" | "Uniformes";

const copy: Record<Station, string[]> = {
  Caja: ["Inscripciones", "Ventas", "Comprobantes"],
  Libros: ["Paquetes", "Inventario", "Entregas"],
  Uniformes: ["Prendas y tallas", "Inventario", "Entregas"],
};

export function StationLanding({ station }: { station: Station }) {
  return <WorkspaceShell current={station}><header className="page-heading"><div><p className="eyebrow">Ciclo 2027</p><h1>{station}</h1></div></header><div className="station-grid">{copy[station].map((item, index) => <article key={item}><span>0{index + 1}</span><h2>{item}</h2><small>Próximamente</small></article>)}</div></WorkspaceShell>;
}
