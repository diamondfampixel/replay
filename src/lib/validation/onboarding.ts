import { z } from "zod";

export const INDUSTRIES = [
  "Apparel & accessories",
  "Home & living",
  "Beauty & personal care",
  "Food & beverage",
  "Health & wellness",
  "Electronics & gadgets",
  "Sports & outdoors",
  "Jewellery",
  "Art & prints",
  "Pet supplies",
  "Digital products",
  "Other",
] as const;

export const BRAND_PERSONALITIES = [
  "Understated and practical",
  "Warm and personal",
  "Bold and energetic",
  "Premium and refined",
  "Playful and irreverent",
  "Technical and precise",
] as const;

export const AESTHETICS = [
  { id: "editorial", label: "Editorial", description: "Generous whitespace, large type, restrained colour." },
  { id: "warm", label: "Warm minimal", description: "Soft neutrals, rounded edges, friendly tone." },
  { id: "bold", label: "Bold contrast", description: "Heavy type, strong blocks of colour." },
  { id: "classic", label: "Classic retail", description: "Dense grids, clear pricing, conventional layout." },
] as const;

export const HOMEPAGE_SECTION_CHOICES: Array<{ id: string; label: string; always?: boolean }> = [
  { id: "hero", label: "Hero banner", always: true },
  { id: "featuredProducts", label: "Featured products" },
  { id: "benefits", label: "Benefits / why us" },
  { id: "collectionGrid", label: "Shop by collection" },
  { id: "imageText", label: "Story / image + text" },
  { id: "reviews", label: "Customer reviews" },
  { id: "faq", label: "FAQ" },
  { id: "newsletter", label: "Newsletter signup" },
  { id: "announcement", label: "Announcement bar" },
];

const hexColor = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Use a hex colour like #0E7C66");

export const onboardingSchema = z.object({
  businessName: z.string().trim().min(1, "Business name is required").max(80),
  industry: z.string().trim().min(1, "Pick an industry").max(80),
  description: z
    .string()
    .trim()
    .min(10, "Tell us a little more — at least 10 characters")
    .max(600),
  sells: z.string().trim().max(300).optional().default(""),
  targetCustomer: z.string().trim().max(300).optional().default(""),
  brandPersonality: z.string().trim().max(120).optional().default(""),
  aesthetic: z.string().trim().max(40).optional().default("editorial"),
  primaryColor: hexColor.default("#0E7C66"),
  secondaryColor: hexColor.default("#1A1A17"),
  contactEmail: z.string().trim().email("Enter a valid email").or(z.literal("")).optional(),
  sections: z.array(z.string()).default([]),
  seedDemoProducts: z.boolean().default(false),
  generateWithAI: z.boolean().default(false),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
