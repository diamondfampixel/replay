/**
 * Deterministic placeholder artwork for demo products and media.
 *
 * Real stores upload real photography; the demo store ships generated SVG
 * studio cards so the app is fully populated offline and every image URL is a
 * genuine file rather than a hotlink to somewhere else.
 */

const PALETTES: Array<{ bg: string; shape: string; accent: string; text: string }> = [
  { bg: "#eceae4", shape: "#cdc9bd", accent: "#0e7c66", text: "#3b3a34" },
  { bg: "#e6ebe9", shape: "#c3cfcb", accent: "#0b6252", text: "#33403c" },
  { bg: "#f0ece7", shape: "#d8cfc2", accent: "#a1660a", text: "#443c30" },
  { bg: "#e8eaef", shape: "#c8cdd9", accent: "#2b5f9e", text: "#343846" },
  { bg: "#efe9ea", shape: "#d7c6c8", accent: "#8a4b8f", text: "#443639" },
  { bg: "#e9ece6", shape: "#ccd3c2", accent: "#4b7a2a", text: "#3a4033" },
  { bg: "#f2efe9", shape: "#ded5c6", accent: "#b4331f", text: "#453b36" },
  { bg: "#e7e6e3", shape: "#c9c7c1", accent: "#1a1a17", text: "#33322e" },
];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type ShapeKind = "garment" | "vessel" | "folded" | "carry" | "column";
const SHAPES: ShapeKind[] = ["garment", "vessel", "folded", "carry", "column"];

/**
 * Abstract product forms rather than figurative shapes — a placeholder should
 * read as "photography goes here", not as an avatar.
 */
function shapeMarkup(kind: ShapeKind, shape: string, accent: string): string {
  switch (kind) {
    // Shoulders and a body: reads as folded apparel.
    case "garment":
      return `<path d="M250 300 L340 250 L400 285 L460 250 L550 300 L520 380 L470 355 L470 640 L330 640 L330 355 L280 380 Z" fill="${shape}"/>
              <path d="M330 545 L470 545 L470 640 L330 640 Z" fill="${accent}" opacity="0.18"/>`;
    // A bottle or jar profile.
    case "vessel":
      return `<path d="M370 230 h60 v60 q70 40 70 130 v190 q0 40 -40 40 h-120 q-40 0 -40 -40 v-190 q0 -90 70 -130 z" fill="${shape}"/>
              <rect x="300" y="470" width="200" height="110" fill="${accent}" opacity="0.2"/>`;
    // Neatly stacked textiles.
    case "folded":
      return `<rect x="250" y="330" width="300" height="80" rx="8" fill="${shape}"/>
              <rect x="250" y="424" width="300" height="80" rx="8" fill="${shape}" opacity="0.78"/>
              <rect x="250" y="518" width="300" height="80" rx="8" fill="${accent}" opacity="0.24"/>`;
    // A bag with a handle.
    case "carry":
      return `<path d="M330 320 q70 -110 140 0" fill="none" stroke="${shape}" stroke-width="20" stroke-linecap="round"/>
              <rect x="270" y="320" width="260" height="300" rx="14" fill="${shape}"/>
              <rect x="270" y="530" width="260" height="90" rx="0" fill="${accent}" opacity="0.2"/>`;
    // A tall taper — candles, lighting, drinkware.
    case "column":
    default:
      return `<rect x="330" y="240" width="140" height="400" rx="16" fill="${shape}"/>
              <rect x="330" y="500" width="140" height="140" fill="${accent}" opacity="0.22"/>
              <rect x="368" y="200" width="64" height="44" rx="10" fill="${shape}" opacity="0.7"/>`;
  }
}

/** Maps a product category onto the closest abstract form. */
const CATEGORY_SHAPES: Record<string, ShapeKind> = {
  hoodies: "garment",
  "t-shirts": "garment",
  outerwear: "garment",
  apparel: "garment",
  bags: "carry",
  accessories: "carry",
  headwear: "folded",
  home: "folded",
  drinkware: "vessel",
  lighting: "column",
};

/**
 * Renders a square SVG studio card. Same input always yields the same file, and
 * the form follows the product's category so a bag does not look like a shirt.
 */
export function productPlaceholderSvg(label: string, variantKey = "", category?: string): string {
  const seed = hash(`${label}::${variantKey}`);
  const palette = PALETTES[seed % PALETTES.length];
  const kind: ShapeKind =
    (category ? CATEGORY_SHAPES[category] : undefined) ?? SHAPES[(seed >>> 3) % SHAPES.length];
  const caption = escapeXml(label.toUpperCase().slice(0, 28));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img" aria-label="${escapeXml(label)}">
  <rect width="800" height="800" fill="${palette.bg}"/>
  ${shapeMarkup(kind, palette.shape, palette.accent)}
  <rect x="0" y="712" width="800" height="88" fill="${palette.bg}"/>
  <text x="400" y="756" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="24" letter-spacing="4" fill="${palette.text}">${caption}</text>
  <rect x="0" y="0" width="800" height="800" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="2"/>
</svg>`;
}

/**
 * Wide banner artwork for hero and image-text sections. Kept to soft overlapping
 * fields so overlaid copy stays readable at any crop.
 */
export function bannerPlaceholderSvg(label: string, primary = "#0e7c66"): string {
  const seed = hash(label);
  const palette = PALETTES[seed % PALETTES.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" role="img" aria-label="${escapeXml(label)}">
  <rect width="1600" height="900" fill="${palette.bg}"/>
  <circle cx="1240" cy="450" r="360" fill="${palette.shape}" opacity="0.85"/>
  <circle cx="1120" cy="330" r="170" fill="${primary}" opacity="0.14"/>
  <path d="M900 900 Q1200 620 1600 760 L1600 900 Z" fill="${palette.shape}" opacity="0.45"/>
</svg>`;
}

export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
