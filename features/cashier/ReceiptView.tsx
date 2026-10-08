"use client";

import { AppIcon } from "@/components/AppIcon";
import { money, type Receipt } from "@/lib/operations/types";

export function ReceiptView({
  receipt,
  onClose,
}: {
  receipt: Receipt;
  onClose: () => void;
}) {
  const groups = Object.values(
    receipt.lines.reduce<
      Record<number, { name: string; lines: Receipt["lines"] }>
    >((map, line) => {
      (map[line.studentId] ??= {
        name: line.studentName,
        lines: [],
      }).lines.push(line);
      return map;
    }, {}),
  );
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="touch-modal receipt-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`Recibo ${receipt.receiptNumber}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header no-print">
          <div>
            <span className="eyebrow">PAGO CONFIRMADO</span>
            <h2>Recibo</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <AppIcon name="close" />
          </button>
        </header>
        <div className="receipt-sheet">
          <div className="receipt-brand">
            <span>
              <AppIcon name="spark" size={30} />
            </span>
            <div>
              <strong>Montessori Zacapa</strong>
              <small>Recibo de caja</small>
            </div>
          </div>
          <div className="receipt-meta">
            <div>
              <small>NÚMERO</small>
              <strong>{receipt.receiptNumber}</strong>
            </div>
            <div>
              <small>FECHA</small>
              <strong>
                {new Date(receipt.paidAt).toLocaleString("es-GT")}
              </strong>
            </div>
          </div>
          {groups.map((group) => (
            <section className="receipt-group" key={group.name}>
              <h3>{group.name}</h3>
              {group.lines.map((line, index) => (
                <div key={`${line.description}-${index}`}>
                  <span>{line.description}</span>
                  <strong>{money(line.amount)}</strong>
                </div>
              ))}
            </section>
          ))}
          <div className="receipt-total">
            <span>Total recibido</span>
            <strong>{money(receipt.amount)}</strong>
          </div>
          <div className="receipt-method">
            <span>Método: {receipt.method}</span>
            {receipt.externalReference && (
              <span>Referencia: {receipt.externalReference}</span>
            )}
          </div>
          <p className="receipt-thanks">Gracias por su pago.</p>
        </div>
        <footer className="modal-actions no-print">
          <button className="button button-soft" onClick={onClose}>
            Cerrar
          </button>
          <button
            className="button button-primary"
            onClick={() => window.print()}
          >
            <AppIcon name="receipt" size={18} /> Imprimir recibo
          </button>
        </footer>
      </section>
    </div>
  );
}
