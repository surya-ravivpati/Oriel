import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { MotionProvider } from "@/components/ui/MotionProvider";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const user = await requireUser({ allowUnonboarded: true });
  if (user.onboarded) redirect("/home");
  return <MotionProvider><OnboardingWizard defaultName={user.name ?? ""} /></MotionProvider>;
}
