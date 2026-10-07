"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { useLiveUpdates } from "@/components/LiveUpdatesProvider";
import { operation, save } from "@/lib/operations/client";
import { money, type Order, type Product, type SchoolYear, type StockMovement } from "@/lib/operations/types";
import { CatalogPanel } from "./CatalogPanel";
import { OrderPanel } from "./OrderPanel";

export type Station = "BOOKS" | "UNIFORMS";
export function StationWorkspace({ station }: { station: Station }) {
  const title = station === "BOOKS" ? "Libros" : "Uniformes";
  const [tab, setTab] = useState<"orders" | "catalog">("orders");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [years, setYears] = useState<SchoolYear[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { version, area } = useLiveUpdates();
  const base = `admission-stations/${station}`;
  const reload = useCallback(async () => {
    try {
      const [p, o, y] = await Promise.all([operation<Product[]>(`${base}/products`), operation<Order[]>(`${base}/orders`), operation<SchoolYear[]>("school-years")]);
      setProducts(p); setOrders(o); setYears(y); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudieron cargar los datos"); }
  }, [base]);
  useEffect(() => { const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer); }, [reload]);
  useEffect(() => { if (!version || area && area !== station) return; const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer); }, [version, area, station, reload]);
  const pending = useMemo(() => orders.filter((order) => order.status !== "VOID" && order.items.some((item) => item.deliveredQuantity < item.quantity)).length, [orders]);
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true); setError("");
    try { await action(); await reload(); return true; }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo completar la acción"); return false; }
    finally { setBusy(false); }
  }
  return <WorkspaceShell current={title}>
    <header className="page-heading"><div><p className="eyebrow">Estación de entrega</p><h1>{title}</h1></div><span className="heading-year">2027</span></header>
    <div className="mini-stats"><div><span>Pedidos</span><strong>{orders.filter((order) => order.status !== "VOID").length}</strong></div><div><span>Por entregar</span><strong>{pending}</strong></div><div><span>Productos activos</span><strong>{products.filter((product) => product.active).length}</strong></div><div><span>Stock bajo</span><strong>{products.filter((product) => product.active && product.stockQuantity <= 5).length}</strong></div></div>
    <div className="workspace-tabs" role="tablist" aria-label={`Opciones de ${title}`}><button type="button" role="tab" aria-selected={tab === "orders"} onClick={() => setTab("orders")}>Pedidos y entregas</button><button type="button" role="tab" aria-selected={tab === "catalog"} onClick={() => setTab("catalog")}>Catálogo e inventario</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {tab === "orders" ? <OrderPanel station={station} products={products} orders={orders} years={years} busy={busy} run={run} /> : <CatalogPanel station={station} products={products} busy={busy} run={run} />}
  </WorkspaceShell>;
}
export async function stockHistory(station: Station, productId: number) { return operation<StockMovement[]>(`admission-stations/${station}/products/${productId}/movements`); }
export { operation, save, money };
