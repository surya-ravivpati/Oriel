import { Interviewer } from "@/components/brand/Interviewer";
import { cn } from "./cn";

/** The mark is the Classic interviewer's face, reduced from the avatar renderer's own geometry. */
export function LogoMark({ className, blink, size = 24 }: { className?: string; blink?: boolean; size?: number }) {
  return <Interviewer size={size} waiting={blink} className={cn("w-6", className)} />;
}

/** The wordmark is set in the serif: Oriel speaks in the same voice as its headlines. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-ivory", className)}>
      <LogoMark />
      <span className="font-display text-[1.4375rem] font-medium leading-none tracking-[-0.01em]">Oriel</span>
    </span>
  );
}

/** A waiting state in Oriel's own shape: the face, blinking slowly, with a line beside it. */
export function Thinking({ label, className }: { label: string; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2.5 text-ui text-stone", className)}>
      <LogoMark blink size={20} className="w-5" />
      {label}
    </span>
  );
}
