import type { Prisma } from "@/generated/prisma/client";

export type SectionSeed = { type: string; config: Prisma.InputJsonValue; visible?: boolean };

/**
 * Default homepage layout produced for every new store. The AI store builder
 * writes the same shape — sections are data, never generated source code.
 */
export function defaultHomepageSections(store: {
  name: string;
  description?: string | null;
  primaryColor?: string;
}): SectionSeed[] {
  const name = store.name;
  return [
    {
      type: "announcement",
      config: {
        text: "Free shipping on orders over $75",
        link: "/shop",
        background: "ink",
      },
    },
    {
      type: "hero",
      config: {
        headline: "Everyday things, built properly.",
        subheadline:
          store.description ??
          `${name} makes a small range of essentials and makes each one well.`,
        ctaLabel: "Shop the range",
        ctaHref: "/shop",
        secondaryCtaLabel: "Our story",
        secondaryCtaHref: "/pages/about",
        align: "left",
        background: "muted",
        imageUrl: null,
        height: "large",
      },
    },
    {
      type: "benefits",
      config: {
        heading: null,
        items: [
          { title: "Made in small batches", body: "Short runs with mills we have worked with for years." },
          { title: "Free returns for 60 days", body: "If it does not fit, send it back. No forms." },
          { title: "Repair, don't replace", body: "We will fix seams and hardware for as long as we make it." },
        ],
      },
    },
    {
      type: "featuredProducts",
      config: {
        heading: "Best sellers",
        subheading: "What people keep coming back for.",
        source: "collection",
        collectionSlug: "best-sellers",
        limit: 4,
        layout: "grid",
      },
    },
    {
      type: "imageText",
      config: {
        heading: "A shorter list, chosen carefully",
        body:
          "We would rather make twenty things properly than two hundred adequately. Every piece in the range earns its place, and anything that stops earning it gets retired.",
        ctaLabel: "Read more",
        ctaHref: "/pages/about",
        imagePosition: "right",
        imageUrl: null,
      },
    },
    {
      type: "collectionGrid",
      config: {
        heading: "Shop by collection",
        collectionSlugs: ["fleece", "carry", "new-arrivals"],
      },
    },
    {
      type: "reviews",
      config: {
        heading: "What customers say",
        limit: 3,
        minRating: 4,
      },
    },
    {
      type: "faq",
      config: {
        heading: "Common questions",
        items: [
          { q: "How long does shipping take?", a: "Orders ship within one business day. Domestic delivery is typically 2–5 business days." },
          { q: "What is your return policy?", a: "Sixty days, unworn, in original packaging. Return shipping is on us." },
          { q: "Do you ship internationally?", a: "We ship to Canada, the UK and the EU. Duties are calculated at checkout." },
        ],
      },
    },
    {
      type: "newsletter",
      config: {
        heading: "Get the restock notes",
        body: "One email when something returns or something new lands. Nothing else.",
        buttonLabel: "Subscribe",
      },
    },
  ];
}

export const DEMO_CONTENT_PAGES: Array<{
  title: string;
  slug: string;
  body: string;
  showInNav?: boolean;
  seoDescription?: string;
}> = [
  {
    title: "About",
    slug: "about",
    showInNav: true,
    seoDescription: "How Northwind Supply Co. is put together and why the range is deliberately small.",
    body: `<h2>Why the list is short</h2>
<p>Northwind Supply Co. started in a garage in Portland with two products and a stubborn belief that most brands make far too many things. Nine years later we make around twenty-five, and we still argue about every addition.</p>
<h2>How we work</h2>
<p>We work directly with three mills and one leather workshop. Runs are small, which costs more per unit, but it means we can fix a pattern between batches instead of living with it for a year.</p>
<ul><li>Fabric is chosen for how it behaves after fifty washes, not on the roll.</li><li>Hardware is metal wherever metal makes sense.</li><li>Anything that stops selling gets retired rather than discounted forever.</li></ul>
<h2>Repairs</h2>
<p>If a seam goes or a zip fails on something we still make, send it to us. We will repair it and send it back.</p>`,
  },
  {
    title: "Contact",
    slug: "contact",
    showInNav: true,
    body: `<p>We answer email within one business day, usually faster.</p>
<h2>Customer support</h2>
<p>For orders, returns and sizing: <a href="mailto:support@northwindsupply.test">support@northwindsupply.test</a></p>
<h2>Wholesale and press</h2>
<p><a href="mailto:trade@northwindsupply.test">trade@northwindsupply.test</a></p>
<h2>Post</h2>
<p>Northwind Supply Co.<br/>1180 NW Kearney St<br/>Portland, OR 97209</p>`,
  },
  {
    title: "FAQ",
    slug: "faq",
    showInNav: true,
    body: `<h2>Shipping</h2>
<p>Orders placed before 2pm PT ship the same business day. Standard domestic delivery is 2–5 business days; express is 1–2.</p>
<h2>Sizing</h2>
<p>Our fleece runs slightly boxy. If you are between sizes and prefer a closer fit, size down. Every product page carries a measured size table.</p>
<h2>Returns</h2>
<p>Sixty days, unworn, original packaging, return shipping paid by us.</p>
<h2>Care</h2>
<p>Cold wash, hang dry. Waxed canvas should be brushed rather than washed, and re-waxed once a year.</p>`,
  },
  {
    title: "Shipping",
    slug: "shipping",
    body: `<h2>Rates</h2>
<p>Standard shipping is $6.95 and free on orders over $75. Express is $18.</p>
<h2>Timelines</h2>
<p>Standard: 2–5 business days. Express: 1–2 business days. International: 6–14 business days depending on destination and customs.</p>
<h2>Tracking</h2>
<p>A tracking number is emailed as soon as the parcel is scanned by the carrier.</p>`,
  },
  {
    title: "Returns",
    slug: "returns",
    body: `<h2>The policy</h2>
<p>Return anything unworn within sixty days for a full refund. We pay return shipping on domestic orders.</p>
<h2>How to start one</h2>
<p>Email <a href="mailto:support@northwindsupply.test">support@northwindsupply.test</a> with your order number. We will send a prepaid label.</p>
<h2>Exchanges</h2>
<p>Exchanges are processed as a return plus a new order so you are not waiting on stock to move twice.</p>`,
  },
  {
    title: "Privacy",
    slug: "privacy",
    body: `<p>This is demo content for a development store and is not legal advice or a real privacy policy.</p>
<h2>What we collect</h2>
<p>Order details, contact information you provide, and anonymous analytics about how the store is used.</p>
<h2>What we do not do</h2>
<p>We do not sell customer data.</p>
<h2>Contact</h2>
<p>Questions about data: <a href="mailto:privacy@northwindsupply.test">privacy@northwindsupply.test</a></p>`,
  },
  {
    title: "Terms",
    slug: "terms",
    body: `<p>This is demo content for a development store and is not legal advice or an enforceable terms of service.</p>
<h2>Orders</h2>
<p>Placing an order is an offer to buy; we accept it when the order ships.</p>
<h2>Pricing</h2>
<p>Prices are shown in US dollars and exclude any duties owed on international delivery.</p>`,
  },
];
