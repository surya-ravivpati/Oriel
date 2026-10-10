import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "lume";
type Size = "sm" | "md" | "lg";

/*
 * Rectangular, square-shouldered buttons. One ivory button per view is the rule: it is the
 * thing to do next. Everything else is outlined or plain text. "lume" is kept as an alias
 * of primary for existing call sites.
 */
const base = "relative inline-flex items-center justify-center gap-2 rounded-button font-medium transition-[background-color,color,border-color,opacity,transform] duration-[var(--dur-press)] ease-[var(--ease-state)] active:scale-[0.985] disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap";
const ivory = "bg-mist-100 text-ink-950 hover:bg-mist-200";
const variants: Record<Variant, string> = {
  primary: ivory,
  lume: ivory,
  secondary: "border border-control text-mist-100 hover:border-mist-300 hover:bg-ink-900",
  ghost: "text-mist-300 hover:bg-ink-900 hover:text-mist-100",
  danger: "border border-signal-bad/45 text-signal-bad hover:bg-signal-bad/10",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-[13px]", md: "h-10 px-4 text-[15px]", lg: "h-12 px-5 text-[16px]" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: Size; loading?: boolean }

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="size-3.5 rounded-full border-2 border-current border-r-transparent animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function ButtonLink({ href, variant = "primary", size = "md", className, children, ...rest }: { href: string; variant?: Variant; size?: Size; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...rest}>{children}</Link>;
}

/** An inline link: stone, a 1px underline offset by 0.2em, ivory on hover. */
export function TextLink({ href, children, className, external }: { href: string; children: React.ReactNode; className?: string; external?: boolean }) {
  const cls = cn("text-stone underline decoration-1 underline-offset-[0.2em] transition-colors duration-[var(--dur-press)] hover:text-ivory", className);
  return external ? <a href={href} className={cls}>{children}</a> : <Link href={href} className={cls}>{children}</Link>;
}
