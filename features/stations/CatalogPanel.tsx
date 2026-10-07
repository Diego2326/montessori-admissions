"use client";

import { useState, type FormEvent } from "react";
import { type Product, type StockMovement, money } from "@/lib/operations/types";
import { operation, save } from "@/lib/operations/client";
import type { Station } from "./StationWorkspace";

type Props = { station: Station; products: Product[]; busy: boolean; run: (action: () => Promise<unknown>) => Promise<boolean> };
const blank = { sku: "", name: "", size: "", unitPrice: "", active: true };
export function CatalogPanel({ station, products, busy, run }: Props) {
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(blank);
  const [adjusting, setAdjusting] = useState<Product | null>(null);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<StockMovement[]>([]);
  const base = `admission-stations/${station}/products`;
  function edit(product: Product) { setEditing(product.id); setForm({ sku: product.sku, name: product.name, size: product.size ?? "", unitPrice: product.unitPrice, active: product.active }); }
  async function submit(event: FormEvent) { event.preventDefault(); const okay = await run(() => save<Product>(editing ? `${base}/${editing}` : base, { ...form, size: form.size || null, gradeId: null }, editing ? "PUT" : "POST")); if (okay) { setEditing(null); setForm(blank); } }
  async function showStock(product: Product) { setAdjusting(product); setHistory(await operation<StockMovement[]>(`${base}/${product.id}/movements`)); }
  async function adjust(event: FormEvent) { event.preventDefault(); if (!adjusting) return; const okay = await run(() => save<Product>(`${base}/${adjusting.id}/stock`, { quantityDelta: Number(delta), reason })); if (okay) { setAdjusting(null); setDelta(""); setReason(""); } }
  return <div className="split-layout"><section className="panel"><div className="panel-head"><h2>Catálogo</h2><span>{products.length} productos</span></div><div className="table-wrap"><table className="candidate-table"><thead><tr><th>Producto</th><th>Talla</th><th>Precio</th><th>Existencias</th><th></th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><strong>{product.name}</strong><small className="row-subtle">{product.sku}{!product.active ? " · Inactivo" : ""}</small></td><td>{product.size || "—"}</td><td>{money(product.unitPrice)}</td><td><span className={product.stockQuantity <= 5 ? "stock-low" : ""}>{product.stockQuantity}</span></td><td><button className="row-action" onClick={() => edit(product)}>Editar</button> <button className="row-action" onClick={() => void showStock(product)}>Stock</button></td></tr>)}</tbody></table>{products.length === 0 && <div className="empty-table">Aún no hay productos.</div>}</div></section>
  <aside className="panel form-panel"><div className="panel-head"><h2>{adjusting ? `Stock · ${adjusting.name}` : editing ? "Editar producto" : "Nuevo producto"}</h2>{(editing || adjusting) && <button className="text-button" type="button" onClick={() => { setEditing(null); setAdjusting(null); setForm(blank); }}>Cancelar</button>}</div>
  {adjusting ? <><form className="field-grid" onSubmit={(event) => void adjust(event)}><label>Cantidad (+ entrada / − salida)<input required type="number" step="1" value={delta} onChange={(event) => setDelta(event.target.value)} /></label><label>Motivo<input required value={reason} onChange={(event) => setReason(event.target.value)} /></label><button className="primary-button" disabled={busy || !delta || Number(delta) === 0}>Guardar ajuste</button></form><h3>Movimientos recientes</h3><div className="simple-list">{history.map((movement) => <div key={movement.id}><strong>{movement.quantityDelta > 0 ? "+" : ""}{movement.quantityDelta}</strong><span>{movement.reason}</span><small>Saldo {movement.balanceAfter}</small></div>)}</div></> : <form className="field-grid" onSubmit={(event) => void submit(event)}><label>Código / SKU<input required value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} /></label><label>Nombre<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Talla / presentación<input value={form.size} onChange={(event) => setForm({ ...form, size: event.target.value })} /></label><label>Precio (Q)<input required min="0" step="0.01" type="number" value={form.unitPrice} onChange={(event) => setForm({ ...form, unitPrice: event.target.value })} /></label><label className="check-line"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Activo</label><button className="primary-button" disabled={busy}>Guardar producto</button></form>}</aside></div>;
}
