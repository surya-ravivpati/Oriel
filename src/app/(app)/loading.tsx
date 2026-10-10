import { Thinking } from "@/components/ui/Logo";

/** Shown only when a page takes a moment: it fades in after a short delay, so quick navigations never flash it. */
export default function Loading() {
  return (
    <div className="grid min-h-[40vh] place-items-center opacity-0 motion-safe:animate-[fade-in_var(--dur-panel)_var(--ease-enter)_400ms_forwards] motion-reduce:opacity-100">
      <Thinking label="Loading" />
    </div>
  );
}
