"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { useLiveUpdates } from "@/components/LiveUpdatesProvider";
import { operation, save } from "@/lib/operations/client";
import { money, type Charge, type FinanceDashboard, type Payment } from "@/lib/operations/types";

export function AccountingWorkspace() {
  const [dashboard, setDashboard] = useState<FinanceDashboard | null>(null);
  const [charges, setCharges] = useState<Charge[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tab, setTab] = useState<"charges" | "payments">("charges");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Charge | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const { version, area } = useLiveUpdates();
  const reload = useCallback(async () => {
    try { const [d, c, p] = await Promise.all([operation<FinanceDashboard>("finance/dashboard"), operation<Charge[]>("finance/charges"), operation<Payment[]>("finance/payments")]); setDashboard(d); setCharges(c); setPayments(p); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo cargar contabilidad"); }
  }, []);
  useEffect(() => { const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer); }, [reload]);
  useEffect(() => { if (!version || area && area !== "FINANCE" && area !== "ENROLLMENTS") return; const timer = setTimeout(() => void reload(), 0); return () => clearTimeout(timer); }, [version, area, reload]);
  const visibleCharges = useMemo(() => charges.filter((charge) => `${charge.studentName || ""} ${charge.description} ${charge.id}`.toLowerCase().includes(search.toLowerCase())), [charges, search]);
  const visiblePayments = useMemo(() => payments.filter((payment) => `${payment.studentName || ""} ${payment.id} ${payment.externalReference || ""}`.toLowerCase().includes(search.toLowerCase())), [payments, search]);
  async function register(event: FormEvent) {
    event.preventDefault(); if (!selected) return;
    setBusy(true); setError("");
    try {
      const payment = await save<Payment>("finance/payments", { studentId: selected.studentId, amount, paidAt: new Date().toISOString(), method, externalReference: reference || null, notes: notes || null, chargeIds: [selected.id] });
      setReceipt(payment); setSelected(null); setAmount(""); setReference(""); setNotes(""); await reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo registrar el pago"); }
    finally { setBusy(false); }
  }
  return <WorkspaceShell current="Contabilidad"><header className="page-heading"><div><p className="eyebrow">Caja y cuentas por cobrar</p><h1>Contabilidad</h1></div><span className="heading-year">2027</span></header>
    <div className="mini-stats"><div><span>Cobrado este mes</span><strong>{money(dashboard?.collectedThisMonth ?? 0)}</strong></div><div><span>Pendiente</span><strong>{money(dashboard?.pendingTotal ?? 0)}</strong></div><div><span>Vencido</span><strong>{money(dashboard?.overdueTotal ?? 0)}</strong></div><div><span>Cargos pendientes</span><strong>{dashboard?.pendingCharges ?? 0}</strong></div></div>
    <div className="workspace-tabs" role="tablist"><button role="tab" aria-selected={tab === "charges"} onClick={() => setTab("charges")}>Cargos</button><button role="tab" aria-selected={tab === "payments"} onClick={() => setTab("payments")}>Pagos</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="panel"><div className="panel-head"><h2>{tab === "charges" ? "Cargos" : "Pagos registrados"}</h2><label className="search-box"><span className="sr-only">Buscar</span><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar alumno o referencia" /></label></div><div className="table-wrap"><table className="candidate-table"><thead>{tab === "charges" ? <tr><th>Alumno</th><th>Concepto</th><th>Monto</th><th>Saldo</th><th>Estado</th><th></th></tr> : <tr><th>Recibo</th><th>Alumno</th><th>Fecha</th><th>Método</th><th>Monto</th><th></th></tr>}</thead><tbody>{tab === "charges" ? visibleCharges.map((charge) => <tr key={charge.id}><td><strong>{charge.studentName || `Alumno #${charge.studentId}`}</strong></td><td>{charge.description}</td><td>{money(charge.amount)}</td><td>{money(charge.balance)}</td><td><span className={`status-badge ${Number(charge.balance) <= 0 ? "status-paid" : "status-warm"}`}>{Number(charge.balance) <= 0 ? "Pagado" : "Pendiente"}</span></td><td>{Number(charge.balance) > 0 && <button className="row-action" onClick={() => { setSelected(charge); setAmount(charge.balance); }}>Cobrar ↗</button>}</td></tr>) : visiblePayments.map((payment) => <tr key={payment.id}><td><strong>#{payment.id}</strong></td><td>{payment.studentName || "—"}</td><td>{new Date(payment.paidAt).toLocaleString("es-GT")}</td><td>{payment.method}</td><td>{money(payment.amount)}</td><td><button className="row-action" onClick={() => setReceipt(payment)}>Recibo ↗</button></td></tr>)}</tbody></table>{(tab === "charges" ? visibleCharges : visiblePayments).length === 0 && <div className="empty-table">No hay registros.</div>}</div></section>
    {selected && <div className="drawer-backdrop" onMouseDown={() => setSelected(null)}><aside className="details-drawer" role="dialog" aria-modal="true" aria-label="Registrar pago" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><span className="eyebrow">Cargo #{selected.id}</span><button className="close-button" onClick={() => setSelected(null)}>×</button></div><h2>Registrar pago</h2><p className="muted">{selected.studentName} · {selected.description}</p><div className="form-total"><span>Saldo disponible</span><strong>{money(selected.balance)}</strong></div><form className="field-grid" onSubmit={(event) => void register(event)}><label>Monto (Q)<input type="number" required min="0.01" max={selected.balance} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} /></label><label>Método<select value={method} onChange={(event) => setMethod(event.target.value)}><option value="CASH">Efectivo</option><option value="TRANSFER">Transferencia</option><option value="CARD">Tarjeta</option><option value="BANK_DEPOSIT">Depósito</option></select></label><label>Referencia<input value={reference} onChange={(event) => setReference(event.target.value)} /></label><label>Notas<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label><button className="primary-button" disabled={busy || Number(amount) <= 0 || Number(amount) > Number(selected.balance)}>Registrar pago</button></form></aside></div>}
    {receipt && <div className="drawer-backdrop" onMouseDown={() => setReceipt(null)}><aside className="details-drawer receipt-drawer" role="dialog" aria-modal="true" aria-label={`Recibo ${receipt.id}`} onMouseDown={(event) => event.stopPropagation()}><div className="drawer-head"><span className="eyebrow">Montessori Zacapa</span><button className="close-button no-print" onClick={() => setReceipt(null)}>×</button></div><h2>Recibo #{receipt.id}</h2><div className="detail-section"><dl><div><dt>Alumno</dt><dd>{receipt.studentName || `#${receipt.studentId}`}</dd></div><div><dt>Fecha</dt><dd>{new Date(receipt.paidAt).toLocaleString("es-GT")}</dd></div><div><dt>Método</dt><dd>{receipt.method}</dd></div>{receipt.externalReference && <div><dt>Referencia</dt><dd>{receipt.externalReference}</dd></div>}</dl></div><div className="form-total"><span>Recibido</span><strong>{money(receipt.amount)}</strong></div><button className="primary-button full-width no-print" onClick={() => window.print()}>Imprimir recibo</button></aside></div>}
  </WorkspaceShell>;
}
