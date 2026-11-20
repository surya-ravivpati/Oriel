import { getCurrentUser } from "@/lib/auth/session";
import { Hero } from "@/components/marketing/Hero";
import { Measures, Pricing, Privacy, Session } from "@/components/marketing/sections";

export default async function Landing() {
  const user = await getCurrentUser();
  const cta = user ? "/home" : "/signup";
  return (
    <main id="content" tabIndex={-1} className="focus:outline-none overflow-x-clip">
      <Hero cta={cta} signedIn={!!user} />
      <Session />
      <Measures />
      <Privacy />
      <Pricing cta={cta} signedIn={!!user} />
    </main>
  );
}
