import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const user = await requireUser({ allowUnonboarded: true });
  if (user.onboarded) redirect("/home");
  return <OnboardingWizard defaultName={user.name ?? ""} />;
}
