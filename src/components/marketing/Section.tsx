import { cn } from "@/components/ui/cn";

/**
 * A chapter of the page: a hairline across the top, a quiet label in the left margin, the
 * content in the remaining nine columns. The margin is the page's spine; what fills the
 * content column changes with what each chapter has to show.
 */
export function Section({ id, label, children, className, aside, wide }: { id?: string; label?: string; children: React.ReactNode; className?: string; aside?: React.ReactNode; wide?: React.ReactNode }) {
  return (
    <section id={id} aria-label={label} className={cn("scroll-mt-14 border-t border-line section-y", className)}>
      <div className="mx-auto grid max-w-[1240px] gap-y-5 px-5 sm:px-8 lg:grid-cols-12 lg:gap-x-8">
        <div className="lg:col-span-3">
          {label && <p className="text-[13px] font-medium text-mist-400 lg:pt-3">{label}</p>}
          {aside}
        </div>
        <div className="min-w-0 lg:col-span-9">{children}</div>
        {wide && <div className="min-w-0 lg:col-span-12">{wide}</div>}
      </div>
    </section>
  );
}

/** A chapter headline with an optional paragraph beneath; never a restatement of the label. */
export function Heading({ title, children, className }: { title: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("max-w-[44rem]", className)}>
      <h2 className="text-display text-mist-100">{title}</h2>
      {children && <p className="mt-5 max-w-[38rem] text-lead text-mist-300">{children}</p>}
    </div>
  );
}
