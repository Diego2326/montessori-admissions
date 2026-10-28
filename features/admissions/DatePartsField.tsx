"use client";

import { useEffect, useState } from "react";

type Parts = { year: string; month: string; day: string };

const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function parseDate(value: string | null | undefined): Parts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  return match
    ? { year: match[1], month: String(Number(match[2])), day: String(Number(match[3])) }
    : { year: "", month: "", day: "" };
}

function daysInMonth(year: string, month: string): number {
  if (!month) return 31;
  return new Date(Number(year) || 2024, Number(month), 0).getDate();
}

export function DatePartsField({
  label,
  value,
  onChange,
  minYear,
  maxYear,
  order = "year-month-day",
  required = false,
  optional = false,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  minYear: number;
  maxYear: number;
  order?: "year-month-day" | "day-month-year";
  required?: boolean;
  optional?: boolean;
}) {
  const [parts, setParts] = useState<Parts>(() => parseDate(value));

  useEffect(() => {
    setParts(parseDate(value));
  }, [value]);

  const selectedYear = Number(parts.year);
  const years = Array.from(
    { length: maxYear - minYear + 1 },
    (_, index) => maxYear - index,
  );
  if (selectedYear && !years.includes(selectedYear)) years.push(selectedYear);
  years.sort((a, b) => b - a);

  const maxDay = daysInMonth(parts.year, parts.month);
  function choose(part: keyof Parts, selected: string) {
    const next = { ...parts, [part]: selected };
    const lastDay = daysInMonth(next.year, next.month);
    if (Number(next.day) > lastDay) next.day = String(lastDay);
    setParts(next);
    onChange(
      next.year && next.month && next.day
        ? `${next.year}-${next.month.padStart(2, "0")}-${next.day.padStart(2, "0")}`
        : null,
    );
  }

  const partsOrder: Array<keyof Parts> = order === "day-month-year" ? ["day", "month", "year"] : ["year", "month", "day"];
  const labels: Record<keyof Parts, string> = { year: "Año", month: "Mes", day: "Día" };

  return (
    <div className="field-label date-field">
      <span>{label}{required && <b className="public-pre-required" aria-hidden="true"> *</b>}{optional && <small className="public-pre-optional">Opcional</small>}</span>
      <div className="date-parts">
        {partsOrder.map((part) => <label key={part}>
          {labels[part]}
          <select aria-label={`${label}: ${labels[part].toLocaleLowerCase("es")}`} value={parts[part]} onChange={(event) => choose(part, event.target.value)}>
            <option value="">{labels[part]}</option>
            {part === "year" && years.map((year) => <option key={year} value={year}>{year}</option>)}
            {part === "month" && months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
            {part === "day" && Array.from({ length: maxDay }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </label>)}
      </div>
    </div>
  );
}
