import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/home");
  return (
    <>
      <h1 className="mb-8 text-center font-display text-4xl">Welcome back.</h1>
      <AuthForm mode="login" />
    </>
  );
}
