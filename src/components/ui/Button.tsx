import { forwardRef, type ButtonHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "lume";
type Size = "sm" | "md" | "lg";

const base = "relative inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-[-0.01em] transition-[background,color,box-shadow,transform,opacity] duration-300 ease-[var(--ease-out-expo)] disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] select-none whitespace-nowrap";
const variants: Record<Variant, string> = {
  primary: "bg-mist-100 text-ink-950 hover:bg-white shadow-[0_1px_0_rgba(255,255,255,0.4)_inset,0_8px_24px_-8px_rgba(255,255,255,0.25)]",
  lume: "bg-lume text-ink-950 hover:bg-lume-soft shadow-[0_0_0_1px_rgba(255,255,255,0.15)_inset,0_10px_40px_-10px_rgba(233,184,114,0.7)]",
  secondary: "bg-white/[0.06] text-mist-100 hover:bg-white/[0.1] border hairline-strong",
  ghost: "text-mist-300 hover:text-mist-100 hover:bg-white/[0.05]",
  danger: "bg-signal-bad/15 text-signal-bad hover:bg-signal-bad/25 border border-signal-bad/30",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3.5 text-[13px]", md: "h-10 px-5 text-sm", lg: "h-12 px-7 text-[15px]" };

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
