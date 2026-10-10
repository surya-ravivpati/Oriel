import { getCurrentUser } from "@/lib/auth/session";
import { Hero } from "@/components/marketing/Hero";
import { Session } from "@/components/marketing/Session";
import { Cast, Closing, Pricing, Privacy, Why } from "@/components/marketing/Chapters";

export default async function Landing() {
  const user = await getCurrentUser();
  const cta = user ? "/practice" : "/signup";
  return (
    <main id="content" className="overflow-x-clip">
      <Hero cta={cta} signedIn={!!user} />
      <Why />
      <Session />
      <Cast />
      <Privacy />
      <Pricing cta={cta} />
      <Closing cta={cta} signedIn={!!user} />
    </main>
  );
}
