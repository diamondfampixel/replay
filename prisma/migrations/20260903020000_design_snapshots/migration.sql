-- Design snapshots: reversible point-in-time copies of a store's theme + page sections.
CREATE TABLE "DesignSnapshot" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "theme" JSONB,
    "pages" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DesignSnapshot_storeId_createdAt_idx" ON "DesignSnapshot"("storeId", "createdAt");

ALTER TABLE "DesignSnapshot" ADD CONSTRAINT "DesignSnapshot_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
