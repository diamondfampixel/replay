import { z } from "zod";

/**
 * Design DNA — the persistent, structured character of a store's brand.
 *
 * Seven axes, each 0–100. They are not "settings" a shopper sees; they are
 * what every other design decision consults: new sections take DNA-aware
 * defaults, presets are just DNA + a font pairing, and the AI reads DNA to
 * make coordinated changes ("more premium" moves several axes together)
 * instead of isolated CSS edits. Two stores differ because their DNA differs —
 * coordinated variation, never randomness.
 */
export const DNA_AXES = [
  { key: "expression", low: "Restrained", high: "Expressive", hint: "How loud the typography and composition are." },
  { key: "era", low: "Classic", high: "Futuristic", hint: "Serif warmth and tradition vs. grotesk precision and tech." },
  { key: "tone", low: "Serious", high: "Playful", hint: "Gravity vs. fun — rounded shapes, colour, bounce." },
  { key: "geometry", low: "Organic", high: "Geometric", hint: "Soft, natural forms vs. crisp grids and hard lines." },
  { key: "edge", low: "Soft", high: "Sharp", hint: "Corner radius and border language." },
  { key: "density", low: "Minimal", high: "Dense", hint: "Whitespace and how much sits on a screen." },
  { key: "energy", low: "Calm", high: "Energetic", hint: "Motion intensity and pace." },
] as const;

export type DnaAxis = (typeof DNA_AXES)[number]["key"];

const axis = z.number().min(0).max(100);

export const dnaSchema = z.object({
  expression: axis.default(50),
  era: axis.default(50),
  tone: axis.default(35),
  geometry: axis.default(55),
  edge: axis.default(50),
  density: axis.default(45),
  energy: axis.default(40),
});

export type DesignDNA = z.infer<typeof dnaSchema>;

/**
 * Per-store overrides: only the axes the merchant (or AI) actually set. No
 * defaults here on purpose — `dnaSchema.partial()` would still fill every axis
 * and silently replace a direction preset's DNA instead of bending it.
 */
export const dnaOverrideSchema = z.object({
  expression: axis.optional(),
  era: axis.optional(),
  tone: axis.optional(),
  geometry: axis.optional(),
  edge: axis.optional(),
  density: axis.optional(),
  energy: axis.optional(),
});
export type DnaOverride = z.infer<typeof dnaOverrideSchema>;

/** Preset DNA + explicit per-store axes → full DNA. */
export function mergeDna(base: DesignDNA, override?: DnaOverride | null): DesignDNA {
  const out: DesignDNA = { ...base };
  if (!override) return out;
  for (const { key } of DNA_AXES) {
    const v = override[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = Math.max(0, Math.min(100, Math.round(v)));
  }
  return out;
}

export const DEFAULT_DNA: DesignDNA = dnaSchema.parse({});

/** Token defaults the DNA implies. Presets and per-store overrides sit above these. */
export function dnaDefaults(dna: DesignDNA) {
  const radius =
    dna.edge >= 82 ? "none" : dna.edge >= 62 ? "xs" : dna.edge >= 42 ? "sm" : dna.edge >= 25 ? "md" : dna.edge >= 12 ? "lg" : "xl";
  const buttonShape = dna.edge >= 65 ? "sharp" : dna.edge <= 30 || dna.tone >= 70 ? "pill" : "rounded";
  const density = dna.density <= 33 ? "spacious" : dna.density <= 66 ? "comfortable" : "compact";
  const motionLevel = dna.energy <= 22 ? "off" : dna.energy <= 45 ? "subtle" : dna.energy <= 72 ? "balanced" : "expressive";
  const headingWeight = dna.expression <= 30 ? 500 : dna.expression <= 60 ? 600 : dna.expression <= 82 ? 700 : 800;
  const headingTransform = dna.expression >= 72 && dna.geometry >= 55 ? "uppercase" : "none";
  const headingScale = Math.round((0.9 + (dna.expression / 100) * 0.4) * 100) / 100; // 0.9 – 1.3
  const headingTracking = headingTransform === "uppercase" ? 0.06 : dna.expression >= 60 ? -0.035 : -0.02;
  const cardStyle =
    dna.tone >= 65 ? "elevated" : dna.density >= 66 ? "framed" : dna.expression >= 60 ? "editorial" : "minimal";
  const imageRatio = dna.expression >= 65 ? "tall" : dna.era <= 35 ? "portrait" : dna.geometry >= 70 ? "landscape" : "square";
  const hover = dna.energy >= 70 ? "lift" : dna.energy >= 40 ? "zoom" : "none";
  const reveal = dna.energy >= 70 ? "slide" : dna.energy >= 40 ? "fade" : "none";
  const buttonStyle = dna.expression <= 35 && dna.era <= 45 ? "outline" : dna.tone >= 65 ? "solid" : "solid";
  const surfaceShadow = dna.tone >= 60 ? "soft" : dna.density >= 70 ? "none" : "none";
  const borderWidth = dna.geometry >= 75 && dna.density >= 55 ? 1 : dna.edge >= 70 ? 1 : 1;
  return {
    radius, buttonShape, density, motionLevel, headingWeight, headingTransform, headingScale,
    headingTracking, cardStyle, imageRatio, hover, reveal, buttonStyle, surfaceShadow, borderWidth,
  } as const;
}

/** Human summary the AI and the settings UI show: which way each axis leans. */
export function describeDna(dna: DesignDNA): string {
  return DNA_AXES.map(({ key, low, high }) => {
    const v = dna[key];
    const lean = v <= 35 ? low.toLowerCase() : v >= 65 ? high.toLowerCase() : `between ${low.toLowerCase()} and ${high.toLowerCase()}`;
    return `${key}: ${lean} (${v})`;
  }).join("; ");
}

/**
 * Moves DNA in a named direction — the vocabulary the AI uses for requests
 * like "more premium" or "younger", so a plain-language nudge becomes a
 * coordinated, bounded change rather than a guess.
 */
export const DNA_MOVES = {
  premium: { expression: -10, era: -5, tone: -20, edge: +10, density: -20, energy: -15 },
  bolder: { expression: +25, energy: +10, edge: +5 },
  calmer: { energy: -25, expression: -10, density: -10 },
  younger: { tone: +25, energy: +15, expression: +10, edge: -10 },
  playful: { tone: +30, edge: -20, energy: +15 },
  serious: { tone: -30, expression: -5 },
  minimal: { density: -30, expression: -10, energy: -10 },
  denser: { density: +25 },
  softer: { edge: -25, geometry: -15 },
  sharper: { edge: +25, geometry: +15 },
  futuristic: { era: +30, geometry: +15 },
  classic: { era: -30, geometry: -10 },
  energetic: { energy: +30, expression: +10 },
  organic: { geometry: -30, edge: -15 },
} as const;

export type DnaMove = keyof typeof DNA_MOVES;

export function applyDnaMove(dna: DesignDNA, move: DnaMove, strength = 1): DesignDNA {
  const delta = DNA_MOVES[move] as Partial<Record<DnaAxis, number>>;
  const next = { ...dna };
  for (const [key, amount] of Object.entries(delta) as Array<[DnaAxis, number]>) {
    next[key] = Math.max(0, Math.min(100, Math.round(next[key] + amount * strength)));
  }
  return next;
}
