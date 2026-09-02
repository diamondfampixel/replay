CREATE TYPE "WaitlistStatus" AS ENUM ('PENDING', 'INVITED', 'CONVERTED');

CREATE TABLE "WaitlistEntry" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "status" "WaitlistStatus" NOT NULL DEFAULT 'PENDING',
  "source" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "referrer" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "invitedAt" TIMESTAMP(3),
  CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

CREATE TABLE "MarketingEvent" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "path" TEXT,
  "visitorId" TEXT NOT NULL,
  "source" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "referrer" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MarketingEvent_type_createdAt_idx" ON "MarketingEvent"("type", "createdAt");
CREATE INDEX "MarketingEvent_visitorId_idx" ON "MarketingEvent"("visitorId");
