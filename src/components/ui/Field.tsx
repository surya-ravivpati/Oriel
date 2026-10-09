import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const control = "w-full rounded-md border border-line-strong bg-ink-900 px-3.5 text-[16px] text-mist-100 placeholder:text-mist-400 outline-none transition-[border-color,background-color] duration-150 hover:border-ink-500 focus:border-lume focus-visible:outline-none aria-[invalid=true]:border-signal-bad disabled:opacity-50";

export function Label({ children, htmlFor, hint }: { children: React.ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 flex items-baseline justify-between gap-4">
      <span className="text-[14px] font-medium text-mist-200">{children}</span>
      {hint && <span className="text-[13px] text-mist-400">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(control, "h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-28 resize-y py-3 leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, "h-11 cursor-pointer appearance-none pr-10", className)} {...rest}>{children}</select>
      <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-mist-300" width="12" height="8" viewBox="0 0 12 8" aria-hidden><path d="M1 1.5 6 6.5l5-5" stroke="currentColor" fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </div>
  );
});

export function FieldError({ children, id }: { children?: React.ReactNode; id?: string }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-2 flex items-start gap-2 text-[14px] leading-snug text-signal-bad">
      <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden className="mt-[2px] shrink-0"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.4" fill="none" /><path d="M8 4.5v4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="8" cy="11.2" r="0.9" fill="currentColor" /></svg>
      <span>{children}</span>
    </p>
  );
}

const Check = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden><path d="M2.5 6.3 5 8.7l4.6-5.2" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/**
 * A single choice. Short options are a row of square-shouldered buttons; options with a hint
 * become tiles with room to explain themselves. The chosen one is outlined in gold on bronze.
 */
export function Segmented<T extends string>({ value, onChange, options, name, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string; disabled?: boolean }[]; name: string; className?: string }) {
  const tiles = options.some((o) => o.hint);
  return (
    <div role="radiogroup" aria-label={name} className={cn(tiles ? "grid gap-2 sm:grid-cols-2" : "flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return tiles ? (
          <button key={o.value} type="button" role="radio" aria-checked={on} aria-label={o.hint ? `${o.label}, ${o.hint}` : o.label} disabled={o.disabled} onClick={() => onChange(o.value)}
            className={cn("relative rounded-lg border px-3.5 py-3 text-left transition-[background-color,border-color] duration-150 disabled:opacity-35",
              on ? "border-lume bg-bronze" : "border-line-strong hover:border-ink-500 hover:bg-ink-900")}>
            <span className={cn("absolute right-3 top-3 grid size-4 place-items-center rounded-sm border transition-colors duration-150", on ? "border-lume bg-lume text-ink-950" : "border-ink-500 text-transparent")}><Check /></span>
            <span className={cn("block pr-7 text-[15px] font-medium", on ? "text-mist-100" : "text-mist-200")}>{o.label}</span>
            {o.hint && <span className="mt-1 block pr-5 text-[13px] leading-snug text-mist-400">{o.hint}</span>}
          </button>
        ) : (
          <button key={o.value} type="button" role="radio" aria-checked={on} aria-label={o.label} disabled={o.disabled} onClick={() => onChange(o.value)}
            className={cn("h-9 rounded-md border px-3.5 text-[14px] font-medium transition-[background-color,border-color,color] duration-150 disabled:opacity-35",
              on ? "border-lume bg-bronze text-lume-soft" : "border-line-strong text-mist-300 hover:border-ink-500 hover:text-mist-100")}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  return (
    <label className={cn("flex items-start justify-between gap-6 py-4", disabled && "opacity-40")}>
      <span>
        <span className="block text-[15px] font-medium text-mist-100">{label}</span>
        {description && <span className="mt-1 block max-w-prose text-[13px] leading-relaxed text-mist-400">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 h-6 w-10 shrink-0 rounded-full border transition-colors duration-200", checked ? "border-lume bg-lume" : "border-line-strong bg-ink-700")}>
        <span className={cn("absolute left-[2px] top-[2px] size-[18px] rounded-full transition-transform duration-200 ease-[var(--ease-out-expo)]", checked ? "translate-x-4 bg-ink-950" : "translate-x-0 bg-mist-300")} />
      </button>
    </label>
  );
}
