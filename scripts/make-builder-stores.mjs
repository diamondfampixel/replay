/**
 * Six radically different test stores for Storefront Builder 2.0. Each store
 * is composed by the real engine (direction + DNA + honest brief) and then
 * given store-specific media and a few manual edits — the same path a
 * merchant or the AI designer would take. Run: set -a; . ./.env; set +a; npx tsx scripts/make-builder-stores.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/db.ts";
import { provisionOrganization } from "../src/lib/services/provision.ts";
import { hashPassword } from "../src/lib/auth.ts";
import { slugify } from "../src/lib/utils.ts";
import { resolveTheme } from "../src/lib/storefront/theme.ts";
import { composeHomepage } from "../src/lib/storefront/compose.ts";
import { normaliseSectionConfig } from "../src/lib/storefront/sections.ts";

const PUBLIC = join(process.cwd(), "public", "demo", "builder");
mkdirSync(PUBLIC, { recursive: true });

// --- original placeholder art, brand-toned ---------------------------------
function productSvg({ name, bg, fg, accent, motif }, i) {
  const art = {
    street: `<rect x="120" y="120" width="660" height="660" fill="${accent}" opacity="0.12"/><path d="M200 700 L450 200 L700 700 Z" fill="${accent}" opacity="0.9"/><rect x="380" y="520" width="140" height="180" fill="${bg}"/>`,
    candy: `<circle cx="330" cy="360" r="160" fill="${accent}"/><circle cx="580" cy="520" r="120" fill="${fg}" opacity="0.8"/><circle cx="470" cy="270" r="70" fill="${bg}" opacity="0.9"/><circle cx="640" cy="300" r="40" fill="${accent}" opacity="0.6"/>`,
    skin: `<rect x="360" y="220" width="180" height="460" rx="40" fill="${accent}" opacity="0.85"/><rect x="395" y="170" width="110" height="70" rx="16" fill="${fg}" opacity="0.7"/><circle cx="450" cy="470" r="50" fill="${bg}" opacity="0.5"/>`,
    tech: `<rect x="230" y="290" width="440" height="320" rx="18" fill="${accent}" opacity="0.9"/><rect x="270" y="330" width="360" height="24" rx="6" fill="${bg}" opacity="0.7"/><rect x="270" y="380" width="200" height="24" rx="6" fill="${bg}" opacity="0.5"/><circle cx="600" cy="540" r="30" fill="${fg}" opacity="0.8"/>`,
    leaf: `<path d="M450 160 C 700 300, 700 620, 450 760 C 200 620, 200 300, 450 160 Z" fill="${accent}" opacity="0.85"/><path d="M450 200 L450 720" stroke="${bg}" stroke-width="10" opacity="0.6"/><path d="M450 420 L590 320 M450 520 L310 420" stroke="${bg}" stroke-width="8" opacity="0.5"/>`,
    creator: `<rect x="160" y="200" width="380" height="500" fill="${accent}" opacity="0.9" transform="rotate(-8 350 450)"/><rect x="400" y="260" width="340" height="420" fill="${fg}" opacity="0.75" transform="rotate(6 570 470)"/><circle cx="450" cy="450" r="60" fill="${bg}"/>`,
  }[motif];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 900"><rect width="900" height="900" fill="${bg}"/>${art}<text x="450" y="840" font-family="system-ui,sans-serif" font-size="30" font-weight="600" fill="${fg}" text-anchor="middle" opacity="0.8">${esc(name)}</text></svg>`;
}
function heroSvg({ bg, accent, fg }, variant = 0) {
  const shapes = variant === 0
    ? `<circle cx="1200" cy="300" r="340" fill="${fg}" opacity="0.08"/><circle cx="380" cy="640" r="240" fill="${fg}" opacity="0.06"/>`
    : `<rect x="900" y="120" width="560" height="660" fill="${fg}" opacity="0.07" transform="rotate(12 1180 450)"/><rect x="200" y="500" width="400" height="300" fill="${fg}" opacity="0.05"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${accent}"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/>${shapes}</svg>`;
}
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const svg = (rel, body) => { writeFileSync(join(PUBLIC, rel), body); return `/demo/builder/${rel}`; };

// --- the six brands ---------------------------------------------------------
const BRANDS = [
  {
    key: "voidwear", name: "VOIDWEAR", industry: "Streetwear",
    description: "Heavyweight blackout streetwear in limited runs. No restocks, no compromises, cut for the city after midnight.",
    target: "Streetwear collectors, 18–30.", personality: "Aggressive, monochrome, loud.",
    primary: "#f5f5f5", secondary: "#111111",
    theme: { direction: "energy", neutral: "midnight", accent: "#e8ff2a", headerConfig: { style: "split", navUppercase: true }, footer: { style: "brand", scheme: "base", brandStatement: "Built for after dark." }, product: { layout: "immersive", trustItems: [{ text: "Made in limited runs — no restocks" }, { text: "Free returns within 30 days" }] }, motionConfig: { level: "expressive", reveal: "slide", parallax: true }, collection: { columns: 3, hero: "banner", imageRatio: "tall" } },
    art: { bg: "#0a0a0c", fg: "#f2f2f0", accent: "#e8ff2a", motif: "street" },
    products: [["Blackout Heavyweight Hoodie", 128], ["Division Cargo Pant", 142], ["Midnight Tech Shell", 218], ["Monolith Beanie", 44], ["After-Hours Tee", 58], ["Void Crossbody", 96]],
    collections: [["Drop 04", "drop-04"], ["Essentials", "essentials"]],
    brief: { goal: "launch", tagline: "Drop 04 is live.", facts: { marquee: ["Drop 04 · out now", "400 GSM", "No restocks", "Ships worldwide"], announcement: "Drop 04 — limited to 200 pieces", stats: [{ value: "400", label: "GSM cotton" }, { value: "200", label: "pieces per drop" }, { value: "30", label: "day returns" }] } },
  },
  {
    key: "fizzpop", name: "Fizz & Pop", industry: "Confectionery",
    description: "Small-batch sours, sherbet bombs and cloud floss for people who never grew out of the candy aisle.",
    target: "Gen-Z and millennial snackers.", personality: "Loud, sugary, joyful.",
    primary: "#ff3d8a", secondary: "#5b2bd9",
    theme: { direction: "playful", neutral: "pure", accent: "#ff3d8a", dna: { tone: 100, energy: 85, geometry: 15 }, headerConfig: { style: "centered" }, footer: { style: "centered", scheme: "muted" }, product: { layout: "gallery", trustItems: [{ text: "Vegan options marked on every bag" }, { text: "Mixed to order the day it ships" }] }, motionConfig: { level: "expressive", reveal: "scale" }, cards: { style: "elevated", hover: "lift", align: "center" }, collection: { columns: 4, hero: "text" } },
    art: { bg: "#fff1f7", fg: "#3a0a2a", accent: "#ff3d8a", motif: "candy" },
    products: [["Rainbow Sour Bombs", 8], ["Fizz Pop Sherbet Dip", 6], ["Blue Raspberry Chews", 7], ["Cola Bottle Gummies", 6], ["Watermelon Sour Belts", 7], ["Bubblegum Cloud Floss", 9]],
    collections: [["Sours", "sours"], ["Sweet", "sweet"], ["Gift boxes", "gift-boxes"]],
    brief: { goal: "catalog", tagline: "Turn the sweetness up.", facts: { announcement: "Free chews on orders over $25", marquee: ["Sours", "Chews", "Sherbet", "Floss", "Gift boxes"], benefits: [{ title: "Mixed to order", body: "Every bag is scooped the day it ships.", icon: "sparkles" }, { title: "Wildly sour", body: "We do not do subtle.", icon: "star" }, { title: "Vegan options", body: "Marked on every product.", icon: "leaf" }], faqs: [{ q: "How long does candy stay fresh?", a: "Six weeks sealed; a week once opened, if it lasts that long." }, { q: "Do you ship in summer?", a: "Yes, with cold packs on chocolate-based items." }] } },
  },
  {
    key: "maison-eau", name: "Maison Eau", industry: "Skincare",
    description: "Clinical skincare formulated in Lyon in small batches. Barrier-first, fragrance-free, dated on every box.",
    target: "Considered skincare buyers who read the ingredient list.", personality: "Quiet, expensive, exact.",
    primary: "#9a7b52", secondary: "#2a231b",
    theme: { direction: "luxury", neutral: "warm", accent: "#1f1b17", typography: { display: "cormorant", body: "jost", headingScale: 1.15 }, headerConfig: { style: "centered", navUppercase: true, logoSize: "lg" }, footer: { style: "centered", scheme: "base" }, product: { layout: "stacked", blocks: ["vendor", "title", "price", "variants", "quantityBuy", "description", "details", "share"], trustItems: [{ text: "Formulated and filled in Lyon" }, { text: "Complimentary shipping on orders over €120" }] }, motionConfig: { level: "subtle", reveal: "fade" }, layout: { density: "spacious", width: "narrow" }, collection: { columns: 3, hero: "none", imageRatio: "tall" } },
    art: { bg: "#f4efe7", fg: "#2a231b", accent: "#b9a184", motif: "skin" },
    products: [["Ceramide Barrier Cream", 68], ["Rosehip Renewal Oil", 82], ["Gentle Amino Cleanser", 44], ["Niacinamide Day Fluid", 58], ["Overnight Peptide Mask", 76], ["Hydrating Essence Mist", 48]],
    collections: [["The Ritual", "the-ritual"], ["Barrier", "barrier"]],
    brief: { goal: "story", tagline: "Formulated slowly.", facts: { quote: { quote: "Skincare should be exact, not loud.", author: "Claire Vassal", role: "Founder" } } },
  },
  {
    key: "gridlock", name: "GRIDLOCK", industry: "Gaming peripherals",
    description: "Tournament-grade mice, keyboards and pads with published specs, tested to failure so you do not have to.",
    target: "Competitive PC gamers and sim racers.", personality: "Precise, aggressive, technical.",
    primary: "#5cff8a", secondary: "#0b1020",
    theme: { direction: "technical", neutral: "midnight", accent: "#5cff8a", dna: { expression: 70, energy: 70, edge: 85 }, typography: { display: "unbounded", body: "plexSans", accent: "plexMono", headingTransform: "uppercase" }, headerConfig: { style: "classic", navUppercase: true }, footer: { style: "columns", scheme: "base" }, product: { layout: "stickyInfo", trustItems: [{ text: "2-year warranty on every product" }, { text: "Spec sheets published for everything" }] }, motionConfig: { level: "balanced", reveal: "slide", stagger: true }, cards: { style: "framed", ratio: "landscape", hover: "zoom" }, shape: { radius: "xs" }, collection: { columns: 4, hero: "text" } },
    art: { bg: "#0f1626", fg: "#dce6ff", accent: "#5cff8a", motif: "tech" },
    products: [["Apex 8K Wireless Mouse", 129], ["Sixty-Five Hall Effect Keyboard", 189], ["Glide XL Control Pad", 39], ["Vector Sim Wheel Base", 449], ["Clutch 4K Wireless Headset", 159], ["Pulse Wrist Rest", 29]],
    collections: [["Mice", "mice"], ["Keyboards", "keyboards"], ["Sim racing", "sim-racing"]],
    brief: { goal: "catalog", tagline: "Built to tournament spec.", facts: { announcement: "Free 2-day shipping over $99", benefits: [{ title: "8K polling", body: "0.125 ms report rate on every wireless mouse.", icon: "sparkles" }, { title: "Hall-effect switches", body: "Adjustable actuation, no debounce.", icon: "check" }, { title: "2-year warranty", body: "Replaced, not repaired.", icon: "shield" }, { title: "Published specs", body: "Weight, latency, click force. All of it.", icon: "lock" }], stats: [{ value: "0.125ms", label: "report rate" }, { value: "58g", label: "Apex weight" }, { value: "2 yr", label: "warranty" }], faqs: [{ q: "Which pads suit fast aim?", a: "Glide XL for speed; Control for stopping power. Both are in the spec sheet." }, { q: "Firmware updates?", a: "Free, forever, through the web configurator — no install." }] } },
  },
  {
    key: "fieldnote", name: "Fieldnote Botanics", industry: "Wellness",
    description: "Organic herbal teas, tinctures and balms grown on a small farm in the Blue Mountains and dried within a day of harvest.",
    target: "People who read labels and drink tea slowly.", personality: "Warm, unhurried, honest.",
    primary: "#5b7a3a", secondary: "#2b2a22",
    theme: { direction: "organic", neutral: "sand", accent: "#5b7a3a", dna: { geometry: 5, edge: 10, tone: 55 }, headerConfig: { style: "classic", logoSize: "md" }, footer: { style: "brand", scheme: "muted", brandStatement: "Grown slowly, dried within a day, shipped in paper." }, product: { layout: "mediaLeft", trustItems: [{ text: "Certified organic, harvested on our farm" }, { text: "Plastic-free packaging" }] }, motionConfig: { level: "subtle", reveal: "fade", parallax: false }, cards: { style: "minimal", ratio: "portrait", hover: "swap" }, shape: { radius: "xl" }, buttons: { style: "soft", shape: "pill" }, collection: { columns: 3, hero: "banner" } },
    art: { bg: "#efe9dc", fg: "#2b2a22", accent: "#5b7a3a", motif: "leaf" },
    products: [["Mountain Mint Tea", 14], ["Chamomile Evening Blend", 14], ["Lemon Balm Tincture", 28], ["Calendula Skin Balm", 22], ["Nettle & Oat Infusion", 16], ["Elderflower Cordial", 18]],
    collections: [["Teas", "teas"], ["Tinctures", "tinctures"], ["Balms", "balms"]],
    brief: { goal: "story", tagline: "From our field to your cup.", facts: { benefits: [{ title: "Harvested by hand", body: "Picked at dawn, dried within the day." }, { title: "Certified organic", body: "Since the farm's first season." }, { title: "Paper, not plastic", body: "Every pouch composts." }] } },
  },
  {
    key: "nova-vale", name: "NOVA VALE", industry: "Creator merch",
    description: "Limited merch and prints from Nova Vale — street photographer, 1.2M on the feed, one drop per season.",
    target: "Fans and street-culture collectors.", personality: "Unconventional, personal, visual.",
    primary: "#ff5c1a", secondary: "#101010",
    theme: { direction: "creator", neutral: "ink", accent: "#ff5c1a", dna: { expression: 95, geometry: 35, energy: 80 }, typography: { display: "syne", body: "dmSans", headingScale: 1.25 }, headerConfig: { style: "transparent", logoSize: "lg" }, footer: { style: "minimal", scheme: "base" }, product: { layout: "gallery", trustItems: [{ text: "Signed and numbered prints" }, { text: "Ships within 5 days of the drop closing" }] }, motionConfig: { level: "expressive", reveal: "blur", marqueeSpeed: "fast" }, cards: { style: "overlay", ratio: "portrait", hover: "zoom" }, collection: { columns: 3, hero: "banner", imageRatio: "portrait" } },
    art: { bg: "#141414", fg: "#f4f1ea", accent: "#ff5c1a", motif: "creator" },
    products: [["Season 03 Tee", 45], ["Night Market Print (A2)", 120], ["Vale Cap", 38], ["Zine Vol. 3", 22], ["Film Grain Hoodie", 110], ["Contact Sheet Poster", 60]],
    collections: [["Season 03", "season-03"], ["Prints", "prints"]],
    brief: { goal: "launch", tagline: "Season 03.", facts: { marquee: ["Season 03", "One drop per season", "Signed prints", "Nova Vale"], quote: { quote: "I shoot the city at the hour nobody photographs. These are the frames that stayed.", author: "Nova Vale" }, benefits: [{ title: "Shoot", body: "Three months on the street, one camera." }, { title: "Edit", body: "Twelve frames survive." }, { title: "Print", body: "Signed, numbered, shipped once." }] } },
  },
];

const passwordHash = await hashPassword("builder-demo-2026!");

for (const brand of BRANDS) {
  const existing = await prisma.store.findFirst({ where: { slug: brand.key }, select: { organizationId: true } });
  if (existing) await prisma.organization.delete({ where: { id: existing.organizationId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: `owner-${brand.key}@halyard-demo.dev` } });

  const user = await prisma.user.create({ data: { email: `owner-${brand.key}@halyard-demo.dev`, name: `${brand.name} Owner`, passwordHash, emailVerifiedAt: new Date() } });
  const { store } = await provisionOrganization(prisma, {
    userId: user.id, businessName: brand.name, industry: brand.industry, description: brand.description,
    targetCustomer: brand.target, brandPersonality: brand.personality, primaryColor: brand.primary, secondaryColor: brand.secondary, isDemo: true,
  });
  await prisma.store.update({ where: { id: store.id }, data: { slug: brand.key, theme: brand.theme, status: "ACTIVE" } });

  // Collections + products with brand-toned art
  const collectionIds = {};
  for (const [i, [title, slug]] of brand.collections.entries()) {
    const c = await prisma.collection.create({ data: { storeId: store.id, title, slug, type: "MANUAL", visible: true, position: i, imageUrl: svg(`${brand.key}-col-${slug}.svg`, heroSvg(brand.art, i % 2)) } });
    collectionIds[slug] = c.id;
  }
  const productIds = [];
  for (const [i, [title, price]] of brand.products.entries()) {
    const slug = slugify(title);
    const p = await prisma.product.create({
      data: {
        storeId: store.id, title, slug, status: "ACTIVE", isDemo: true, price, inventory: i === 3 ? 3 : 40, trackInventory: true,
        compareAtPrice: i === 1 ? Math.round(price * 1.25) : null,
        description: `${title} — part of the ${brand.name} range. ${brand.description}`,
        images: { create: [
          { url: svg(`${brand.key}-p${i}-a.svg`, productSvg({ name: title, ...brand.art }, i)), position: 0, alt: `${title}, front` },
          { url: svg(`${brand.key}-p${i}-b.svg`, productSvg({ name: title, ...brand.art, bg: brand.art.accent, accent: brand.art.bg }, i)), position: 1, alt: `${title}, detail` },
        ] },
      },
    });
    productIds.push(p.id);
    const col = brand.collections[i % brand.collections.length][1];
    await prisma.collectionProduct.create({ data: { collectionId: collectionIds[col], productId: p.id, position: i } });
  }

  // Homepage: composed by the engine from direction + DNA + an honest brief.
  const theme = resolveTheme({ theme: brand.theme, primaryColor: brand.primary, secondaryColor: brand.secondary });
  const sections = composeHomepage(theme, {
    name: brand.name, description: brand.description, industry: brand.industry, ...brand.brief,
    catalog: { productCount: productIds.length, collectionSlugs: brand.collections.map(([, s]) => s), featuredProductId: productIds[0], hasReviews: false },
  });
  // Merchant edits: real imagery on the hero and story sections.
  const heroImg = svg(`${brand.key}-hero.svg`, heroSvg(brand.art, 0));
  const altImg = svg(`${brand.key}-alt.svg`, heroSvg(brand.art, 1));
  for (const s of sections) {
    if (s.type === "hero") s.config.media = { ...(s.config.media ?? {}), url: heroImg, alt: `${brand.name} campaign image`, overlay: 35 };
    if (s.type === "imageText") s.config.media = { ...(s.config.media ?? {}), url: altImg, alt: `${brand.name} studio` };
  }
  await prisma.page.deleteMany({ where: { storeId: store.id, type: "HOME" } });
  await prisma.page.create({
    data: {
      storeId: store.id, type: "HOME", title: "Home", slug: "home", published: true, publishedAt: new Date(),
      seoTitle: brand.name, seoDescription: brand.description.slice(0, 155),
      sections: { create: sections.map((s, i) => ({ type: s.type, position: i, visible: true, config: normaliseSectionConfig(s.type, s.config) })) },
    },
  });
  await prisma.navigationItem.deleteMany({ where: { storeId: store.id } });
  await prisma.navigationItem.createMany({ data: [
    { storeId: store.id, label: "Shop", href: "/shop", position: 0, group: "main" },
    ...brand.collections.slice(0, 2).map(([title, slug], i) => ({ storeId: store.id, label: title, href: `/collections/${slug}`, position: i + 1, group: "main" })),
    { storeId: store.id, label: "About", href: "/pages/about", position: 5, group: "main" },
    { storeId: store.id, label: "Contact", href: "/pages/contact", position: 0, group: "footer" },
  ] });
  console.log(`${brand.name.padEnd(20)} /s/${brand.key.padEnd(12)} ${theme.direction.padEnd(10)} ${sections.map((s) => `${s.type}${s.config.layout ? `:${s.config.layout}` : ""}`).join(" > ")}`);
}
process.exit(0);
