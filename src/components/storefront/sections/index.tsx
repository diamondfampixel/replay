import type { StorefrontStore } from "@/lib/storefront/data";
import { SECTION_META, normaliseSectionConfig, type SectionConfig, type SectionType } from "@/lib/storefront/sections";
import { Announcement, Hero, ImageHero, Marquee, VideoHero } from "@/components/storefront/sections/hero";
import { CollectionGrid, CollectionHero, FeaturedProduct, FeaturedProducts } from "@/components/storefront/sections/commerce";
import { Benefits, Faq, FullImage, Gallery, ImageText, Text } from "@/components/storefront/sections/content";
import { LogoList, Quote, Reviews, Stats, Story, Testimonials } from "@/components/storefront/sections/proof";
import { CustomBanner, Newsletter, ValueProps } from "@/components/storefront/sections/conversion";

export type RenderedSection = {
  id: string;
  type: string;
  visible: boolean;
  config: Record<string, unknown>;
};

/**
 * Renders one stored section. Every section type resolves its own data on the
 * server, so a section added by the AI or the visual editor is live on the next
 * request with no code change. Each type has one or more compositions
 * (`layout`) and reads the shared `design` object through SectionShell.
 */
export async function SectionRenderer({
  section, store, preview = false, index,
}: {
  section: RenderedSection;
  store: StorefrontStore;
  preview?: boolean;
  index?: number;
}) {
  const type = section.type as SectionType;
  if (!SECTION_META[type]) return null;
  const config = normaliseSectionConfig(section.type, section.config);
  const shell = {
    theme: store.theme, id: section.id, index, preview,
    label: preview ? SECTION_META[type].label : undefined,
  };
  const ctx = { s: store.slug, store, theme: store.theme, shell, preview };
  const c = config as never;

  switch (type) {
    case "announcement": return <Announcement c={c as SectionConfig<"announcement">} ctx={ctx} />;
    case "hero": return <Hero c={c as SectionConfig<"hero">} ctx={ctx} />;
    case "imageHero": return <ImageHero c={c as SectionConfig<"imageHero">} ctx={ctx} />;
    case "videoHero": return <VideoHero c={c as SectionConfig<"videoHero">} ctx={ctx} />;
    case "marquee": return <Marquee c={c as SectionConfig<"marquee">} ctx={ctx} />;
    case "featuredProducts": return <FeaturedProducts c={c as SectionConfig<"featuredProducts">} ctx={ctx} type="featuredProducts" />;
    case "productGrid": return <FeaturedProducts c={{ ...(c as SectionConfig<"productGrid">), layout: "grid", source: "newest", collectionSlug: "", productIds: [], subheading: "", ctaLabel: "", ctaHref: "/shop" }} ctx={ctx} type="productGrid" />;
    case "featuredProduct": return <FeaturedProduct c={c as SectionConfig<"featuredProduct">} ctx={ctx} />;
    case "collectionGrid": return <CollectionGrid c={c as SectionConfig<"collectionGrid">} ctx={ctx} />;
    case "collectionHero": return <CollectionHero c={c as SectionConfig<"collectionHero">} ctx={ctx} />;
    case "text": return <Text c={c as SectionConfig<"text">} ctx={ctx} />;
    case "imageText": return <ImageText c={c as SectionConfig<"imageText">} ctx={ctx} />;
    case "gallery": return <Gallery c={c as SectionConfig<"gallery">} ctx={ctx} />;
    case "fullImage": return <FullImage c={c as SectionConfig<"fullImage">} ctx={ctx} />;
    case "stats": return <Stats c={c as SectionConfig<"stats">} ctx={ctx} />;
    case "logoList": return <LogoList c={c as SectionConfig<"logoList">} ctx={ctx} />;
    case "quote": return <Quote c={c as SectionConfig<"quote">} ctx={ctx} />;
    case "story": return <Story c={c as SectionConfig<"story">} ctx={ctx} />;
    case "benefits": return <Benefits c={c as SectionConfig<"benefits">} ctx={ctx} />;
    case "testimonials": return <Testimonials c={c as SectionConfig<"testimonials">} ctx={ctx} />;
    case "reviews": return <Reviews c={c as SectionConfig<"reviews">} ctx={ctx} />;
    case "faq": return <Faq c={c as SectionConfig<"faq">} ctx={ctx} />;
    case "newsletter": return <Newsletter c={c as SectionConfig<"newsletter">} ctx={ctx} />;
    case "customBanner": return <CustomBanner c={c as SectionConfig<"customBanner">} ctx={ctx} />;
    case "valueProps": return <ValueProps c={c as SectionConfig<"valueProps">} ctx={ctx} />;
    default: return null;
  }
}
