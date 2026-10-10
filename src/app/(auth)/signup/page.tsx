import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/home");
  return (
    <>
      <h1 className="text-title text-ivory">Start practicing.</h1>
      <p className="mb-9 mt-2 text-body text-stone">Free to try. No card required.</p>
      <AuthForm mode="signup" />
    </>
  );
}
