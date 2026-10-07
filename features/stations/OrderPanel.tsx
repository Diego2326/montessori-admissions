"use client";

import { useMemo, useState, type FormEvent } from "react";
import { operation, save } from "@/lib/operations/client";
import { money, type Order, type Product, type SchoolYear, type Student } from "@/lib/operations/types";
import type { Station } from "./StationWorkspace";

type Props = { station: Station; products: Product[]; orders: Order[]; years: SchoolYear[]; busy: boolean; run: (action: () => Promise<unknown>) => Promise<boolean> };
export function OrderPanel({ station, products, orders, years, busy, run }: Props) {
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState(0);
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const active = products.filter((product) => product.active && product.stockQuantity > 0);
  const chosen = active.filter((product) => quantities[product.id] > 0);
  const total = chosen.reduce((sum, product) => sum + Number(product.unitPrice) * quantities[product.id], 0);
  const visible = useMemo(() => orders.filter((order) => filter === "all" || order.status !== "VOID" && order.items.some((item) => item.deliveredQuantity < item.quantity)), [orders, filter]);
  async function loadStudents() {
    try { const data = await operation<Student[]>("admission-stations/students"); setStudents(data); }
    catch { setStudents([]); }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    const okay = await run(() => save<Order>(`admission-stations/${station}/orders`, { studentId, schoolYearId: years.find((year) => year.year === 2027)?.id ?? null, items: chosen.map((product) => ({ productId: product.id, quantity: quantities[product.id] })), notes: notes || null }));
    if (okay) { setShowForm(false); setStudentId(0); setQuantities({}); setNotes(""); }
  }
  async function deliver(order: Order) {
    const items = order.items.filter((item) => item.quantity > item.deliveredQuantity).map((item) => ({ itemId: item.id, quantity: item.quantity - item.deliveredQuantity }));
    const okay = await run(() => save<Order>(`admission-stations/${station}/orders/${order.id}/deliver`, { items }));
    if (okay) setSelectedId(null);
  }
  return <><div className="panel"><div className="panel-head"><div><h2>Pedidos</h2><span>Entrega habilitada cuando el cargo está pagado</span></div><button className="primary-button" onClick={() => { setShowForm(true); void loadStudents(); }}>Nuevo pedido</button></div><div className="filter-tabs panel-filters"><button className={filter === "pending" ? "active" : ""} onClick={() => setFilter("pending")}>Por entregar</button><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos</button></div><div className="table-wrap"><table className="candidate-table"><thead><tr><th>Pedido</th><th>Alumno</th><th>Artículos</th><th>Total</th><th>Pago</th><th>Entrega</th><th></th></tr></thead><tbody>{visible.map((order) => <tr key={order.id}><td><strong>#{order.id}</strong><small className="row-subtle">{new Date(order.createdAt).toLocaleDateString("es-GT")}</small></td><td>{order.studentName}</td><td>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</td><td>{money(order.total)}</td><td><span className={`status-badge ${Number(order.balance) <= 0 ? "status-paid" : "status-warm"}`}>{Number(order.balance) <= 0 ? "Pagado" : money(order.balance)}</span></td><td>{order.status === "VOID" ? "Anulado" : order.items.every((item) => item.deliveredQuantity === item.quantity) ? "Completo" : "Pendiente"}</td><td><button className="row-action" onClick={() => setSelectedId(order.id)}>Ver pedido ↗</button></td></tr>)}</tbody></table>{visible.length === 0 && <div className="empty-table">No hay pedidos en esta vista.</div>}</div></div>
  {showForm && <div className="drawer-backdrop" onMouseDown={() => setShowForm(false)}><aside className="details-drawer wide-drawer" role="dialog" aria-modal="true" aria-label="Nuevo pedido" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><span className="eyebrow">Venta</span><button className="close-button" onClick={() => setShowForm(false)}>×</button></div><h2>Nuevo pedido</h2><form className="field-grid" onSubmit={(event) => void create(event)}><label>Buscar alumno<input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Nombre o apellido" /></label><label>Alumno<select required value={studentId || ""} onChange={(event) => setStudentId(Number(event.target.value))}><option value="">Seleccionar</option>{students.filter((student) => `${student.firstName} ${student.lastName}`.toLowerCase().includes(studentSearch.toLowerCase())).map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}</select></label><div className="product-picker">{active.map((product) => <label key={product.id}><span><strong>{product.name}</strong><small>{product.size || product.sku} · {money(product.unitPrice)} · {product.stockQuantity} disponibles</small></span><input type="number" min="0" max={product.stockQuantity} value={quantities[product.id] || ""} onChange={(event) => setQuantities({ ...quantities, [product.id]: Number(event.target.value) })} aria-label={`Cantidad de ${product.name}`} /></label>)}</div><label>Notas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="form-total"><span>Total</span><strong>{money(total)}</strong></div><button className="primary-button" disabled={busy || !studentId || !chosen.length}>Crear pedido y cargo</button></form></aside></div>}
  {selected && <div className="drawer-backdrop" onMouseDown={() => setSelectedId(null)}><aside className="details-drawer" role="dialog" aria-modal="true" aria-label={`Pedido ${selected.id}`} onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><span className="eyebrow">Pedido #{selected.id}</span><button className="close-button" onClick={() => setSelectedId(null)}>×</button></div><h2>{selected.studentName}</h2><div className="simple-list">{selected.items.map((item) => <div key={item.id}><strong>{item.name}</strong><span>{item.quantity} × {money(item.unitPrice)}</span><small>Entregado {item.deliveredQuantity} de {item.quantity}</small></div>)}</div><div className="form-total"><span>Total</span><strong>{money(selected.total)}</strong></div><p className="muted">Saldo del cargo: {money(selected.balance)}</p>{selected.status !== "VOID" && selected.items.some((item) => item.deliveredQuantity < item.quantity) && <button className="primary-button full-width" disabled={busy || Number(selected.balance) > 0} onClick={() => void deliver(selected)}>Entregar pendientes</button>}{selected.status !== "VOID" && selected.items.every((item) => item.deliveredQuantity === 0) && <button className="outline-button full-width" disabled={busy || Number(selected.balance) < Number(selected.total)} onClick={() => void run(() => save<Order>(`admission-stations/${station}/orders/${selected.id}/void`, {})).then((okay) => { if (okay) setSelectedId(null); })}>Anular pedido</button>}</aside></div>}</>;
}
