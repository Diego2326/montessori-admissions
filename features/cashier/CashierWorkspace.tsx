"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { useLiveUpdates } from "@/components/LiveUpdatesProvider";
import { operation, save } from "@/lib/operations/client";
import {
  money,
  type CheckoutCharge,
  type Receipt,
  type SchoolYear,
} from "@/lib/operations/types";
import { ReceiptView } from "./ReceiptView";

type Account = {
  key: string;
  name: string;
  students: {
    id: number;
    name: string;
    charges: CheckoutCharge[];
    total: number;
  }[];
  total: number;
};
export function CashierWorkspace() {
  const [schoolYearId, setSchoolYearId] = useState(0);
  const [charges, setCharges] = useState<CheckoutCharge[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [tab, setTab] = useState<"pending" | "receipts">("pending");
  const [search, setSearch] = useState("");
  const [accountKey, setAccountKey] = useState<string | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [method, setMethod] = useState("CASH");
  const [reference, setReference] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { version, area } = useLiveUpdates();
  const reload = useCallback(async () => {
    try {
      const years = await operation<SchoolYear[]>("school-years");
      const yearId = years.find((year) => year.year === 2027)?.id ?? 0;
      setSchoolYearId(yearId);
      const [nextCharges, nextReceipts] = await Promise.all([
        yearId
          ? operation<CheckoutCharge[]>(
              `admission-checkout/charges?schoolYearId=${yearId}`,
            )
          : Promise.resolve([]),
        operation<Receipt[]>("admission-checkout/receipts"),
      ]);
      setCharges(nextCharges);
      setReceipts(nextReceipts);
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo cargar Caja",
      );
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  useEffect(() => {
    if (
      !version ||
      (area && !["FINANCE", "BOOKS", "UNIFORMS", "ENROLLMENTS"].includes(area))
    )
      return;
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [version, area, reload]);
  const accounts = useMemo(() => {
    const byFamily = new Map<string, Account>();
    charges.forEach((charge) => {
      const key = charge.familyId
        ? `family-${charge.familyId}`
        : charge.familyName?.trim().toLocaleLowerCase("es") ||
          `student-${charge.studentId}`;
      const group = byFamily.get(key) ?? {
        key,
        name: charge.familyName?.trim() || charge.studentName,
        students: [],
        total: 0,
      };
      let student = group.students.find((item) => item.id === charge.studentId);
      if (!student) {
        student = {
          id: charge.studentId,
          name: charge.studentName,
          charges: [],
          total: 0,
        };
        group.students.push(student);
      }
      student.charges.push(charge);
      student.total += Number(charge.amount);
      group.total += Number(charge.amount);
      byFamily.set(key, group);
    });
    return [...byFamily.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "es"),
    );
  }, [charges]);
  const visible = accounts.filter((account) =>
    `${account.name} ${account.students.map((student) => student.name).join(" ")}`
      .toLocaleLowerCase("es")
      .includes(search.toLocaleLowerCase("es")),
  );
  const active = accounts.find((account) => account.key === accountKey) ?? null;
  const chosen =
    active?.students.filter((student) =>
      selectedStudents.includes(student.id),
    ) ?? [];
  const total = chosen.reduce((sum, student) => sum + student.total, 0);
  function openAccount(account: Account) {
    setAccountKey(account.key);
    setSelectedStudents(account.students.map((student) => student.id));
    setMethod("CASH");
    setReference("");
    setError("");
  }
  function toggleStudent(id: number) {
    setSelectedStudents((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }
  async function pay() {
    if (!schoolYearId || !selectedStudents.length) return;
    setBusy(true);
    setError("");
    try {
      const next = await save<Receipt>("admission-checkout/pay", {
        schoolYearId,
        studentIds: selectedStudents,
        method,
        expectedAmount: total.toFixed(2),
        externalReference: reference || null,
      });
      setAccountKey(null);
      setReceipt(next);
      await reload();
    } catch (cause) {
      await reload();
      setError(
        cause instanceof Error ? cause.message : "No se pudo registrar el pago",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <WorkspaceShell current="Caja">
      <div className="hero hero-cashier">
        <div className="hero-copy">
          <span className="eyebrow">CAJA · CICLO 2027</span>
          <h1>Caja</h1>
        </div>
        <div className="hero-art">
          <div className="art-ring">
            <AppIcon name="wallet" size={68} />
          </div>
          <span className="art-spark">
            <AppIcon name="spark" size={25} />
          </span>
        </div>
      </div>
      <div className="station-stats cashier-stats">
        <div>
          <span className="stat-icon coral">
            <AppIcon name="clock" />
          </span>
          <span>
            <small>Familias pendientes</small>
            <strong>{accounts.length}</strong>
          </span>
        </div>
        <div>
          <span className="stat-icon blue">
            <AppIcon name="wallet" />
          </span>
          <span>
            <small>Por cobrar</small>
            <strong>
              {money(
                charges.reduce((sum, charge) => sum + Number(charge.amount), 0),
              )}
            </strong>
          </span>
        </div>
        <div>
          <span className="stat-icon mint">
            <AppIcon name="receipt" />
          </span>
          <span>
            <small>Recibos recientes</small>
            <strong>{receipts.length}</strong>
          </span>
        </div>
      </div>
      <section className="work-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ATENCIÓN EN MOSTRADOR</span>
            <h2>{tab === "pending" ? "Cuentas pendientes" : "Recibos"}</h2>
          </div>
          <label className="search-field queue-search">
            <AppIcon name="search" size={19} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar familia o alumno"
            />
          </label>
        </div>
        <div className="large-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "pending"}
            onClick={() => setTab("pending")}
          >
            Por cobrar <span>{accounts.length}</span>
          </button>
          <button
            role="tab"
            aria-selected={tab === "receipts"}
            onClick={() => setTab("receipts")}
          >
            Recibos <span>{receipts.length}</span>
          </button>
        </div>
        {error && (
          <p className="alert-error" role="alert">
            {error}
          </p>
        )}
        {tab === "pending" ? (
          <div className="account-grid">
            {visible.map((account) => (
              <button
                key={account.key}
                className="account-card"
                onClick={() => openAccount(account)}
              >
                <div className="account-icon">
                  <AppIcon name="users" size={26} />
                </div>
                <div>
                  <small>
                    {account.students.length > 1
                      ? `${account.students.length} hermanos`
                      : "1 alumno"}
                  </small>
                  <h3>{account.name}</h3>
                  <p>
                    {account.students
                      .map((student) => student.name)
                      .join(" · ")}
                  </p>
                </div>
                <div className="account-card-foot">
                  <strong>{money(account.total)}</strong>
                  <span>
                    Ver cuenta <AppIcon name="arrow" size={17} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="receipt-grid">
            {receipts
              .filter((item) =>
                `${item.receiptNumber} ${item.lines.map((line) => line.studentName).join(" ")}`
                  .toLocaleLowerCase("es")
                  .includes(search.toLocaleLowerCase("es")),
              )
              .map((item) => (
                <button
                  className="receipt-card"
                  key={item.id}
                  onClick={() => setReceipt(item)}
                >
                  <span className="stat-icon blue">
                    <AppIcon name="receipt" />
                  </span>
                  <span>
                    <strong>{item.receiptNumber}</strong>
                    <small>
                      {item.lines
                        .map((line) => line.studentName)
                        .filter(
                          (name, index, all) => all.indexOf(name) === index,
                        )
                        .join(" · ")}
                    </small>
                  </span>
                  <b>{money(item.amount)}</b>
                </button>
              ))}
          </div>
        )}
        {(tab === "pending" ? visible.length : receipts.length) === 0 && (
          <div className="empty-state">
            <span>
              <AppIcon
                name={tab === "pending" ? "check" : "receipt"}
                size={34}
              />
            </span>
            <h3>
              {tab === "pending"
                ? "No hay cuentas pendientes"
                : "Aún no hay recibos"}
            </h3>
            <p>Los cambios aparecen aquí automáticamente.</p>
          </div>
        )}
      </section>
      {active && (
        <div className="modal-backdrop" onMouseDown={() => setAccountKey(null)}>
          <section
            className="touch-modal checkout-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Cobrar a ${active.name}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="modal-header">
              <div>
                <span className="eyebrow">COBRO DE ADMISIONES</span>
                <h2>{active.name}</h2>
                <p>Selecciona un alumno o cobra a los hermanos juntos.</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setAccountKey(null)}
                aria-label="Cerrar"
              >
                <AppIcon name="close" />
              </button>
            </header>
            <div className="detail-scroll">
              <div className="student-checks">
                {active.students.map((student) => (
                  <button
                    className={`student-check ${selectedStudents.includes(student.id) ? "selected" : ""}`}
                    key={student.id}
                    onClick={() => toggleStudent(student.id)}
                  >
                    <span className="check-mark">
                      {selectedStudents.includes(student.id) && (
                        <AppIcon name="check" size={17} />
                      )}
                    </span>
                    <span>
                      <strong>{student.name}</strong>
                      <small>{student.charges.length} cargos</small>
                    </span>
                    <b>{money(student.total)}</b>
                  </button>
                ))}
              </div>
              {chosen.map((student) => (
                <section className="checkout-lines" key={student.id}>
                  <h3>{student.name}</h3>
                  {student.charges.map((charge) => (
                    <div key={charge.id}>
                      <span>{charge.description}</span>
                      <strong>{money(charge.amount)}</strong>
                    </div>
                  ))}
                </section>
              ))}
              <section className="form-section">
                <h3>Método de pago</h3>
                <div className="payment-methods">
                  {[
                    { id: "CASH", label: "Efectivo" },
                    { id: "TRANSFER", label: "Transferencia" },
                    { id: "CARD", label: "Tarjeta" },
                    { id: "BI_CONVENTION", label: "Convenio BI" },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={method === item.id ? "selected" : ""}
                      onClick={() => setMethod(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {method !== "CASH" && (
                  <label className="field-label">
                    Referencia
                    <input
                      required
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      placeholder="Número de operación"
                    />
                  </label>
                )}
              </section>
              {error && (
                <p className="alert-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <footer className="modal-actions">
              <div>
                <small>Total a cobrar</small>
                <strong>{money(total)}</strong>
              </div>
              <button
                className="button button-primary"
                disabled={
                  busy ||
                  !chosen.length ||
                  (method !== "CASH" && !reference.trim())
                }
                onClick={() => void pay()}
              >
                {busy ? "Procesando…" : "Confirmar pago"}
                <AppIcon name="arrow" size={18} />
              </button>
            </footer>
          </section>
        </div>
      )}
      {receipt && (
        <ReceiptView receipt={receipt} onClose={() => setReceipt(null)} />
      )}
    </WorkspaceShell>
  );
}
