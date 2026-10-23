"use client";

import { useRef } from "react";
import Image from "next/image";

export function SignaturePad({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string | null;
  onChange: (value: string) => void;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (event.currentTarget.width / rect.width),
      y:
        (event.clientY - rect.top) * (event.currentTarget.height / rect.height),
    };
  }
  return (
    <div className="signature-field">
      <div className="section-row">
        <strong>{label}</strong>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            canvas.current
              ?.getContext("2d")
              ?.clearRect(0, 0, canvas.current.width, canvas.current.height);
            onChange("");
          }}
        >
          Limpiar
        </button>
      </div>
      {value ? (
        <div className="signature-preview">
          <Image
            unoptimized
            src={value}
            width={700}
            height={170}
            alt={`${label} capturada`}
          />
          <button
            type="button"
            className="button button-soft"
            onClick={() => onChange("")}
          >
            Firmar de nuevo
          </button>
        </div>
      ) : (
        <canvas
          ref={canvas}
          width={700}
          height={170}
          aria-label={label}
          onPointerDown={(event) => {
            const context = event.currentTarget.getContext("2d");
            if (!context) return;
            drawing.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            const next = point(event);
            context.beginPath();
            context.moveTo(next.x, next.y);
            context.strokeStyle = "#192236";
            context.lineWidth = 3;
            context.lineCap = "round";
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            const next = point(event);
            const context = event.currentTarget.getContext("2d");
            context?.lineTo(next.x, next.y);
            context?.stroke();
          }}
          onPointerUp={(event) => {
            drawing.current = false;
            event.currentTarget.releasePointerCapture(event.pointerId);
            onChange(event.currentTarget.toDataURL("image/png"));
          }}
          onPointerCancel={() => {
            drawing.current = false;
          }}
        />
      )}
    </div>
  );
}
