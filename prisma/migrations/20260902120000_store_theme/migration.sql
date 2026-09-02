-- Structured storefront design system: a per-store theme (direction + token overrides).
ALTER TABLE "Store" ADD COLUMN "theme" JSONB;
