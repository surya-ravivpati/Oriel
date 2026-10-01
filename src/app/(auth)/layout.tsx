import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative grid min-h-dvh place-items-center px-5 py-16">
      <div className="absolute inset-0 window-light opacity-70" aria-hidden />
      <div className="relative w-full max-w-[400px]">
        <Link href="/" className="mb-12 flex justify-center"><Logo /></Link>
        {children}
      </div>
    </main>
  );
}
