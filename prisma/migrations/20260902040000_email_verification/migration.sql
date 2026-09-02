ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

-- Accounts that predate verification are treated as verified: they were
-- created when no verification existed, and locking them out retroactively
-- would punish existing users for a feature launch.
UPDATE "User" SET "emailVerifiedAt" = "createdAt";

CREATE TABLE "EmailVerificationToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");
