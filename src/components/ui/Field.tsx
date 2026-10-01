import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const control = "w-full rounded-xl bg-white/[0.035] border hairline-strong px-4 text-[15px] text-mist-100 placeholder:text-mist-400 outline-none transition-[border,background,box-shadow] duration-200 focus:border-lume/60 focus:bg-white/[0.05] focus:shadow-[0_0_0_4px_rgba(233,184,114,0.08)]";

export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex items-baseline justify-between mb-2">
      <span className="text-[13px] font-medium text-mist-200">{children}</span>
      {hint && <span className="text-xs text-mist-400">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, "h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(control, "py-3 leading-relaxed resize-y min-h-28", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, "h-11 appearance-none pr-10 cursor-pointer", className)} {...rest}>{children}</select>
      <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-mist-400" width="10" height="6" viewBox="0 0 10 6" aria-hidden><path d="M1 1l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="1.5" /></svg>
    </div>
  );
});

export function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="mt-2 text-[13px] text-signal-bad">{children}</p>;
}

/** Segmented choice (radio group) — used for most setup choices. */
export function Segmented<T extends string>({ value, onChange, options, name, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string; disabled?: boolean }[]; name: string; className?: string }) {
  return (
    <div role="radiogroup" aria-label={name} className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} aria-label={o.hint ? `${o.label} — ${o.hint}` : o.label} disabled={o.disabled} onClick={() => onChange(o.value)}
            className={cn("group rounded-xl border px-3.5 py-2.5 text-left transition-all duration-200 disabled:opacity-35",
              on ? "border-lume/50 bg-lume/[0.08] text-mist-100 shadow-[0_0_0_3px_rgba(233,184,114,0.06)]" : "hairline-strong bg-white/[0.02] text-mist-300 hover:text-mist-100 hover:bg-white/[0.05]")}>
            <span className="block text-sm font-medium">{o.label}</span>
            {o.hint && <span className="block text-xs text-mist-400 mt-0.5 group-aria-checked:text-mist-300">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start justify-between gap-6 py-3", disabled && "opacity-40")}>
      <span>
        <span className="block text-sm text-mist-100">{label}</span>
        {description && <span className="block text-[13px] text-mist-400 mt-1 max-w-prose leading-relaxed">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors duration-300", checked ? "bg-lume" : "bg-white/10")}>
        <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-300 ease-[var(--ease-out-expo)]", checked ? "translate-x-[18px]" : "translate-x-0.5")} />
      </button>
    </label>
  );
}
