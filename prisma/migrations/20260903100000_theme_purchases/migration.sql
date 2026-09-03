-- Theme library: one-time premium theme purchases + the store's active catalogue theme.
ALTER TABLE "Store" ADD COLUMN "activeThemeId" TEXT;

CREATE TABLE "ThemePurchase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ThemePurchase_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ThemePurchase_stripeSessionId_key" ON "ThemePurchase"("stripeSessionId");
CREATE INDEX "ThemePurchase_organizationId_themeId_idx" ON "ThemePurchase"("organizationId", "themeId");

ALTER TABLE "ThemePurchase" ADD CONSTRAINT "ThemePurchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
