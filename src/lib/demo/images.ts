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

type ShapeKind = "column" | "arc" | "stack" | "grid" | "wedge";
const SHAPES: ShapeKind[] = ["column", "arc", "stack", "grid", "wedge"];

function shapeMarkup(kind: ShapeKind, shape: string, accent: string): string {
  switch (kind) {
    case "column":
      return `<rect x="300" y="200" width="200" height="440" rx="100" fill="${shape}"/>
              <rect x="300" y="470" width="200" height="170" fill="${accent}" opacity="0.16"/>`;
    case "arc":
      return `<path d="M240 620 A160 160 0 0 1 560 620 Z" fill="${shape}"/>
              <circle cx="400" cy="340" r="96" fill="${accent}" opacity="0.18"/>`;
    case "stack":
      return `<rect x="250" y="300" width="300" height="90" rx="14" fill="${shape}"/>
              <rect x="280" y="410" width="240" height="90" rx="14" fill="${shape}" opacity="0.75"/>
              <rect x="310" y="520" width="180" height="90" rx="14" fill="${accent}" opacity="0.22"/>`;
    case "grid":
      return `<rect x="260" y="260" width="130" height="130" rx="12" fill="${shape}"/>
              <rect x="410" y="260" width="130" height="130" rx="12" fill="${shape}" opacity="0.7"/>
              <rect x="260" y="410" width="130" height="130" rx="12" fill="${shape}" opacity="0.7"/>
              <rect x="410" y="410" width="130" height="130" rx="12" fill="${accent}" opacity="0.24"/>`;
    case "wedge":
    default:
      return `<path d="M250 620 L400 240 L550 620 Z" fill="${shape}"/>
              <path d="M330 620 L400 430 L470 620 Z" fill="${accent}" opacity="0.2"/>`;
  }
}

/** Renders a square SVG studio card. Same input always yields the same file. */
export function productPlaceholderSvg(label: string, variantKey = ""): string {
  const seed = hash(`${label}::${variantKey}`);
  const palette = PALETTES[seed % PALETTES.length];
  const kind = SHAPES[(seed >>> 3) % SHAPES.length];
  const caption = escapeXml(label.toUpperCase().slice(0, 28));

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800" role="img" aria-label="${escapeXml(label)}">
  <rect width="800" height="800" fill="${palette.bg}"/>
  ${shapeMarkup(kind, palette.shape, palette.accent)}
  <rect x="0" y="712" width="800" height="88" fill="${palette.bg}"/>
  <text x="400" y="756" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="24" letter-spacing="4" fill="${palette.text}">${caption}</text>
  <rect x="0" y="0" width="800" height="800" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="2"/>
</svg>`;
}

/** Wide banner artwork used by storefront hero / image-text sections. */
export function bannerPlaceholderSvg(label: string, primary = "#0e7c66"): string {
  const seed = hash(label);
  const palette = PALETTES[seed % PALETTES.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" role="img" aria-label="${escapeXml(label)}">
  <rect width="1600" height="900" fill="${palette.bg}"/>
  <circle cx="1180" cy="330" r="300" fill="${palette.shape}"/>
  <circle cx="1180" cy="330" r="150" fill="${primary}" opacity="0.18"/>
  <rect x="0" y="640" width="1600" height="260" fill="${palette.shape}" opacity="0.5"/>
  <rect x="120" y="700" width="420" height="14" rx="7" fill="${palette.text}" opacity="0.25"/>
  <rect x="120" y="736" width="280" height="14" rx="7" fill="${palette.text}" opacity="0.15"/>
</svg>`;
}

export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
