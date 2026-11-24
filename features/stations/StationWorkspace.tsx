"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { useLiveUpdates } from "@/components/LiveUpdatesProvider";
import { operation } from "@/lib/operations/client";
import {
  money,
  orderPending,
  orderPrepared,
  type Order,
  type Product,
  type SchoolYear,
  type Student,
} from "@/lib/operations/types";
import { OrderComposer } from "./OrderComposer";
import { OrderDetails } from "./OrderDetails";
import type { StaffAccess } from "@/lib/auth/access";

export type Station = "BOOKS" | "UNIFORMS";
type Filter = "new" | "preparing" | "ready" | "pending" | "done";
export function StationWorkspace({ station, initialStudentUuid, access }: { station: Station; initialStudentUuid?: string; access: StaffAccess }) {
  const title = station === "BOOKS" ? "Libros" : "Uniformes";
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [studentsLoaded, setStudentsLoaded] = useState(false);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [schoolYearId, setSchoolYearId] = useState(0);
  const [filter, setFilter] = useState<Filter>("new");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [composeStudentId, setComposeStudentId] = useState<number | null>(null);
  const [deepLinkHandled, setDeepLinkHandled] = useState(false);
  const [error, setError] = useState("");
  const { version, area } = useLiveUpdates();
  const reloadOrders = useCallback(async () => {
    try {
      setOrders(await operation<Order[]>(`admission-stations/${station}/orders`));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar las órdenes");
    }
  }, [station]);

  const reloadProducts = useCallback(async () => {
    try {
      setProducts(await operation<Product[]>(`admission-stations/${station}/products`));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los productos");
    }
  }, [station]);

  const reloadStudents = useCallback(async (force = false) => {
    if (studentsLoading || (!force && studentsLoaded)) return;
    setStudentsLoading(true);
    try {
      setStudents(await operation<Student[]>("admission-stations/students?schoolYear=2027"));
      setStudentsLoaded(true);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los alumnos");
      setStudentsLoaded(true);
    } finally {
      setStudentsLoading(false);
    }
  }, [studentsLoaded, studentsLoading]);

  const reloadCatalogs = useCallback(async () => {
    try {
      const [years, nextProducts] = await Promise.all([
        operation<SchoolYear[]>("school-years"),
        operation<Product[]>(`admission-stations/${station}/products`),
      ]);
      setSchoolYearId(years.find((year) => year.year === 2027)?.id ?? 0);
      setProducts(nextProducts);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron cargar los datos de la estación");
    }
  }, [station]);

  const reload = useCallback(async () => {
    await Promise.all([reloadOrders(), reloadCatalogs()]);
  }, [reloadCatalogs, reloadOrders]);

  const reloadOrdersAndProducts = useCallback(async () => {
    await Promise.all([reloadOrders(), reloadProducts()]);
  }, [reloadOrders, reloadProducts]);

  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  useEffect(() => {
    if (!version) return;
    const update = !area
      ? reload
      : area === station
        ? reloadOrdersAndProducts
        : area === "ENROLLMENTS"
          ? composing ? () => reloadStudents(true) : null
          : area === "FINANCE"
            ? reloadOrders
            : null;
    if (!update) return;
    const timer = setTimeout(() => void update(), 0);
    return () => clearTimeout(timer);
  }, [version, area, station, composing, reload, reloadOrdersAndProducts, reloadOrders, reloadStudents]);
  useEffect(() => {
    if (composing || (initialStudentUuid && !deepLinkHandled)) void reloadStudents();
  }, [composing, initialStudentUuid, deepLinkHandled, reloadStudents]);
  useEffect(() => {
    if (deepLinkHandled || !initialStudentUuid || !students.length) return;
    const student = students.find((item) => item.studentUuid === initialStudentUuid);
    setDeepLinkHandled(true);
    if (!student) {
      setError("Este alumno todavía no aparece en el padrón de la estación. Confirma que la inscripción esté activa e inténtalo de nuevo.");
      return;
    }
    setComposeStudentId(student.id);
    setComposing(true);
  }, [deepLinkHandled, initialStudentUuid, students]);
  const active = orders.filter((order) => order.status !== "VOID");
  const count = {
    new: active.filter(
      (order) =>
        order.items.every((item) => item.preparedQuantity === 0) &&
        orderPending(order),
    ).length,
    preparing: active.filter(
      (order) =>
        order.items.some((item) => item.preparedQuantity > 0) &&
        !orderPrepared(order) &&
        orderPending(order),
    ).length,
    ready: active.filter((order) => orderPrepared(order) && orderPending(order))
      .length,
    pending: active.filter(
      (order) => order.chargeStatus === "PAID" && orderPending(order),
    ).length,
    done: active.filter((order) => !orderPending(order)).length,
  };
  const visible = useMemo(
    () =>
      active.filter((order) => {
        const needle = search.toLocaleLowerCase("es");
        if (
          needle &&
          !`${order.studentName} ${order.id}`
            .toLocaleLowerCase("es")
            .includes(needle)
        )
          return false;
        if (filter === "new")
          return (
            order.items.every((item) => item.preparedQuantity === 0) &&
            orderPending(order)
          );
        if (filter === "preparing")
          return (
            order.items.some((item) => item.preparedQuantity > 0) &&
            !orderPrepared(order) &&
            orderPending(order)
          );
        if (filter === "ready")
          return orderPrepared(order) && orderPending(order);
        if (filter === "pending")
          return order.chargeStatus === "PAID" && orderPending(order);
        return !orderPending(order);
      }),
    [active, filter, search],
  );
  const selected = orders.find((order) => order.id === selectedId) ?? null;
  const editing = orders.find((order) => order.id === editingId) ?? null;
  return (
    <WorkspaceShell current={title} access={access}>
      <div className={`hero hero-${station.toLowerCase()}`}>
        <div className="hero-copy">
          <span className="eyebrow">
            ESTACIÓN DE {title.toLocaleUpperCase("es")}
          </span>
          <h1>{title}</h1>
          <button
            className="button button-primary"
            onClick={() => { setComposeStudentId(null); setComposing(true); }}
            disabled={!schoolYearId}
          >
            <AppIcon name="plus" size={19} /> Nueva orden
          </button>
        </div>
        <div className="hero-art">
          <div className="art-ring">
            <AppIcon name={station === "BOOKS" ? "book" : "shirt"} size={68} />
          </div>
          <span className="art-spark">
            <AppIcon name="spark" size={25} />
          </span>
        </div>
      </div>
      <div className="station-stats">
        <div>
          <span className="stat-icon violet">
            <AppIcon name="box" />
          </span>
          <span>
            <small>Nuevas</small>
            <strong>{count.new}</strong>
          </span>
        </div>
        <div>
          <span className="stat-icon coral">
            <AppIcon name="clock" />
          </span>
          <span>
            <small>Preparando</small>
            <strong>{count.preparing}</strong>
          </span>
        </div>
        <div>
          <span className="stat-icon mint">
            <AppIcon name="check" />
          </span>
          <span>
            <small>Listas</small>
            <strong>{count.ready}</strong>
          </span>
        </div>
        <div>
          <span className="stat-icon blue">
            <AppIcon name="receipt" />
          </span>
          <span>
            <small>Entregadas</small>
            <strong>{count.done}</strong>
          </span>
        </div>
      </div>
      <section className="work-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">TABLERO EN VIVO</span>
            <h2>Órdenes de trabajo</h2>
          </div>
          <label className="search-field queue-search">
            <AppIcon name="search" size={19} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar alumno o número"
            />
          </label>
        </div>
        <div
          className="large-tabs"
          role="tablist"
          aria-label="Estado de pedidos"
        >
          {(
            [
              { id: "new", label: "Nuevas" },
              { id: "preparing", label: "Preparando" },
              { id: "ready", label: "Listas" },
              { id: "pending", label: "Por entregar" },
              { id: "done", label: "Entregadas" },
            ] as const
          ).map((tab) => (
            <button
              type="button"
              role="tab"
              aria-selected={filter === tab.id}
              key={tab.id}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
              <span>{count[tab.id]}</span>
            </button>
          ))}
        </div>
        {error && (
          <p className="alert-error" role="alert">
            {error}
          </p>
        )}
        <div className="order-grid">
          {visible.map((order) => {
            const remaining = order.items.reduce(
              (sum, item) => sum + item.quantity - item.deliveredQuantity,
              0,
            );
            const prepared = order.items.reduce(
              (sum, item) => sum + item.preparedQuantity,
              0,
            );
            const needed = order.items.reduce(
              (sum, item) => sum + item.quantity,
              0,
            );
            const paid = order.chargeStatus === "PAID";
            return (
              <button
                type="button"
                className="order-card"
                key={order.id}
                onClick={() => setSelectedId(order.id)}
              >
                <div className="order-card-top">
                  <span className="order-number">#{order.id}</span>
                  <span className={`payment-tag ${paid ? "paid" : "waiting"}`}>
                    {paid ? "Pagado" : "Por cobrar"}
                  </span>
                </div>
                <h3>{order.studentName}</h3>
                <p>
                  {order.items
                    .map((item) => `${item.quantity} ${item.name}`)
                    .join(" · ")}
                </p>
                <div className="order-card-progress">
                  <span>
                    <AppIcon name="box" size={17} />
                    {prepared}/{needed} preparados
                  </span>
                  <span>{remaining} por entregar</span>
                </div>
                <div className="order-card-foot">
                  <strong>{money(order.total)}</strong>
                  <span>
                    Ver orden <AppIcon name="arrow" size={16} />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        {visible.length === 0 && (
          <div className="empty-state">
            <span>
              <AppIcon
                name={station === "BOOKS" ? "book" : "shirt"}
                size={34}
              />
            </span>
            <h3>No hay órdenes aquí</h3>
            <p>
              Cuando llegue una orden a esta etapa aparecerá automáticamente.
            </p>
          </div>
        )}
      </section>
      {(composing || editing) && (
        <OrderComposer
          key={`${editing?.id ?? "new"}-${editing?.version ?? 0}`}
          station={station}
          products={products}
          students={students}
          studentsLoading={studentsLoading}
          schoolYearId={schoolYearId}
          initialStudentId={composeStudentId ?? undefined}
          order={editing}
          onCancel={() => {
            setComposing(false);
            setComposeStudentId(null);
            setEditingId(null);
          }}
          onSaved={(order) => {
            setComposing(false);
            setEditingId(null);
            setSelectedId(order.id);
            void reloadOrdersAndProducts();
          }}
        />
      )}
      {selected && !editing && (
        <OrderDetails
          key={`${selected.id}-${selected.version}`}
          order={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() => {
            setEditingId(selected.id);
            setSelectedId(null);
          }}
          onChanged={reloadOrdersAndProducts}
        />
      )}
    </WorkspaceShell>
  );
}
