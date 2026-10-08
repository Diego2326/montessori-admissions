"use client";

import { useState } from "react";
import { AppIcon } from "@/components/AppIcon";
import { save } from "@/lib/operations/client";
import { money, type Order } from "@/lib/operations/types";

type Props = {
  order: Order;
  onClose: () => void;
  onEdit: () => void;
  onChanged: () => Promise<void>;
};
export function OrderDetails({ order, onClose, onEdit, onChanged }: Props) {
  const [preparing, setPreparing] = useState<Record<number, number>>(() =>
    Object.fromEntries(
      order.items.map((item) => [item.id, item.preparedQuantity]),
    ),
  );
  const [notes, setNotes] = useState<Record<number, string>>(() =>
    Object.fromEntries(
      order.items.map((item) => [item.id, item.pendingNote || ""]),
    ),
  );
  const [deliveries, setDeliveries] = useState<Record<number, number>>(() =>
    Object.fromEntries(
      order.items.map((item) => [
        item.id,
        Math.max(0, item.preparedQuantity - item.deliveredQuantity),
      ]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const paid = Number(order.balance) <= 0 && order.chargeStatus === "PAID";
  const pending = order.items.filter(
    (item) => item.deliveredQuantity < item.quantity,
  );
  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      await onChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo completar la acción",
      );
    } finally {
      setBusy(false);
    }
  }
  async function prepare() {
    await run(() =>
      save<Order>(
        `admission-stations/${order.station}/orders/${order.id}/prepare`,
        {
          expectedVersion: order.version,
          items: order.items.map((item) => ({
            itemId: item.id,
            quantity: preparing[item.id] ?? item.preparedQuantity,
            pendingNote: notes[item.id] || null,
          })),
        },
      ),
    );
  }
  async function deliver(itemId: number, quantity: number) {
    await run(() =>
      save<Order>(
        `admission-stations/${order.station}/orders/${order.id}/deliver`,
        { expectedVersion: order.version, items: [{ itemId, quantity }] },
      ),
    );
  }
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="touch-modal detail-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Pedido ${order.id}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span className="eyebrow">PEDIDO #{order.id}</span>
            <h2>{order.studentName}</h2>
            <p>
              {order.station === "BOOKS" ? "Libros" : "Uniformes"} ·{" "}
              {new Date(order.createdAt).toLocaleDateString("es-GT")}
            </p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <AppIcon name="close" />
          </button>
        </header>
        <div className="detail-scroll">
          <div className="state-strip">
            <div>
              <small>PAGO</small>
              <strong className={paid ? "text-success" : "text-warning"}>
                {paid ? "Pagado" : "Pendiente"}
              </strong>
            </div>
            <div>
              <small>PREPARACIÓN</small>
              <strong>
                {order.items.every(
                  (item) => item.preparedQuantity >= item.quantity,
                )
                  ? "Lista"
                  : order.items.some((item) => item.preparedQuantity > 0)
                    ? "Parcial"
                    : "Sin iniciar"}
              </strong>
            </div>
            <div>
              <small>ENTREGA</small>
              <strong>
                {pending.length ? `${pending.length} pendientes` : "Completa"}
              </strong>
            </div>
          </div>
          <section className="form-section">
            <div className="section-row">
              <h3>Artículos</h3>
              {!paid && (
                <button className="button button-soft" onClick={onEdit}>
                  Editar orden
                </button>
              )}
            </div>
            <div className="fulfillment-list">
              {order.items.map((item) => (
                <article className="fulfillment-item" key={item.id}>
                  <div className="fulfillment-head">
                    <span className="product-glyph">
                      <AppIcon
                        name={order.station === "BOOKS" ? "book" : "shirt"}
                      />
                    </span>
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.size || item.sku} · {item.quantity} ×{" "}
                        {money(item.unitPrice)}
                      </small>
                    </span>
                    <b>{money(item.subtotal)}</b>
                  </div>
                  <div className="fulfillment-progress">
                    <span>
                      Preparados{" "}
                      <strong>
                        {item.preparedQuantity}/{item.quantity}
                      </strong>
                    </span>
                    <span>
                      Entregados{" "}
                      <strong>
                        {item.deliveredQuantity}/{item.quantity}
                      </strong>
                    </span>
                  </div>
                  {item.preparedQuantity < item.quantity && (
                    <p className="pending-copy">
                      {item.quantity - item.preparedQuantity} pendiente
                      {item.quantity - item.preparedQuantity === 1 ? "" : "s"}{" "}
                      de preparación
                      {item.pendingNote ? ` · ${item.pendingNote}` : ""}
                    </p>
                  )}
                  <div className="fulfillment-actions">
                    <label>
                      Preparar
                      <input
                        type="number"
                        min={item.deliveredQuantity}
                        max={item.quantity}
                        value={preparing[item.id] ?? item.preparedQuantity}
                        onChange={(event) =>
                          setPreparing({
                            ...preparing,
                            [item.id]: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="pending-note">
                      Nota de faltante
                      <input
                        value={notes[item.id] || ""}
                        onChange={(event) =>
                          setNotes({ ...notes, [item.id]: event.target.value })
                        }
                        placeholder="Ej. llega mañana"
                      />
                    </label>
                    {paid && item.preparedQuantity > item.deliveredQuantity && (
                      <>
                        <label>
                          Entregar
                          <input
                            type="number"
                            min={1}
                            max={item.preparedQuantity - item.deliveredQuantity}
                            value={deliveries[item.id] || ""}
                            onChange={(event) =>
                              setDeliveries({
                                ...deliveries,
                                [item.id]: Number(event.target.value),
                              })
                            }
                          />
                        </label>
                        <button
                          className="button button-success"
                          disabled={
                            busy ||
                            !deliveries[item.id] ||
                            deliveries[item.id] >
                              item.preparedQuantity - item.deliveredQuantity
                          }
                          onClick={() =>
                            void deliver(item.id, deliveries[item.id])
                          }
                        >
                          Entregar
                        </button>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
          {order.notes && (
            <section className="form-section">
              <h3>Nota del pedido</h3>
              <p className="detail-note">{order.notes}</p>
            </section>
          )}
          {error && (
            <p className="alert-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="modal-actions">
          <div>
            <small>Total del pedido</small>
            <strong>{money(order.total)}</strong>
          </div>
          <button
            className="button button-primary"
            disabled={busy}
            onClick={() => void prepare()}
          >
            {busy ? "Guardando…" : "Guardar preparación"}
            <AppIcon name="check" size={18} />
          </button>
        </footer>
      </section>
    </div>
  );
}
