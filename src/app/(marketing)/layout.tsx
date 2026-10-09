import { getCurrentUser } from "@/lib/auth/session";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <SiteHeader signedIn={!!user} />
      {children}
      <SiteFooter signedIn={!!user} />
    </>
  );
}
