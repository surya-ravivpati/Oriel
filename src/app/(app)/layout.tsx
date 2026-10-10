import { requireUser } from "@/lib/auth/session";
import { providerStatus } from "@/lib/ai/providers/registry";
import { AppNav } from "@/components/app/AppNav";
import { MotionProvider } from "@/components/ui/MotionProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const providers = providerStatus();
  // The motion library loads only where it animates: the signed-in app and onboarding, never the landing page.
  return (
    <MotionProvider>
      <AppNav isAdmin={user.role === "admin"} name={user.name} mockProviders={providers.llmMock} />
      <main className="mx-auto max-w-[1200px] px-5 pb-28 pt-8 sm:px-8 sm:pt-12">{children}</main>
    </MotionProvider>
  );
}
