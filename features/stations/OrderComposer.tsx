"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AppIcon } from "@/components/AppIcon";
import { operation, save } from "@/lib/operations/client";
import {
  money,
  studentName,
  type BookPackageItem,
  type Order,
  type Product,
  type Student,
} from "@/lib/operations/types";

type Station = "BOOKS" | "UNIFORMS";
type Props = {
  station: Station;
  products: Product[];
  students: Student[];
  schoolYearId: number;
  initialStudentId?: number;
  order?: Order | null;
  onSaved: (order: Order) => void;
  onCancel: () => void;
};
export function OrderComposer({
  station,
  products,
  students,
  schoolYearId,
  initialStudentId,
  order,
  onSaved,
  onCancel,
}: Props) {
  const [studentId, setStudentId] = useState(
    order?.studentId ?? initialStudentId ?? 0,
  );
  const [search, setSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>(() =>
    Object.fromEntries(
      order?.items.map((item) => [item.productId, item.quantity]) ?? [],
    ),
  );
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [packageLoaded, setPackageLoaded] = useState(false);
  const student = students.find((item) => item.id === studentId);
  useEffect(() => {
    if (station !== "BOOKS" || order || !student || packageLoaded) return;
    let active = true;
    void operation<BookPackageItem[]>(
      `admission-stations/book-package/${student.gradeId}`,
    )
      .then((items) => {
        if (active) {
          setQuantities(
            Object.fromEntries(
              items.map((item) => [item.productId, item.quantity]),
            ),
          );
          setPackageLoaded(true);
        }
      })
      .catch(() => {
        if (active) setPackageLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [station, order, student, packageLoaded]);
  const visibleStudents = students
    .filter((item) =>
      studentName(item)
        .toLocaleLowerCase("es")
        .includes(search.toLocaleLowerCase("es")),
    )
    .slice(0, 60);
  const visibleProducts = products.filter(
    (item) =>
      item.active &&
      `${item.name} ${item.size ?? ""} ${item.sku}`
        .toLocaleLowerCase("es")
        .includes(productSearch.toLocaleLowerCase("es")),
  );
  const selected = useMemo(
    () => products.filter((item) => quantities[item.id] > 0),
    [products, quantities],
  );
  const total = selected.reduce(
    (sum, item) => sum + Number(item.unitPrice) * quantities[item.id],
    0,
  );
  function setQuantity(id: number, value: number) {
    setQuantities((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(100, value)),
    }));
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!studentId || !selected.length) return;
    setBusy(true);
    setError("");
    try {
      const items = selected.map((item) => ({
        productId: item.id,
        quantity: quantities[item.id],
      }));
      const result = order
        ? await save<Order>(
            `admission-stations/${station}/orders/${order.id}`,
            { expectedVersion: order.version, items, notes: notes || null },
            "PUT",
          )
        : await save<Order>(`admission-stations/${station}/orders`, {
            studentId,
            schoolYearId,
            items,
            notes: notes || null,
          });
      onSaved(result);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo guardar el pedido",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <section
        className="touch-modal composer-modal"
        role="dialog"
        aria-modal="true"
        aria-label={order ? "Editar pedido" : "Nuevo pedido"}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">
              {station === "BOOKS"
                ? "ESTACIÓN DE LIBROS"
                : "ESTACIÓN DE UNIFORMES"}
            </span>
            <h2>{order ? `Editar pedido #${order.id}` : "Nuevo pedido"}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onCancel}
            aria-label="Cerrar"
          >
            <AppIcon name="close" />
          </button>
        </header>
        <form
          onSubmit={(event) => void submit(event)}
          className="composer-form"
        >
          <div className="composer-scroll">
            {order ? (
              <div className="selected-student">
                <AppIcon name="users" />
                <span>
                  <strong>{order.studentName}</strong>
                  <small>Alumno inscrito · Ciclo 2027</small>
                </span>
              </div>
            ) : (
              <section className="form-section">
                <h3>Alumno inscrito</h3>
                <label className="search-field">
                  <AppIcon name="search" size={20} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por nombre"
                  />
                </label>
                <div className="student-options">
                  {visibleStudents.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`student-option ${studentId === item.id ? "selected" : ""}`}
                      onClick={() => {
                        setStudentId(item.id);
                        setPackageLoaded(false);
                        setQuantities({});
                      }}
                    >
                      <span>
                        <strong>{studentName(item)}</strong>
                        <small>
                          {item.gradeName}
                          {item.familyName ? ` · ${item.familyName}` : ""}
                        </small>
                      </span>
                      {studentId === item.id && (
                        <AppIcon name="check" size={20} />
                      )}
                    </button>
                  ))}
                </div>
              </section>
            )}
            {studentId > 0 && (
              <section className="form-section">
                <div className="section-row">
                  <div>
                    <h3>
                      {station === "BOOKS"
                        ? "Libros del pedido"
                        : "Prendas del pedido"}
                    </h3>
                    <p>
                      {station === "BOOKS"
                        ? "Paquete sugerido según el grado. Puedes ajustarlo."
                        : "Elige prendas, tallas y cantidades."}
                    </p>
                  </div>
                  <span className="count-pill">
                    {selected.length} productos
                  </span>
                </div>
                <label className="search-field">
                  <AppIcon name="search" size={20} />
                  <input
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder={
                      station === "BOOKS"
                        ? "Buscar libro"
                        : "Buscar prenda o talla"
                    }
                  />
                </label>
                <div className="product-options">
                  {visibleProducts.map((item) => (
                    <div className="product-option" key={item.id}>
                      <span className="product-glyph">
                        <AppIcon
                          name={station === "BOOKS" ? "book" : "shirt"}
                        />
                      </span>
                      <span className="product-copy">
                        <strong>{item.name}</strong>
                        <small>
                          {item.size || item.sku} · {money(item.unitPrice)}
                        </small>
                        <em>
                          {item.stockQuantity > 0
                            ? `${item.stockQuantity} disponibles`
                            : "Pendiente de existencias"}
                        </em>
                      </span>
                      <div className="stepper">
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity(item.id, (quantities[item.id] || 0) - 1)
                          }
                          aria-label={`Quitar ${item.name}`}
                        >
                          −
                        </button>
                        <output>{quantities[item.id] || 0}</output>
                        <button
                          type="button"
                          onClick={() =>
                            setQuantity(item.id, (quantities[item.id] || 0) + 1)
                          }
                          aria-label={`Agregar ${item.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {visibleProducts.length === 0 && (
                  <p className="empty-note">
                    No hay productos para esta búsqueda.
                  </p>
                )}
              </section>
            )}
            <section className="form-section">
              <label className="field-label">
                Nota para la estación
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Indicaciones o detalles del pedido"
                />
              </label>
            </section>
            {error && (
              <p className="alert-error" role="alert">
                {error}
              </p>
            )}
          </div>
          <footer className="modal-actions">
            <div>
              <small>
                {selected.reduce((sum, item) => sum + quantities[item.id], 0)}{" "}
                artículos
              </small>
              <strong>{money(total)}</strong>
            </div>
            <button
              className="button button-primary"
              type="submit"
              disabled={busy || !studentId || !selected.length}
            >
              {busy ? "Guardando…" : order ? "Guardar cambios" : "Crear orden"}
              <AppIcon name="arrow" size={18} />
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
