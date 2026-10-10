import { getCurrentUser } from "@/lib/auth/session";
import { Hero } from "@/components/marketing/Hero";
import { Closing, Feedback, HowItWorks, Interview, Pricing, Privacy } from "@/components/marketing/sections";

export default async function Landing() {
  const user = await getCurrentUser();
  const cta = user ? "/practice" : "/signup";
  return (
    <main id="content" className="overflow-x-clip">
      <Hero cta={cta} signedIn={!!user} />
      <HowItWorks />
      <Interview />
      <Feedback />
      <Privacy />
      <Pricing cta={cta} />
      <Closing cta={cta} signedIn={!!user} />
    </main>
  );
}
