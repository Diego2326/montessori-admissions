"use client";

import { useState } from "react";

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
}: {
  label: string;
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  minYear: number;
  maxYear: number;
}) {
  const [parts, setParts] = useState<Parts>(() => parseDate(value));

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

  return (
    <div className="field-label date-field">
      <span>{label}</span>
      <div className="date-parts">
        <label>
          Año
          <select aria-label={`${label}: año`} value={parts.year} onChange={(event) => choose("year", event.target.value)}>
            <option value="">Año</option>
            {years.map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label>
          Mes
          <select aria-label={`${label}: mes`} value={parts.month} onChange={(event) => choose("month", event.target.value)}>
            <option value="">Mes</option>
            {months.map((month, index) => <option key={month} value={index + 1}>{month}</option>)}
          </select>
        </label>
        <label>
          Día
          <select aria-label={`${label}: día`} value={parts.day} onChange={(event) => choose("day", event.target.value)}>
            <option value="">Día</option>
            {Array.from({ length: maxDay }, (_, index) => index + 1).map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}
