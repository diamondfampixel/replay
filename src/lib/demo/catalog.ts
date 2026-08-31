/** Static definition of the seeded demo business (Northwind Supply Co.). */

export type DemoVariantAxis = { name: string; values: string[] };

export type DemoProduct = {
  title: string;
  category: string; // category slug
  price: number;
  compareAtPrice?: number;
  cost: number;
  vendor: string;
  tags: string[];
  description: string;
  inventory: number;
  axes?: DemoVariantAxis[];
  /** relative demand weight — drives seeded order distribution */
  weight: number;
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
};

export const DEMO_CATEGORIES: Array<{
  name: string;
  slug: string;
  parent?: string;
  description?: string;
}> = [
  { name: "Apparel", slug: "apparel", description: "Everyday clothing built to last." },
  { name: "Hoodies", slug: "hoodies", parent: "apparel" },
  { name: "T-Shirts", slug: "t-shirts", parent: "apparel" },
  { name: "Outerwear", slug: "outerwear", parent: "apparel" },
  { name: "Accessories", slug: "accessories", description: "The small things you carry daily." },
  { name: "Bags", slug: "bags", parent: "accessories" },
  { name: "Headwear", slug: "headwear", parent: "accessories" },
  { name: "Home", slug: "home", description: "Objects for the spaces you live in." },
  { name: "Drinkware", slug: "drinkware", parent: "home" },
  { name: "Lighting", slug: "lighting", parent: "home" },
];

const SIZES = ["S", "M", "L", "XL", "XXL"];
const CORE_COLORS = ["Black", "Bone", "Moss"];

export const DEMO_PRODUCTS: DemoProduct[] = [
  {
    title: "Essential Hoodie",
    category: "hoodies",
    price: 78,
    compareAtPrice: 96,
    cost: 27.5,
    vendor: "Northwind Mill",
    tags: ["bestseller", "core", "fleece"],
    inventory: 0,
    weight: 10,
    axes: [
      { name: "Color", values: CORE_COLORS },
      { name: "Size", values: SIZES },
    ],
    description:
      "A midweight 420gsm loopback fleece hoodie with a double-layer hood, ribbed cuffs and a boxy, pre-shrunk body. Garment-dyed in small batches so the colour settles rather than fades.",
  },
  {
    title: "Heavyweight Zip Hoodie",
    category: "hoodies",
    price: 94,
    cost: 34,
    vendor: "Northwind Mill",
    tags: ["core", "fleece", "winter"],
    inventory: 0,
    weight: 6,
    axes: [
      { name: "Color", values: ["Black", "Charcoal"] },
      { name: "Size", values: SIZES },
    ],
    description:
      "500gsm brushed-back fleece with a corrosion-resistant zip and a slightly longer body. Built for the four months of the year when nothing else will do.",
  },
  {
    title: "Cropped Fleece Pullover",
    category: "hoodies",
    price: 68,
    cost: 24,
    vendor: "Northwind Mill",
    tags: ["new", "fleece"],
    inventory: 0,
    weight: 4,
    axes: [
      { name: "Color", values: ["Bone", "Clay"] },
      { name: "Size", values: ["S", "M", "L", "XL"] },
    ],
    description:
      "A shorter cut of our loopback fleece with a wide ribbed hem. Sits at the natural waist.",
  },
  {
    title: "Daily Pocket Tee",
    category: "t-shirts",
    price: 34,
    compareAtPrice: 42,
    cost: 9.4,
    vendor: "Northwind Mill",
    tags: ["bestseller", "core", "cotton"],
    inventory: 0,
    weight: 9,
    axes: [
      { name: "Color", values: ["Black", "Bone", "Moss", "Navy"] },
      { name: "Size", values: SIZES },
    ],
    description:
      "220gsm combed ring-spun cotton with a reinforced chest pocket and a collar that holds its shape past year one.",
  },
  {
    title: "Boxy Long Sleeve",
    category: "t-shirts",
    price: 44,
    cost: 13,
    vendor: "Northwind Mill",
    tags: ["core", "cotton"],
    inventory: 0,
    weight: 5,
    axes: [
      { name: "Color", values: ["Bone", "Black"] },
      { name: "Size", values: SIZES },
    ],
    description: "A relaxed long sleeve in the same 220gsm cotton, cut two inches wider through the chest.",
  },
  {
    title: "Ribbed Henley",
    category: "t-shirts",
    price: 52,
    cost: 17,
    vendor: "Northwind Mill",
    tags: ["new"],
    inventory: 0,
    weight: 3,
    axes: [{ name: "Size", values: SIZES }],
    description: "Four-button placket, fine rib, slightly tapered. Works alone or as a mid-layer.",
  },
  {
    title: "Summer Linen Shirt",
    category: "t-shirts",
    price: 88,
    cost: 31,
    vendor: "Coastline Textiles",
    tags: ["summer", "linen", "new"],
    inventory: 0,
    weight: 4,
    axes: [
      { name: "Color", values: ["Bone", "Sky"] },
      { name: "Size", values: ["S", "M", "L", "XL"] },
    ],
    description: "European flax, washed twice before cutting so it arrives soft and stays crisp at the collar.",
  },
  {
    title: "Field Jacket",
    category: "outerwear",
    price: 218,
    compareAtPrice: 260,
    cost: 82,
    vendor: "Coastline Textiles",
    tags: ["premium", "outerwear"],
    inventory: 0,
    weight: 3,
    axes: [
      { name: "Color", values: ["Moss", "Black"] },
      { name: "Size", values: ["S", "M", "L", "XL"] },
    ],
    description:
      "Waxed 10oz cotton canvas, four bellows pockets, corduroy collar. Re-waxable, so it should outlive several of everything else you own.",
  },
  {
    title: "Quilted Liner Vest",
    category: "outerwear",
    price: 132,
    cost: 48,
    vendor: "Coastline Textiles",
    tags: ["outerwear", "winter"],
    inventory: 0,
    weight: 2,
    axes: [{ name: "Size", values: ["S", "M", "L", "XL"] }],
    description: "A diamond-quilted vest that layers under the Field Jacket or stands on its own in shoulder season.",
  },
  {
    title: "Rain Shell",
    category: "outerwear",
    price: 165,
    cost: 61,
    vendor: "Coastline Textiles",
    tags: ["outerwear"],
    inventory: 0,
    weight: 2,
    status: "DRAFT",
    axes: [{ name: "Size", values: ["S", "M", "L", "XL"] }],
    description: "Fully taped seams, 3-layer membrane, adjustable storm hood. Arriving for the autumn drop.",
  },
  {
    title: "Canvas Weekender",
    category: "bags",
    price: 148,
    compareAtPrice: 178,
    cost: 52,
    vendor: "Harbor Goods",
    tags: ["bestseller", "travel", "canvas"],
    inventory: 46,
    weight: 7,
    description:
      "18oz cotton canvas with vegetable-tanned leather handles and a brass zip. Fits three days of clothing and a laptop.",
  },
  {
    title: "Everyday Tote",
    category: "bags",
    price: 64,
    cost: 21,
    vendor: "Harbor Goods",
    tags: ["core", "canvas"],
    inventory: 132,
    weight: 6,
    description: "A flat-bottomed tote with an interior slip pocket and reinforced strap anchors.",
  },
  {
    title: "Commuter Backpack",
    category: "bags",
    price: 186,
    cost: 68,
    vendor: "Harbor Goods",
    tags: ["travel", "premium"],
    inventory: 28,
    weight: 4,
    description: "Roll-top closure, padded 16-inch laptop sleeve, water-resistant base panel.",
  },
  {
    title: "Leather Card Holder",
    category: "accessories",
    price: 42,
    cost: 12,
    vendor: "Harbor Goods",
    tags: ["gift", "leather"],
    inventory: 210,
    weight: 5,
    description: "Four slots and a centre pocket in vegetable-tanned leather that darkens with use.",
  },
  {
    title: "Waxed Dopp Kit",
    category: "accessories",
    price: 58,
    cost: 19,
    vendor: "Harbor Goods",
    tags: ["travel", "gift"],
    inventory: 74,
    weight: 3,
    description: "Wipe-clean waxed canvas exterior with a coated interior lining that survives a leaking bottle.",
  },
  {
    title: "Merino Beanie",
    category: "headwear",
    price: 38,
    cost: 11,
    vendor: "Northwind Mill",
    tags: ["winter", "core"],
    inventory: 0,
    weight: 5,
    axes: [{ name: "Color", values: ["Black", "Moss", "Bone"] }],
    description: "Fine-gauge merino with a folded brim. Warm without the itch.",
  },
  {
    title: "Six-Panel Cap",
    category: "headwear",
    price: 36,
    cost: 10,
    vendor: "Northwind Mill",
    tags: ["core", "summer"],
    inventory: 0,
    weight: 4,
    axes: [{ name: "Color", values: ["Black", "Bone", "Moss"] }],
    description: "Washed cotton twill, unstructured crown, brass slider closure.",
  },
  {
    title: "Wool Scarf",
    category: "headwear",
    price: 68,
    cost: 23,
    vendor: "Northwind Mill",
    tags: ["winter", "gift"],
    inventory: 62,
    weight: 2,
    description: "Lambswool woven in a herringbone twill with hand-knotted fringe.",
  },
  {
    title: "Stoneware Mug",
    category: "drinkware",
    price: 28,
    cost: 8,
    vendor: "Kiln & Co.",
    tags: ["bestseller", "gift", "home"],
    inventory: 0,
    weight: 8,
    axes: [{ name: "Color", values: ["Sand", "Slate"] }],
    description: "12oz reactive-glaze stoneware. Every piece fires slightly differently, which is the point.",
  },
  {
    title: "Insulated Bottle",
    category: "drinkware",
    price: 46,
    compareAtPrice: 54,
    cost: 15,
    vendor: "Kiln & Co.",
    tags: ["core", "travel"],
    inventory: 168,
    weight: 6,
    description: "Double-wall vacuum steel, 24oz, holds temperature for roughly twelve hours.",
  },
  {
    title: "Pour-Over Carafe",
    category: "drinkware",
    price: 62,
    cost: 22,
    vendor: "Kiln & Co.",
    tags: ["home", "gift"],
    inventory: 41,
    weight: 3,
    description: "Borosilicate glass carafe with a walnut collar and leather tie.",
  },
  {
    title: "Ceramic Table Lamp",
    category: "lighting",
    price: 178,
    cost: 64,
    vendor: "Kiln & Co.",
    tags: ["home", "premium"],
    inventory: 22,
    weight: 2,
    description: "Hand-thrown base with a linen drum shade and an inline dimmer.",
  },
  {
    title: "Beeswax Pillar Candle",
    category: "lighting",
    price: 32,
    cost: 9,
    vendor: "Kiln & Co.",
    tags: ["gift", "home", "bestseller"],
    inventory: 240,
    weight: 7,
    description: "Pure beeswax, cotton wick, roughly sixty hours of burn time. Unscented on purpose.",
  },
  {
    title: "Brass Candle Snuffer",
    category: "lighting",
    price: 24,
    cost: 6,
    vendor: "Kiln & Co.",
    tags: ["gift", "home"],
    inventory: 158,
    weight: 3,
    description: "Solid brass with a walnut handle. Unlacquered, so it will patina.",
  },
  {
    title: "Cotton Throw Blanket",
    category: "home",
    price: 96,
    cost: 34,
    vendor: "Coastline Textiles",
    tags: ["home", "gift", "winter"],
    inventory: 58,
    weight: 4,
    description: "Waffle-weave cotton, generously sized at 130 × 180cm, softens noticeably after the first wash.",
  },
  {
    title: "Linen Napkin Set",
    category: "home",
    price: 54,
    cost: 18,
    vendor: "Coastline Textiles",
    tags: ["home", "summer", "linen"],
    inventory: 87,
    weight: 3,
    description: "Set of four stonewashed linen napkins with mitred corners.",
  },
  {
    title: "Archive Sweatshirt",
    category: "hoodies",
    price: 72,
    cost: 25,
    vendor: "Northwind Mill",
    tags: ["archive"],
    inventory: 0,
    weight: 1,
    status: "ARCHIVED",
    axes: [{ name: "Size", values: ["M", "L", "XL"] }],
    description: "A previous season crewneck kept for reference. No longer produced.",
  },
];

export const DEMO_COLLECTIONS: Array<{
  title: string;
  slug: string;
  description: string;
  type: "MANUAL" | "AUTOMATIC";
  rules?: { match: "all" | "any"; rules: Array<{ field: string; operator: string; value: string }> };
  productTitles?: string[];
}> = [
  {
    title: "New Arrivals",
    slug: "new-arrivals",
    description: "The most recent additions to the range.",
    type: "AUTOMATIC",
    rules: { match: "all", rules: [{ field: "tag", operator: "contains", value: "new" }] },
  },
  {
    title: "Best Sellers",
    slug: "best-sellers",
    description: "What people actually keep buying.",
    type: "AUTOMATIC",
    rules: { match: "all", rules: [{ field: "tag", operator: "contains", value: "bestseller" }] },
  },
  {
    title: "Summer",
    slug: "summer",
    description: "Lighter weights for warm months.",
    type: "AUTOMATIC",
    rules: { match: "any", rules: [{ field: "tag", operator: "contains", value: "summer" }, { field: "tag", operator: "contains", value: "linen" }] },
  },
  {
    title: "The Fleece Shop",
    slug: "fleece",
    description: "Everything we make in loopback and brushed-back fleece.",
    type: "MANUAL",
    productTitles: ["Essential Hoodie", "Heavyweight Zip Hoodie", "Cropped Fleece Pullover"],
  },
  {
    title: "Carry",
    slug: "carry",
    description: "Bags and small leather goods.",
    type: "MANUAL",
    productTitles: ["Canvas Weekender", "Everyday Tote", "Commuter Backpack", "Leather Card Holder", "Waxed Dopp Kit"],
  },
  {
    title: "Gifts Under $50",
    slug: "gifts-under-50",
    description: "Considered things that do not require a budget conversation.",
    type: "AUTOMATIC",
    rules: { match: "all", rules: [{ field: "price", operator: "less_than", value: "50" }] },
  },
];

export const DEMO_FIRST_NAMES = [
  "Avery","Jordan","Riley","Casey","Morgan","Quinn","Rowan","Sasha","Devon","Elliot",
  "Harper","Kai","Logan","Marlowe","Noa","Parker","Reese","Sage","Tatum","Wren",
  "Amara","Bodhi","Cleo","Dara","Ezra","Freya","Gideon","Hana","Idris","Juno",
];

export const DEMO_LAST_NAMES = [
  "Whitfield","Okafor","Lindqvist","Moreau","Castellanos","Nakamura","Abadi","Fernsby","Delgado","Varga",
  "Petrov","Harrington","Osei","Kowalski","Ibarra","Novak","Reyes","Baptiste","Thorne","Vasquez",
];

export const DEMO_CITIES: Array<[string, string, string]> = [
  ["Portland", "OR", "97209"],
  ["Austin", "TX", "78702"],
  ["Brooklyn", "NY", "11211"],
  ["Denver", "CO", "80205"],
  ["Chicago", "IL", "60622"],
  ["Seattle", "WA", "98122"],
  ["Nashville", "TN", "37206"],
  ["Oakland", "CA", "94609"],
  ["Minneapolis", "MN", "55408"],
  ["Providence", "RI", "02906"],
  ["Asheville", "NC", "28801"],
  ["Santa Fe", "NM", "87501"],
];

export const TRAFFIC_SOURCES = ["direct", "google", "instagram", "tiktok", "facebook", "email", "other"] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

/** Relative share of sessions per source — stable across the seeded window. */
export const SOURCE_WEIGHTS: Record<TrafficSource, number> = {
  direct: 0.22,
  google: 0.27,
  instagram: 0.18,
  tiktok: 0.12,
  facebook: 0.07,
  email: 0.09,
  other: 0.05,
};

export const DEVICE_WEIGHTS: Record<string, number> = {
  mobile: 0.62,
  desktop: 0.31,
  tablet: 0.07,
};

export const REVIEW_SNIPPETS: Array<{ rating: number; title: string; body: string }> = [
  { rating: 5, title: "Exactly as described", body: "Weight and fit are what the listing promised. Washed it four times with no shrinkage worth mentioning." },
  { rating: 5, title: "Worth the price", body: "I hesitated at first but the construction is clearly a step above what I was replacing." },
  { rating: 4, title: "Great, runs slightly large", body: "Quality is excellent. I would size down if you prefer a closer fit through the shoulders." },
  { rating: 5, title: "Second one I've bought", body: "Bought the first one last year and it still looks new, so here we are again." },
  { rating: 4, title: "Good but slow to arrive", body: "No complaints about the product itself. Shipping took about a week longer than estimated." },
  { rating: 3, title: "Colour is a little off", body: "Reads greener in person than on screen. Still well made, just not what I pictured." },
  { rating: 5, title: "Holds up", body: "Six months of daily use and the seams and hardware are all still solid." },
  { rating: 5, title: "Gift that landed", body: "Bought it for my brother and he has apparently not taken it off since." },
  { rating: 4, title: "Solid everyday piece", body: "Nothing flashy, which is why I like it. Goes with everything I own." },
  { rating: 2, title: "Not for me", body: "The cut is boxier than I expected. Returns process was straightforward at least." },
];
