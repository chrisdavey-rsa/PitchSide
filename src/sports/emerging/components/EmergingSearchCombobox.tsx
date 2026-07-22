/**
 * Searchable combobox for F1 constructors / golfers (emerging sports only).
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronsUpDown, Search } from 'lucide-react';
import CountryFlag from '../../../components/CountryFlag';

export type ComboboxOption = {
  id: string;
  label: string;
  countryCode?: string | null;
  swatchHex?: string | null;
};

type Props = {
  label: string;
  placeholder?: string;
  options: ComboboxOption[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
};

export default function EmergingSearchCombobox({
  label,
  placeholder = 'Search…',
  options,
  value,
  onChange,
  disabled = false,
}: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full">
      <label className="block text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1.5">
        {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="w-full flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900/80 px-3 py-2.5 text-left text-sm text-slate-200 hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {selected?.swatchHex && (
          <span
            className="h-3 w-3 rounded-full ring-1 ring-white/20 shrink-0"
            style={{ backgroundColor: selected.swatchHex }}
            aria-hidden
          />
        )}
        {selected?.countryCode && (
          <CountryFlag code={selected.countryCode} size={16} alt="" />
        )}
        <span className="flex-1 truncate">
          {selected?.label ?? 'Select…'}
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
      </button>

      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-40 mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden"
        >
          <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
            <Search className="h-3.5 w-3.5 text-slate-500" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-xs text-slate-500">No matches</li>
            )}
            {filtered.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={opt.id === value}
                  onClick={() => {
                    onChange(opt.id);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    opt.id === value
                      ? 'bg-emerald-500/15 text-emerald-200'
                      : 'text-slate-300 hover:bg-slate-900'
                  }`}
                >
                  {opt.swatchHex && (
                    <span
                      className="h-3 w-3 rounded-full ring-1 ring-white/15 shrink-0"
                      style={{ backgroundColor: opt.swatchHex }}
                    />
                  )}
                  {opt.countryCode && (
                    <CountryFlag code={opt.countryCode} size={16} alt="" />
                  )}
                  <span className="truncate">{opt.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
