import { getCurrentUser } from "@/lib/auth/session";
import { Hero } from "@/components/marketing/Hero";
import { Closing, Feedback, Interviewers, Practice, Pricing, Privacy } from "@/components/marketing/sections";

export default async function Landing() {
  const user = await getCurrentUser();
  const cta = user ? "/practice" : "/signup";
  return (
    <main id="content" tabIndex={-1} className="focus:outline-none overflow-x-clip">
      <Hero cta={cta} signedIn={!!user} />
      <Interviewers />
      <Feedback />
      <Practice />
      <Privacy />
      <Pricing cta={cta} />
      <Closing cta={cta} signedIn={!!user} />
    </main>
  );
}
