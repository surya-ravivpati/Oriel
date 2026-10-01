import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/home");
  return (
    <>
      <h1 className="mb-3 text-center font-display text-4xl">Start practicing.</h1>
      <p className="mb-8 text-center text-sm text-mist-400">Free to try. No card required.</p>
      <AuthForm mode="signup" />
    </>
  );
}
