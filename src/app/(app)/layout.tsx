import { requireUser } from "@/lib/auth/session";
import { providerStatus } from "@/lib/ai/providers/registry";
import { AppNav } from "@/components/app/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const providers = providerStatus();
  return (
    <>
      <AppNav isAdmin={user.role === "admin"} name={user.name} mockProviders={providers.llmMock} />
      <main className="mx-auto max-w-7xl px-5 pb-24 pt-10 sm:px-8">{children}</main>
    </>
  );
}
