import { redirect } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { Logo } from "@/components/ui/Logo";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const user = await requireUser({ allowUnonboarded: true });
  if (user.onboarded) redirect("/home");
  return (
    <main className="relative min-h-dvh px-5 pb-20 pt-8">
      <div className="absolute inset-x-0 top-0 h-[60vh] window-light opacity-60" aria-hidden />
      <div className="relative mx-auto mb-14 flex max-w-2xl items-center justify-between"><Link href="/"><Logo /></Link></div>
      <div className="relative"><OnboardingWizard defaultName={user.name ?? ""} /></div>
    </main>
  );
}
