"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  badge?: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  placeholder?: string;
  className?: string;
  menuClassName?: string;
  ariaLabel?: string;
}

/**
 * Apple Liquid Glass dropdown menu replacing unstyled native <select> popups.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select an option...",
  className,
  menuClassName,
  ariaLabel,
}: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((opt) => opt.value === value);

  React.useEffect(() => {
    if (!open) return;
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", open && "z-40", className)}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white/85 backdrop-blur-md px-3.5 text-xs font-medium text-slate-800 shadow-2xs transition-all cursor-pointer",
          "hover:bg-white hover:border-slate-300/90",
          "focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-[#0071e3]",
          open && "bg-white border-[#0071e3] ring-2 ring-blue-500/20"
        )}
      >
        <span className="truncate text-left">
          {selected ? selected.label : placeholder}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {selected?.badge && (
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
              {selected.badge}
            </span>
          )}
          <ChevronDown
            className={cn(
              "w-3.5 h-3.5 text-slate-400 transition-transform duration-150",
              open && "rotate-180 text-[#0071e3]"
            )}
          />
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className={cn(
            "absolute left-0 mt-1.5 w-full min-w-[200px] z-50 rounded-2xl border border-slate-200/85 bg-white/95 backdrop-blur-2xl p-1.5 shadow-[0_16px_40px_-10px_rgba(15,23,42,0.16)] ring-1 ring-black/[0.04]",
            menuClassName
          )}
        >
          <div className="space-y-0.5 max-h-64 overflow-y-auto">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-all cursor-pointer",
                    isSelected
                      ? "bg-blue-50/90 text-[#0071e3]"
                      : "text-slate-700 hover:bg-slate-100/85 hover:text-slate-900"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className={cn("text-xs truncate", isSelected ? "font-semibold" : "font-medium")}>
                      {option.label}
                    </div>
                    {option.description && (
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {option.description}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {option.badge && (
                      <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                        {option.badge}
                      </span>
                    )}
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#0071e3] shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
