import { Hero } from "@/components/marketing/hero";
import { HeroConceptB, HeroConceptC } from "@/components/marketing/hero-concepts";

/**
 * Design-decision route: the three hero concepts stacked for comparison.
 * Unlinked and excluded from the sitemap; contains only demo-brand data.
 */
export const metadata = { title: "Hero concepts", robots: { index: false } };

export default function HeroConceptsPage() {
  return (
    <div className="bg-night-950">
      <p className="bg-night-800 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-night-muted">Concept A — the OS assembles a business (production candidate)</p>
      <Hero cta={{ label: "Join the waitlist", kind: "waitlist" }} />
      <p className="bg-night-800 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-night-muted">Concept B — command-driven transformation</p>
      <HeroConceptB />
      <p className="bg-night-800 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-night-muted">Concept C — minimal with dramatic product window</p>
      <HeroConceptC />
    </div>
  );
}
