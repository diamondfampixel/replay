-- Subscription state on Organization, plus the per-day AI usage ledger.

CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');
CREATE TYPE "BillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');

ALTER TABLE "Organization"
  ALTER COLUMN "plan" SET DEFAULT 'harbor';

ALTER TABLE "Organization"
  ADD COLUMN "planStatus" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "billingCycle" "BillingCycle" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "currentPeriodEnd" TIMESTAMP(3),
  ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "stripeCustomerId" TEXT,
  ADD COLUMN "stripeSubscriptionId" TEXT;

CREATE UNIQUE INDEX "Organization_stripeCustomerId_key" ON "Organization"("stripeCustomerId");
CREATE UNIQUE INDEX "Organization_stripeSubscriptionId_key" ON "Organization"("stripeSubscriptionId");

-- Legacy plan strings from the placeholder pricing map onto the real tiers.
-- The demo organization keeps everything unlocked so the product can be shown.
UPDATE "Organization" SET "plan" = CASE
  WHEN "isDemo" THEN 'flagship'
  WHEN "plan" = 'starter' THEN 'skiff'
  WHEN "plan" = 'growth' THEN 'clipper'
  WHEN "plan" = 'pro' THEN 'flagship'
  ELSE 'harbor'
END;

CREATE TABLE "AIUsageDay" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "day" DATE NOT NULL,
  "actions" INTEGER NOT NULL DEFAULT 0,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
  "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AIUsageDay_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AIUsageDay_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AIUsageDay_organizationId_day_key" ON "AIUsageDay"("organizationId", "day");
