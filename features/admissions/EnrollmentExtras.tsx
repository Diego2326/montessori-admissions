"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppIcon } from "@/components/AppIcon";
import { operation, save } from "@/lib/operations/client";
import {
  money,
  type BookPackageItem,
  type Order,
  type Product,
} from "@/lib/operations/types";

type Props = {
  studentId: number;
  studentName: string;
  gradeId: number;
  schoolYearId: number;
  onDone: () => void;
  doneLabel?: string;
};
export function EnrollmentExtras({
  studentId,
  studentName,
  gradeId,
  schoolYearId,
  onDone,
  doneLabel,
}: Props) {
  const [books, setBooks] = useState<Product[]>([]);
  const [uniforms, setUniforms] = useState<Product[]>([]);
  const [packageItems, setPackageItems] = useState<BookPackageItem[]>([]);
  const [bookSelected, setBookSelected] = useState(false);
  const [uniformQuantities, setUniformQuantities] = useState<
    Record<number, number>
  >({});
  const [existing, setExisting] = useState<Order[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void Promise.all([
      operation<Product[]>("admission-stations/BOOKS/products"),
      operation<Product[]>("admission-stations/UNIFORMS/products"),
      operation<BookPackageItem[]>(
        `admission-stations/book-package/${gradeId}`,
      ),
      operation<Order[]>("admission-stations/BOOKS/orders"),
      operation<Order[]>("admission-stations/UNIFORMS/orders"),
    ])
      .then(([b, u, p, bo, uo]) => {
        if (active) {
          setBooks(b);
          setUniforms(u);
          setPackageItems(p);
          setExisting(
            [...bo, ...uo].filter(
              (item) => item.studentId === studentId && item.status !== "VOID",
            ),
          );
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudieron cargar los productos",
          );
      });
    return () => {
      active = false;
    };
  }, [studentId, gradeId]);
  const hasBooks = existing.some((item) => item.station === "BOOKS");
  const hasUniforms = existing.some((item) => item.station === "UNIFORMS");
  const bookItems = packageItems.filter((item) =>
    books.some((product) => product.id === item.productId && product.active),
  );
  const bookTotal = bookItems.reduce(
    (sum, item) =>
      sum +
      Number(
        books.find((product) => product.id === item.productId)?.unitPrice || 0,
      ) *
        item.quantity,
    0,
  );
  const selectedUniforms = useMemo(
    () => uniforms.filter((product) => uniformQuantities[product.id] > 0),
    [uniforms, uniformQuantities],
  );
  const uniformTotal = selectedUniforms.reduce(
    (sum, product) =>
      sum + Number(product.unitPrice) * uniformQuantities[product.id],
    0,
  );
  function quantity(id: number, delta: number) {
    setUniformQuantities((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(100, (current[id] || 0) + delta)),
    }));
  }
  async function finish() {
    setBusy(true);
    setError("");
    try {
      if (bookSelected && bookItems.length && !hasBooks) {
        const created = await save<Order>("admission-stations/BOOKS/orders", {
          studentId,
          schoolYearId,
          items: bookItems.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        });
        setExisting((current) => [...current, created]);
      }
      if (selectedUniforms.length && !hasUniforms) {
        const created = await save<Order>(
          "admission-stations/UNIFORMS/orders",
          {
            studentId,
            schoolYearId,
            items: selectedUniforms.map((product) => ({
              productId: product.id,
              quantity: uniformQuantities[product.id],
            })),
          },
        );
        setExisting((current) => [...current, created]);
      }
      onDone();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudieron crear los pedidos. Revisa las órdenes antes de reintentar.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="extras-screen">
      <div className="success-banner">
        <span>
          <AppIcon name="check" size={28} />
        </span>
        <div>
          <strong>{studentName} ya quedó inscrito</strong>
          <p>
            Ahora puedes enviar pedidos a las estaciones. También pueden crearse
            más tarde.
          </p>
        </div>
      </div>
      <section className="extras-section">
        <div className="section-row">
          <div>
            <span className="eyebrow">PAQUETE DEL GRADO</span>
            <h3>Libros</h3>
          </div>
          {hasBooks ? (
            <span className="status-pill success">Orden creada</span>
          ) : (
            <label className="big-check">
              <input
                type="checkbox"
                checked={bookSelected}
                disabled={!bookItems.length}
                onChange={(event) => setBookSelected(event.target.checked)}
              />{" "}
              Incluir paquete
            </label>
          )}
        </div>
        {bookItems.length ? (
          <div className="extras-items">
            {bookItems.map((item) => (
              <div key={item.id}>
                <span>
                  <AppIcon name="book" size={18} />
                  {item.productName}
                </span>
                <strong>× {item.quantity}</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            No hay un paquete de libros configurado para este grado. La estación
            de Libros puede crear la orden.
          </p>
        )}
        <div className="extras-total">
          <span>Paquete</span>
          <strong>{money(bookTotal)}</strong>
        </div>
      </section>
      <section className="extras-section">
        <div className="section-row">
          <div>
            <span className="eyebrow">A ELECCIÓN DE LA FAMILIA</span>
            <h3>Uniformes</h3>
          </div>
          {hasUniforms && (
            <span className="status-pill success">Orden creada</span>
          )}
        </div>
        {hasUniforms ? (
          <p className="muted">La orden puede ajustarse en Uniformes.</p>
        ) : (
          <div className="extras-products">
            {uniforms
              .filter((item) => item.active)
              .map((product) => (
                <div key={product.id}>
                  <span className="product-glyph">
                    <AppIcon name="shirt" />
                  </span>
                  <span className="product-copy">
                    <strong>{product.name}</strong>
                    <small>
                      {product.size || "Talla única"} ·{" "}
                      {money(product.unitPrice)}
                    </small>
                  </span>
                  <div className="stepper">
                    <button
                      type="button"
                      onClick={() => quantity(product.id, -1)}
                      aria-label={`Quitar ${product.name}`}
                    >
                      −
                    </button>
                    <output>{uniformQuantities[product.id] || 0}</output>
                    <button
                      type="button"
                      onClick={() => quantity(product.id, 1)}
                      aria-label={`Agregar ${product.name}`}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
        <div className="extras-total">
          <span>Uniformes elegidos</span>
          <strong>{money(uniformTotal)}</strong>
        </div>
      </section>
      {error && (
        <p className="alert-error" role="alert">
          {error}
        </p>
      )}
      <footer className="extras-actions">
        <Link href="/libros" className="button button-soft">
          Ir a Libros
        </Link>
        <button
          className="button button-primary"
          disabled={busy}
          onClick={() => void finish()}
        >
          {busy
            ? "Enviando…"
            : bookSelected || selectedUniforms.length
              ? doneLabel ? "Enviar órdenes y volver" : "Enviar órdenes y terminar"
              : doneLabel || "Terminar sin pedidos"}
          <AppIcon name="arrow" size={18} />
        </button>
      </footer>
    </div>
  );
}
