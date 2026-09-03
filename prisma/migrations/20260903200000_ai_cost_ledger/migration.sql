-- AlterTable
ALTER TABLE "AIUsageDay" ADD COLUMN "estimatedCostMicros" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "AIRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "storeId" TEXT,
    "userId" TEXT,
    "plan" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelCalls" INTEGER NOT NULL DEFAULT 0,
    "toolCalls" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostMicros" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "guard" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIRequest_organizationId_createdAt_idx" ON "AIRequest"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AIRequest_createdAt_idx" ON "AIRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "AIRequest" ADD CONSTRAINT "AIRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
