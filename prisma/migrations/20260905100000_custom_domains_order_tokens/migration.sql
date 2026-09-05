-- AlterTable
ALTER TABLE "Store" ADD COLUMN "customDomainStatus" TEXT NOT NULL DEFAULT 'NOT_CONNECTED',
ADD COLUMN "customDomainVerifiedAt" TIMESTAMP(3),
ADD COLUMN "customDomainError" TEXT,
ADD COLUMN "customDomainCheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "accessToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Store_customDomain_key" ON "Store"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Order_accessToken_key" ON "Order"("accessToken");
