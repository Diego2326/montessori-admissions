import { WorkspaceShell } from "./WorkspaceShell";

type Station = "Caja" | "Libros" | "Uniformes";

const copy: Record<Station, { eyebrow: string; title: string; description: string; items: string[] }> = {
  Caja: { eyebrow: "Estación de cobros", title: "Cada pago, bien registrado.", description: "Aquí se confirmará la inscripción y se cobrarán los pedidos de libros y uniformes.", items: ["Cobro de inscripción", "Ventas de productos", "Comprobantes y pendientes"] },
  Libros: { eyebrow: "Estación de libros", title: "Paquetes listos para aprender.", description: "Los paquetes se organizarán por grado, con control de existencias y libros pendientes de entrega.", items: ["Paquetes por grado", "Existencias disponibles", "Entregas y faltantes"] },
  Uniformes: { eyebrow: "Estación de uniformes", title: "La talla correcta, a tiempo.", description: "Esta estación llevará las prendas por talla, sus ventas y la entrega a cada familia.", items: ["Prendas y tallas", "Inventario", "Entregas pendientes"] },
};

export function StationLanding({ station }: { station: Station }) {
  const content = copy[station];
  return <WorkspaceShell current={station}><section className="station-hero"><p className="eyebrow">{content.eyebrow} · Ciclo 2027</p><h1>{content.title}</h1><p>{content.description}</p></section><div className="station-grid">{content.items.map((item, index) => <article key={item}><span>0{index + 1}</span><h2>{item}</h2><p>Se habilitará cuando la configuración de esta estación esté completa.</p></article>)}</div><div className="workflow-note"><span className="workflow-step">↗</span><div><strong>El proceso empieza en inscripciones</strong><p>La firma y el pago de inscripción habilitarán el siguiente paso para cada alumno.</p></div></div></WorkspaceShell>;
}
