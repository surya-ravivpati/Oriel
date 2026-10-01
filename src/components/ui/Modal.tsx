"use client";
import { useEffect, useRef } from "react";
import { cn } from "./cn";

/** Accessible modal built on <dialog> (focus trap + Esc handled by the browser). */
export function Modal({ open, onClose, title, children, className, dismissible = true }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; className?: string; dismissible?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} aria-label={title} onCancel={(e) => { if (!dismissible) e.preventDefault(); else onClose(); }}
      className={cn("m-auto w-[min(560px,calc(100vw-32px))] max-h-[calc(100dvh-48px)] overflow-hidden rounded-3xl border hairline-strong bg-ink-850/95 p-0 text-mist-100 shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] backdrop:bg-black/70 backdrop:backdrop-blur-sm open:animate-[rise_500ms_var(--ease-out-expo)]", className)}>
      {open && children}
    </dialog>
  );
}
