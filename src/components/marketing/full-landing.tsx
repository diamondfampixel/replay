import { Hero } from "@/components/marketing/hero";
import {
  AssistantSection, BuildSection, FaqSection, FinalCtaSection, GrowSection,
  IntroSection, OperateSection, PricingSection, ReplaceStackSection,
} from "@/components/marketing/sections";
import { primaryCta } from "@/lib/launch";

/**
 * The full marketing landing — preserved intact. Served at "/" once the
 * launch stage is public, and always previewable at "/product".
 */
export function FullLanding() {
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
