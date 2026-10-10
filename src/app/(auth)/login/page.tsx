import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/home");
  return (
    <>
      <h1 className="text-title text-ivory">Welcome back.</h1>
      <p className="mb-9 mt-2 text-body text-stone">Pick up where you left off.</p>
      <AuthForm mode="login" />
    </>
  );
}
