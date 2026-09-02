import { Hero } from "@/components/marketing/hero";
import {
  AssistantSection, BuildSection, FaqSection, FinalCtaSection, GrowSection,
  IntroSection, OperateSection, PricingSection, ReplaceStackSection,
} from "@/components/marketing/sections";
import { primaryCta } from "@/lib/launch";

export const dynamic = "force-dynamic";

export default function LandingPage() {
  const cta = primaryCta();
  return (
    <main>
      <Hero cta={cta} />
      <IntroSection />
      <AssistantSection />
      <BuildSection />
      <OperateSection />
      <GrowSection />
      <ReplaceStackSection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection cta={cta} />
    </main>
  );
}
