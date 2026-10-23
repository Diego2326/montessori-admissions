"use client";

import { useMemo, useState } from "react";
import { useId } from "react";

export type SelectOption = { value: string; label: string };

export function SearchableSelect({ value, options, onChange, placeholder = "Buscar opción…", maxResults = 10 }: {
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  maxResults?: number;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("es");
    return options.filter((option) => !needle || option.label.toLocaleLowerCase("es").includes(needle)).slice(0, maxResults);
  }, [maxResults, options, query]);

  return <div className="searchable-select">
    <input
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listId}
      value={open ? query : selected?.label ?? ""}
      placeholder={placeholder}
      autoComplete="off"
      onFocus={() => { setQuery(""); setOpen(true); }}
      onChange={(event) => { setQuery(event.target.value); setOpen(true); onChange(""); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { setOpen(false); setQuery(""); }
        if (event.key === "Enter" && visible[0]) { event.preventDefault(); onChange(visible[0].value); setOpen(false); setQuery(""); }
      }}
      onBlur={() => window.setTimeout(() => { setOpen(false); setQuery(""); }, 120)}
    />
    {open && <div id={listId} className="searchable-options" role="listbox">
      {visible.length ? visible.map((option) => <button type="button" role="option" aria-selected={option.value === value} key={option.value} onMouseDown={(event) => event.preventDefault()} onClick={() => { onChange(option.value); setOpen(false); setQuery(""); }}>{option.label}</button>) : <span className="searchable-empty">Sin coincidencias en el catálogo</span>}
    </div>}
  </div>;
}
